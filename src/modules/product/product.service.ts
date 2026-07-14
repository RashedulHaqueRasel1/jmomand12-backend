import AdmZip from 'adm-zip';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import os from 'os';
import pLimit from 'p-limit';
import path from 'path';
import { v4 as uuid } from 'uuid';
import AppError from '../../errors/AppError';
import logger from '../../logger';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import {
  findDirRecursive,
  findFileRecursive,
  generateInventoryIdsBatch,
  listImageFiles,
  parseProductsCsv,
  safeCleanup,
  validateProductRowShape,
} from '../../utils/product.utils';
import { User } from '../user/user.model';
import Auction from '../auction/auction.model';
import AuctionProduct from '../AuctionProduct/AuctionProduct.model';
import Category from '../category/category.model';
import { IBulkProductRow, IBulkUploadResult, IProduct } from './product.interface';
import Product from './product.model';

const PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  under_100: { min: 0, max: 100 },
  '100_500': { min: 100, max: 500 },
  '500_1000': { min: 500, max: 1000 },
  '1000_5000': { min: 1000, max: 5000 },
  '5000_plus': { min: 5000 },
};

const AUCTION_PRODUCT_STATUSES = ['live_auction', 'ending_soon', 'upcoming_auction'] as const;

const createProduct = async (
  payload: Partial<IProduct>,
  email: string,
  files: {
    images?: Express.Multer.File[];
    categoryImage?: Express.Multer.File[];
  },
) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError('Your account is not found', StatusCodes.FORBIDDEN);
  }

  // Product Images Validation
  if (!files.images || files.images.length === 0) {
    throw new AppError('At least one product image is required', StatusCodes.BAD_REQUEST);
  }

  // Product Type Validation
  if (!payload.type) {
    throw new AppError('Product type is required', StatusCodes.BAD_REQUEST);
  }

  // Sale Validation
  if (payload.type === 'for_sale') {
    if (payload.price == null) {
      throw new AppError('Price is required', StatusCodes.BAD_REQUEST);
    }

    if (payload.quantity == null || payload.quantity <= 0) {
      throw new AppError('Quantity is required', StatusCodes.BAD_REQUEST);
    }
  }

  // Upload Product Images
  const uploadedImages = await Promise.all(
    files.images.map(async (file) => {
      const image = await uploadToCloudinary(file.path, 'products');

      return {
        public_id: image.public_id,
        url: image.secure_url,
      };
    }),
  );

  // Category Image
  let categoryImage: { public_id: string; url: string } | undefined;

  // If category image is uploaded, use it
  if (files.categoryImage && files.categoryImage.length > 0) {
    const image = await uploadToCloudinary(files.categoryImage[0].path, 'categories');

    categoryImage = {
      public_id: image.public_id,
      url: image.secure_url,
    };
  }
  // Otherwise get image from Category collection
  else if (payload.category) {
    const categoryDoc = await Category.findOne({
      name: payload.category,
    });

    if (categoryDoc?.image) {
      categoryImage = {
        public_id: categoryDoc.image.public_id,
        url: categoryDoc.image.url,
      };
    }
  }

  const productData: Partial<IProduct> = {
    ...payload,
    inventoryId: payload.inventoryId || (await generateInventoryIdsBatch(1))[0],
    images: uploadedImages,
    categoryImage,
    inventoryStatus: 'available',
    totalReview: 0,
    averageReview: 0,
  };

  const result = await Product.create(productData);

  return result;
};

const IMAGE_UPLOAD_CONCURRENCY = 10;
const MAX_PRODUCTS_PER_BATCH = 1000;

const validateBulkProductRow = (
  row: IBulkProductRow & { row: number },
  type: 'for_sale' | 'for_auction',
): string | null => {
  const shapeError = validateProductRowShape(row);
  if (shapeError) return shapeError;

  if (type === 'for_sale') {
    if (row.price == null || Number.isNaN(Number(row.price))) {
      return 'Price is required for sale products';
    }

    if (row.quantity == null || Number(row.quantity) <= 0) {
      return 'Quantity is required for sale products';
    }
  }

  return null;
};

