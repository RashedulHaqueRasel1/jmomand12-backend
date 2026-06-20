import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { IProduct } from './product.interface';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';
import Product from './product.model';

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
  const result = await Product.findById(id);
  return result;
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

const productService = {
  createProduct,
  getAllProducts,
  getProductDetails,
  updateProduct,
};

export default productService;
