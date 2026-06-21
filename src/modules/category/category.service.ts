import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { ICategory } from './category.interface';
import Category from './category.model';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary';

const createNewCategory = async (payload: Partial<ICategory>, file: Express.Multer.File) => {
  const isExist = await Category.findOne({
    name: payload.name,
    isDeleted: false,
  });

  if (isExist) {
    throw new AppError('Category already exists', StatusCodes.BAD_REQUEST);
  }

  if (!file) {
    throw new AppError('Category image is required', StatusCodes.BAD_REQUEST);
  }

  const cloudinaryResponse = await uploadToCloudinary(file.path, 'categories');

  const categoryData = {
    name: payload.name,
    image: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  };

  const result = await Category.create(categoryData);

  return result;
};
const getAllCategories = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const searchTerm = (query.searchTerm as string) || '';

  const filter = {
    isDeleted: false,
    ...(searchTerm && {
      name: {
        $regex: searchTerm,
        $options: 'i',
      },
    }),
  };

  const [data, total] = await Promise.all([
    Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data,
  };
};

const getSingleCategory = async (categoryId: string) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }
  return category;
};

const updateCategory = async (
  categoryId: string,
  payload: Partial<ICategory>,
  file?: Express.Multer.File,
) => {
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Duplicate name check
  if (payload.name && payload.name !== category.name) {
    const existingCategory = await Category.findOne({
      name: payload.name,
      isDeleted: false,
      _id: { $ne: categoryId },
    });

    if (existingCategory) {
      throw new AppError('Category name already exists', StatusCodes.BAD_REQUEST);
    }
  }

  // Update image
  if (file) {
    if (category.image?.public_id) {
      await deleteFromCloudinary(category.image.public_id);
    }

    const uploadedImage = await uploadToCloudinary(file.path, 'categories');

    payload.image = {
      public_id: uploadedImage.public_id,
      url: uploadedImage.secure_url,
    };
  }

  const result = await Category.findByIdAndUpdate(categoryId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const toggleDeletedCategory = async (categoryId: string) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }

  // Optional: Prevent deletion if products exist
  if (!category.isDeleted && category.totalProduct > 0) {
    throw new AppError('Cannot delete category with existing products', StatusCodes.BAD_REQUEST);
  }

  const result = await Category.findByIdAndUpdate(
    categoryId,
    {
      isDeleted: !category.isDeleted,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  return result;
};

const categoryService = {
  createNewCategory,
  getAllCategories,
  getSingleCategory,
  updateCategory,
  toggleDeletedCategory,
};

export default categoryService;