const uploadProductImages = async (
  folderPath: string,
  limit: ReturnType<typeof pLimit>,
): Promise<Array<{ public_id: string; url: string }>> => {
  const imageFilePaths = listImageFiles(folderPath);
  if (!imageFilePaths.length) {
    throw new Error(`No images found in folder "${path.basename(folderPath)}"`);
  }

  const uploadedImages = await Promise.all(
    imageFilePaths.map((filePath) =>
      limit(async () => {
        const image = await uploadToCloudinary(filePath, 'products');
        return {
          public_id: image.public_id,
          url: image.secure_url,
        };
      }),
    ),
  );

  return uploadedImages;
};

const cleanupCloudinaryAssets = async (uploadedImages: Array<{ public_id: string }>) => {
  await Promise.all(
    uploadedImages.map(async (image) => {
      try {
        await deleteFromCloudinary(image.public_id);
      } catch (cleanupError) {
        logger.warn(
          {
            publicId: image.public_id,
            error: cleanupError instanceof Error ? cleanupError.message : cleanupError,
          },
          'Failed to clean up uploaded Cloudinary asset',
        );
      }
    }),
  );
};

const bulkUploadProducts = async (
  zipFile: Express.Multer.File,
  email: string,
  type: 'for_sale' | 'for_auction',
): Promise<IBulkUploadResult> => {
  if (!zipFile) {
    throw new AppError('A ZIP file is required', StatusCodes.BAD_REQUEST);
  }

  if (!['for_sale', 'for_auction'].includes(type)) {
    throw new AppError('Type must be either "for_sale" or "for_auction"', StatusCodes.BAD_REQUEST);
  }

  const user = await User.findOne({ email });
  if (!user) {
    safeCleanup(zipFile.path);
    throw new AppError('Your account is not found', StatusCodes.FORBIDDEN);
  }

  const extractDir = path.join(os.tmpdir(), `bulk-upload-${uuid()}`);

  try {
    fs.mkdirSync(extractDir, { recursive: true });

    try {
      new AdmZip(zipFile.path).extractAllTo(extractDir, true);
    } catch {
      throw new AppError('Uploaded file is not a valid ZIP archive', StatusCodes.BAD_REQUEST);
    }

    const csvPath = findFileRecursive(extractDir, 'products.csv');
    if (!csvPath) {
      throw new AppError('products.csv not found in the ZIP archive', StatusCodes.BAD_REQUEST);
    }

    const imagesRootDir = findDirRecursive(extractDir, 'imageFolder');
    if (!imagesRootDir) {
      throw new AppError(
        'imageFolder directory not found in the ZIP archive',
        StatusCodes.BAD_REQUEST,
      );
    }

    const rows = parseProductsCsv(csvPath);
    if (!rows.length) {
      throw new AppError('products.csv contains no data rows', StatusCodes.BAD_REQUEST);
    }

    if (rows.length > MAX_PRODUCTS_PER_BATCH) {
      throw new AppError(
        `Cannot upload more than ${MAX_PRODUCTS_PER_BATCH} products at once`,
        StatusCodes.BAD_REQUEST,
      );
    }

    logger.info(
      {
        fileName: zipFile.originalname,
        rowCount: rows.length,
        imagesRootDir,
      },
      'Bulk upload starting',
    );

    const inventoryIds = await generateInventoryIdsBatch(rows.length);
    const limit = pLimit(IMAGE_UPLOAD_CONCURRENCY);

    const result: IBulkUploadResult = {
      totalProcessed: rows.length,
      totalSucceeded: 0,
      totalFailed: 0,
      success: [],
      failed: [],
    };

    const insertCandidates: Array<{
      row: number;
      title: string;
      inventoryId: string;
      document: any;
      uploadedImages: Array<{ public_id: string }>;
    }> = [];

    for (const [idx, row] of rows.entries()) {
      const rowId = row.row;
      try {
        const validationError = validateBulkProductRow(row, type);
        if (validationError) {
          throw new Error(validationError);
        }

        const folderPath = path.join(imagesRootDir, row.imageFolder);
        if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
          throw new Error(`Image folder "${row.imageFolder}" not found`);
        }

        const uploadedImages = await uploadProductImages(folderPath, limit);

        const document: any = {
          inventoryId: inventoryIds[idx],
          title: row.title,
          description: row.description,
          category: row.category,
          condition: row.condition,
          color: row.color,
          type,
          images: uploadedImages,
          inventoryStatus: 'available',
          totalReview: 0,
          averageReview: 0,
        };

        if (row.manufacturer?.trim()) {
          document.manufacturer = row.manufacturer.trim();
        }

        if (type === 'for_auction') {
          if (row.day) document.day = row.day;
          if (row.reservePrice != null) document.reservePrice = Number(row.reservePrice);
        }

        if (type === 'for_sale') {
          document.price = Number(row.price);
          document.quantity = Number(row.quantity);
        }

        insertCandidates.push({
          row: rowId,
          title: row.title,
          inventoryId: inventoryIds[idx],
          document,
          uploadedImages,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown bulk row error';
        logger.warn(
          {
            row: rowId,
            title: row.title,
            imageFolder: row.imageFolder,
            error: message,
          },
          'Bulk upload row failed',
        );

        result.failed.push({
          row: rowId,
          title: row.title,
          error: message,
        });
      }
    }

    if (insertCandidates.length) {
      try {
        const inserted = await Product.insertMany(
          insertCandidates.map((candidate) => candidate.document),
          { ordered: false },
        );

        inserted.forEach((doc: any) => {
          const candidate = insertCandidates.find((item) => item.inventoryId === doc.inventoryId);
          if (candidate) {
            result.success.push({
              row: candidate.row,
              title: candidate.title,
              inventoryId: doc.inventoryId,
              productId: String(doc._id),
            });
          }
        });
      } catch (bulkErr: any) {
        const insertedDocs = bulkErr.insertedDocs || [];
        const writeErrors = bulkErr.writeErrors || [];

        insertedDocs.forEach((doc: any) => {
          const candidate = insertCandidates.find((item) => item.inventoryId === doc.inventoryId);
          if (candidate) {
            result.success.push({
              row: candidate.row,
              title: candidate.title,
              inventoryId: doc.inventoryId,
              productId: String(doc._id),
            });
          }
        });

        writeErrors.forEach((errorEntry: any) => {
          const candidate = insertCandidates[errorEntry.index];
          if (candidate) {
            result.failed.push({
              row: candidate.row,
              title: candidate.title,
              error: errorEntry.errmsg || errorEntry.err?.errmsg || 'Insert failed',
            });

            cleanupCloudinaryAssets(candidate.uploadedImages).catch((cleanupError) =>
              logger.warn(
                {
                  row: candidate.row,
                  inventoryId: candidate.inventoryId,
                  error: cleanupError instanceof Error ? cleanupError.message : cleanupError,
                },
                'Failed to clean up Cloudinary assets for failed insert',
              ),
            );
          }
        });
      }
    }

    result.totalSucceeded = result.success.length;
    result.totalFailed = result.failed.length;

    logger.info(
      {
        totalProcessed: result.totalProcessed,
        totalSucceeded: result.totalSucceeded,
        totalFailed: result.totalFailed,
      },
      'Bulk upload completed',
    );

    return result;
  } finally {
    safeCleanup(extractDir);
    safeCleanup(zipFile.path);
  }
};

const getAllProducts = async (query: Record<string, unknown>) => {
  const {
    searchTerm,
    category,
    condition,
    inventoryStatus,
    type,
    fields,
    minPrice,
    maxPrice,
    priceRange,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = query;

  const filter: any = {};

  // Search
  if (searchTerm) {
    filter.$or = [
      {
        title: {
          $regex: searchTerm,
          $options: 'i',
        },
      },
      {
        description: {
          $regex: searchTerm,
          $options: 'i',
        },
      },
      {
        category: {
          $regex: searchTerm,
          $options: 'i',
        },
      },
    ];
  }

  // Category Filter
  if (category) {
    filter.category = category;
  }

  // Condition Filter
  if (condition) {
    filter.condition = condition;
  }

  // Inventory Filter
  if (inventoryStatus) {
    filter.inventoryStatus = inventoryStatus;
  }

  // Type Filter
  if (type) {
    filter.type = type;
  }

  // Price Range Filter
  let resolvedMinPrice = minPrice != null ? Number(minPrice) : undefined;
  let resolvedMaxPrice = maxPrice != null ? Number(maxPrice) : undefined;

  if (priceRange && typeof priceRange === 'string') {
    const range = PRICE_RANGES[priceRange];
    if (range) {
      resolvedMinPrice = range.min;
      resolvedMaxPrice = range.max;
    }
  }

  if (resolvedMinPrice != null || resolvedMaxPrice != null) {
    filter.price = {};
    if (resolvedMinPrice != null) {
      filter.price.$gte = resolvedMinPrice;
    }
    if (resolvedMaxPrice != null) {
      filter.price.$lte = resolvedMaxPrice;
    }
  }

  // Status Filter (cross-collection with Auctions)
  if (status && typeof status === 'string') {
    if (status === 'buy_now') {
      filter.type = 'for_sale';
      filter.inventoryStatus = 'available';
    } else if (AUCTION_PRODUCT_STATUSES.includes(status as any)) {
      const now = new Date();
      let auctionFilter: any = {};

      if (status === 'live_auction') {
        auctionFilter = { status: 'active' };
      } else if (status === 'ending_soon') {
        const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        auctionFilter = { status: 'active', endsAt: { $lte: oneDayFromNow } };
      } else if (status === 'upcoming_auction') {
        auctionFilter = { status: 'upcoming' };
      }

      const auctionProductIds = await Auction.distinct('products', auctionFilter);
      filter._id = { $in: auctionProductIds };
    }
  }

  // Pagination
  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const skip = (pageNumber - 1) * limitNumber;

  // Sorting

  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === 'asc' ? 1 : -1,
  };

  // Field Selection

  let selectFields = '';

  if (fields) {
    selectFields = (fields as string).split(',').join(' ');
  }

  const products = await Product.find(filter)
    .populate({ path: 'categoryId', strictPopulate: false })
    .sort(sort)
    .skip(skip)
    .limit(limitNumber)
    .select(selectFields);

  const total = await Product.countDocuments(filter);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPage: Math.ceil(total / limitNumber),
    },
    data: products,
  };
};

