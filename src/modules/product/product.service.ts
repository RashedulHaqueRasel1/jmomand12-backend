import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { IBulkUploadResult, IProduct } from './product.interface';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import Product from './product.model';
import Category from '../category/category.model';
import fs from 'fs';
import pLimit from 'p-limit';
import {
  findDirRecursive,
  findFileRecursive,
  generateInventoryIdsBatch,
  listImageFiles,
  parseProductsCsv,
  safeCleanup,
  validateProductRowShape,
} from '../../utils/product.utils';
import path from 'path';
import AdmZip from 'adm-zip';
import { v4 as uuid } from 'uuid';
import os from 'os';

const generateInventoryId = async () => {
  const year = new Date().getFullYear();
  const count = await Product.countDocuments({
    inventoryId: { $regex: `^AUC-${year}-` },
  });

  return `AUC-${year}-${String(count + 1).padStart(4, '0')}`;
};

const createProduct = async (
  payload: Partial<IProduct>,
  email: string,
  files: Express.Multer.File[],
) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('Your account is not found', StatusCodes.FORBIDDEN);
  }

  if (!files?.length) {
    throw new AppError('At least one product image is required', StatusCodes.BAD_REQUEST);
  }

  const uploadedImages = await Promise.all(
    files.map(async (file) => {
      const image = await uploadToCloudinary(file.path, 'products');

      return {
        public_id: image.public_id,
        url: image.secure_url,
      };
    }),
  );

  const productData = {
    ...payload,
    inventoryId: payload.inventoryId || (await generateInventoryId()),
    category: payload.category,
    day: payload.day,
    images: uploadedImages,
    inventoryStatus: 'available',
    totalReview: 0,
    averageReview: 0,
  };

  const result = await Product.create(productData);
  return result;
};

const IMAGE_UPLOAD_CONCURRENCY = 10;
const MAX_PRODUCTS_PER_BATCH = 1000;

const bulkUploadProducts = async (
  zipFile: Express.Multer.File,
  email: string,
): Promise<IBulkUploadResult> => {
  if (!zipFile) {
    throw new AppError('A ZIP file is required', StatusCodes.BAD_REQUEST);
  }

  const user = await User.findOne({ email });
  if (!user) {
    safeCleanup(zipFile.path);
    throw new AppError('Your account is not found', StatusCodes.FORBIDDEN);
  }

  const extractDir = path.join(os.tmpdir(), `bulk-upload-${uuid()}`);

  try {
    fs.mkdirSync(extractDir, { recursive: true });

    // 1. Extract ZIP
    try {
      new AdmZip(zipFile.path).extractAllTo(extractDir, true);
    } catch {
      throw new AppError('Uploaded file is not a valid ZIP archive', StatusCodes.BAD_REQUEST);
    }

    // 2. Locate products.csv and images/ directory anywhere in the archive
    const csvPath = findFileRecursive(extractDir, 'products.csv');
    if (!csvPath) {
      throw new AppError('products.csv not found in the ZIP archive', StatusCodes.BAD_REQUEST);
    }

    const imagesRootDir = findDirRecursive(extractDir, 'images');
    if (!imagesRootDir) {
      throw new AppError('images/ folder not found in the ZIP archive', StatusCodes.BAD_REQUEST);
    }

    // 3. Parse CSV
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

    // 5. Reserve inventory IDs for the whole batch in one atomic DB call
    const inventoryIds = await generateInventoryIdsBatch(rows.length);

    // 6. Process every row independently; a single image upload failure or
    // missing folder must not abort the batch
    const limit = pLimit(IMAGE_UPLOAD_CONCURRENCY);
    const result: IBulkUploadResult = {
      totalProcessed: rows.length,
      totalSucceeded: 0,
      totalFailed: 0,
      success: [],
      failed: [],
    };

    const documentsToInsert: any[] = [];
    const metaByInsertIndex: Array<{ row: number; title: string }> = [];

    await Promise.all(
      rows.map(async (row, idx) => {
        try {
          const shapeError = validateProductRowShape(row);
          if (shapeError) throw new Error(shapeError);

          const folderPath = path.join(imagesRootDir, row.imageFolder);
          if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
            throw new Error(`Image folder "${row.imageFolder}" not found`);
          }

          const imageFilePaths = listImageFiles(folderPath);
          if (!imageFilePaths.length) {
            throw new Error(`No images found in folder "${row.imageFolder}"`);
          }

          // Concurrency-limited globally across the whole batch, not per product,
          // so total simultaneous Cloudinary calls never exceed the cap.
          const uploadedImages = await Promise.all(
            imageFilePaths.map((filePath) =>
              limit(async () => {
                const image = await uploadToCloudinary(filePath, 'products');
                return { public_id: image.public_id, url: image.secure_url };
              }),
            ),
          );

          documentsToInsert.push({
            title: row.title,
            description: row.description,
            categoryId: row.category,
            condition: row.condition,
            reservePrice: row.reservePrice,
            retailPrice: row.retailPrice,
            color: row.color,
            day: row.day,
            inventoryId: inventoryIds[idx],
            images: uploadedImages,
            inventoryStatus: 'available',
            totalReview: 0,
            averageReview: 0,
          });
          metaByInsertIndex.push({ row: row.row, title: row.title });
        } catch (err) {
          result.failed.push({
            row: row.row,
            title: row.title,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }),
    );

    // 7. Bulk insert survivors. ordered:false ensures a single duplicate-key
    // or validation error doesn't block the rest of the batch.
    if (documentsToInsert.length) {
      try {
        const inserted = await Product.insertMany(documentsToInsert, { ordered: false });
        inserted.forEach((doc: any, i: number) => {
          result.success.push({
            row: metaByInsertIndex[i].row,
            title: metaByInsertIndex[i].title,
            inventoryId: doc.inventoryId,
            productId: String(doc._id),
          });
        });
      } catch (bulkErr: any) {
        (bulkErr.insertedDocs || []).forEach((doc: any) => {
          const idx = documentsToInsert.findIndex((d) => d.inventoryId === doc.inventoryId);
          result.success.push({
            row: metaByInsertIndex[idx]?.row,
            title: metaByInsertIndex[idx]?.title,
            inventoryId: doc.inventoryId,
            productId: String(doc._id),
          });
        });
        (bulkErr.writeErrors || []).forEach((e: any) => {
          const meta = metaByInsertIndex[e.index];
          result.failed.push({
            row: meta?.row ?? -1,
            title: meta?.title,
            error: e.errmsg || e.err?.errmsg || 'Insert failed',
          });
        });
      }
    }

    result.totalSucceeded = result.success.length;
    result.totalFailed = result.failed.length;

    return result;
  } finally {
    // Always clean up, success or failure — extracted files and the zip
    // itself can be large and must not accumulate on disk.
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
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
    fields,
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
    .populate('categoryId')
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
  const result = await Product.findById(id).populate('categoryId');
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

const productService = {
  createProduct,
  bulkUploadProducts,
  getAllProducts,
  getProductDetails,
  getInventoryMonitoring,
  updateProduct,
  deleteProduct,
};

export default productService;
