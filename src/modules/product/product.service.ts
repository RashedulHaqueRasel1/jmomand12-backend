import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { IProduct } from './product.interface';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import Product from './product.model';
import Category from '../category/category.model';

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

  const category = await Category.findById(payload.categoryId);
  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
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
    images: uploadedImages,
    inventoryStatus: 'available',
    totalReview: 0,
    averageReview: 0,
  };

  const result = await Product.create(productData);
  return result;
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

  const category = await Category.findById(payload.categoryId);
  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
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
  getAllProducts,
  getProductDetails,
  getInventoryMonitoring,
  updateProduct,
  deleteProduct,
};

export default productService;