const getProductDetails = async (id: string) => {
  const result = await Product.findById(id).populate({ path: 'categoryId', strictPopulate: false });
  if (!result) {
    throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  }
  return result;
};

const getInventoryMonitoring = async (query: Record<string, unknown>) => {
  const { inventoryStatus, category, searchTerm } = query;
  const filter: Record<string, unknown> = {};

  if (inventoryStatus) {
    filter.inventoryStatus = inventoryStatus;
  }

  if (category) {
    filter.category = category;
  }

  if (searchTerm) {
    filter.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { inventoryId: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const products = await Product.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'auctions',
        localField: '_id',
        foreignField: 'product',
        as: 'auction',
      },
    },
    { $unwind: { path: '$auction', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'invoices',
        localField: '_id',
        foreignField: 'product',
        as: 'invoice',
      },
    },
    { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'auction.winner',
        foreignField: '_id',
        as: 'winner',
      },
    },
    { $unwind: { path: '$winner', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'pickupappointments',
        localField: '_id',
        foreignField: 'products',
        as: 'pickupAppointment',
      },
    },
    { $unwind: { path: '$pickupAppointment', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'pickupslots',
        localField: 'pickupAppointment.slot',
        foreignField: '_id',
        as: 'pickupSlot',
      },
    },
    { $unwind: { path: '$pickupSlot', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        inventoryId: 1,
        category: 1,
        condition: 1,
        inventoryStatus: 1,
        reservePrice: 1,
        images: 1,
        auctionId: '$auction._id',
        auctionStatus: '$auction.status',
        winningBid: '$auction.highestBid.amount',
        winner: {
          _id: '$winner._id',
          firstName: '$winner.firstName',
          lastName: '$winner.lastName',
          email: '$winner.email',
          phone: '$winner.phone',
        },
        paymentStatus: '$invoice.status',
        invoiceNumber: '$invoice.invoiceNumber',
        pickupStatus: '$pickupAppointment.status',
        pickupDate: '$pickupSlot.startsAt',
        pickupEndsAt: '$pickupSlot.endsAt',
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  return products;
};

const updateProduct = async (
  id: string,
  payload: Partial<IProduct>,
  email: string,
  files?: Express.Multer.File[],
) => {
  const user = await User.isUserExistByEmail(email);
  if (!user) {
    throw new AppError('User not found', StatusCodes.FORBIDDEN);
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  }

  // Upload new images
  if (files?.length) {
    const uploadedImages = await Promise.all(
      files.map(async (file) => {
        const image = await uploadToCloudinary(file.path, 'products');

        return {
          public_id: image.public_id,
          url: image.secure_url,
        };
      }),
    );

    // delete old images
    if (product.images?.length) {
      await Promise.all(product.images.map((image) => deleteFromCloudinary(image.public_id)));
    }

    payload.images = uploadedImages;
  }

  // Auto-populate categoryImage when category changes
  if (payload.category) {
    const categoryDoc = await Category.findOne({ name: payload.category });
    if (categoryDoc?.image) {
      payload.categoryImage = {
        public_id: categoryDoc.image.public_id,
        url: categoryDoc.image.url,
      };
    }
  }

  // prevent unwanted update
  // delete payload.totalReview;
  // delete payload.averageReview;

  const result = await Product.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const deleteProduct = async (id: string, email: string) => {
  const user = await User.isUserExistByEmail(email);
  if (!user) {
    throw new AppError('User not found', StatusCodes.FORBIDDEN);
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  }

  if (!['available', 'unsold', 'unavailable'].includes(product.inventoryStatus)) {
    throw new AppError('Only inactive inventory can be deleted', StatusCodes.BAD_REQUEST);
  }

  if (product.images?.length) {
    await Promise.all(product.images.map((image) => deleteFromCloudinary(image.public_id)));
  }

  await Product.findByIdAndDelete(id);
  return product;
};

const getInventoryProducts = async (query: Record<string, unknown>) => {
  const {
    searchTerm,
    category,
    condition,
    inventoryStatus,
    productType,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = query;

  const filter: any = {};

  if (searchTerm) {
    filter.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  if (category) {
    filter.category = category;
  }

  if (condition) {
    filter.condition = condition;
  }

  if (inventoryStatus) {
    filter.inventoryStatus = inventoryStatus;
  }

  if (productType) {
    filter.type = productType;
  }

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === 'asc' ? 1 : -1,
  };

  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNumber)
    .select(
      'inventoryId title description category condition images color type quantity price reservePrice day manufacturer inventoryStatus',
    );

  const total = await Product.countDocuments(filter);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPage: Math.ceil(total / limitNumber),
    },
    data: products,
  };
};

const getAuctionProducts = async (query: Record<string, unknown>) => {
  const {
    searchTerm,
    category,
    condition,
    inventoryStatus,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = query;

  const filter: any = { type: 'for_auction' };

  if (searchTerm) {
    filter.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  if (category) {
    filter.category = category;
  }

  if (condition) {
    filter.condition = condition;
  }

  if (inventoryStatus) {
    filter.inventoryStatus = inventoryStatus;
  } else {
    filter.inventoryStatus = { $in: ['available', 'unsold'] };
    const lockedAuctionProductIds = await AuctionProduct.distinct('productId', {
      status: { $in: ['upcoming', 'active', 'payment_pending', 'payment_failed', 'sold'] },
    });

    if (lockedAuctionProductIds.length) {
      filter._id = { $nin: lockedAuctionProductIds };
    }
  }

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === 'asc' ? 1 : -1,
  };

  const products = await Product.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limitNumber)
    .select('inventoryId title category condition price reservePrice inventoryStatus');

  const total = await Product.countDocuments(filter);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPage: Math.ceil(total / limitNumber),
    },
    data: products,
  };
};

const browseProducts = async (query: Record<string, unknown>) => {
  const {
    searchTerm,
    category,
    condition,
    type,
    minPrice,
    maxPrice,
    priceRange,
    status,
    minBid,
    maxBid,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = query;

  const filter: any = {};

  // Search across title, description, category
  if (searchTerm && typeof searchTerm === 'string') {
    filter.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { category: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  // Category filter
  if (category && typeof category === 'string') {
    filter.category = category;
  }

  // Condition filter (multi-select: comma-separated)
  if (condition && typeof condition === 'string') {
    const conditions = condition.split(',').map((c) => c.trim());
    filter.condition = conditions.length === 1 ? conditions[0] : { $in: conditions };
  }

  // Type filter
  if (type && typeof type === 'string') {
    filter.type = type;
  }

  // Price Range Filter
  let resolvedMinPrice = minPrice != null ? Number(minPrice) : undefined;
  let resolvedMaxPrice = maxPrice != null ? Number(maxPrice) : undefined;

  if (priceRange && typeof priceRange === 'string') {
    const range = PRICE_RANGES[priceRange];
    if (range) {
      resolvedMinPrice = range.min;
      resolvedMaxPrice = range.max;
    }
  }

  if (resolvedMinPrice != null || resolvedMaxPrice != null) {
    filter.price = {};
    if (resolvedMinPrice != null) {
      filter.price.$gte = resolvedMinPrice;
    }
    if (resolvedMaxPrice != null) {
      filter.price.$lte = resolvedMaxPrice;
    }
  }

  // Status Filter (multi-select: comma-separated, cross-collection with Auctions)
  if (status && typeof status === 'string') {
    const statuses = status.split(',').map((s) => s.trim());
    const buyNowSelected = statuses.includes('buy_now');
    const auctionStatuses = statuses.filter(
      (s): s is 'live_auction' | 'ending_soon' | 'upcoming_auction' =>
        AUCTION_PRODUCT_STATUSES.includes(s as any),
    );

    // Collect product IDs from auction statuses
    const auctionProductIds: any[] = [];

    for (const auctionStatus of auctionStatuses) {
      const now = new Date();
      let auctionFilter: any = {};

      if (auctionStatus === 'live_auction') {
        auctionFilter = { status: 'active' };
      } else if (auctionStatus === 'ending_soon') {
        const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        auctionFilter = { status: 'active', endsAt: { $lte: oneDayFromNow } };
      } else if (auctionStatus === 'upcoming_auction') {
        auctionFilter = { status: 'upcoming' };
      }

      const ids = await Auction.distinct('products', auctionFilter);
      auctionProductIds.push(...ids);
    }

    if (buyNowSelected && auctionProductIds.length > 0) {
      // Mix of buy_now and auction statuses: use $or
      filter.$or = [
        ...(filter.$or || []),
        { type: 'for_sale', inventoryStatus: 'available' },
        { _id: { $in: auctionProductIds } },
      ];
    } else if (buyNowSelected) {
      filter.type = 'for_sale';
      filter.inventoryStatus = 'available';
    } else if (auctionProductIds.length > 0) {
      filter._id = { $in: auctionProductIds };
    }
  }

  // Current Bid Filter (cross-collection with AuctionProduct)
  if (minBid != null || maxBid != null) {
    const bidFilter: any = { 'highestBid.amount': {} };
    if (minBid != null) {
      bidFilter['highestBid.amount'].$gte = Number(minBid);
    }
    if (maxBid != null) {
      bidFilter['highestBid.amount'].$lte = Number(maxBid);
    }

    const bidProductIds = await AuctionProduct.distinct('product', bidFilter);

    if (filter._id?.$in) {
      // Intersect with existing _id filter
      const existingIds = filter._id.$in;
      filter._id = {
        $in: existingIds.filter((id: any) => bidProductIds.some((bidId: any) => bidId.equals(id))),
      };
    } else {
      filter._id = { $in: bidProductIds };
    }
  }

  // Pagination
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Sorting
  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === 'asc' ? 1 : -1,
  };

  const products = await Product.find(filter)
    .populate({ path: 'categoryId', strictPopulate: false })
    .sort(sort)
    .skip(skip)
    .limit(limitNumber);

  const total = await Product.countDocuments(filter);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPage: Math.ceil(total / limitNumber),
    },
    data: products,
  };
};

const getAllCategory = async () => {
  const categories = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        categoryImage: {
          $first: '$categoryImage',
        },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        categoryImage: 1,
      },
    },
    {
      $sort: {
        category: 1,
      },
    },
  ]);

  return categories;
};

const productService = {
  createProduct,
  bulkUploadProducts,
  getAllProducts,
  getProductDetails,
  getInventoryProducts,
  getAuctionProducts,
  getInventoryMonitoring,
  browseProducts,
  updateProduct,
  deleteProduct,
  getAllCategory,
};

export default productService;
