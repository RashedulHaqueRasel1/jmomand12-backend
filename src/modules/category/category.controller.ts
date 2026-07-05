import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import categoryService from './category.service';

const createNewCategory = catchAsync(async (req, res) => {
  const file = req.file;
  const result = await categoryService.createNewCategory(req.body, file as Express.Multer.File);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Category created successfully',
    data: result,
  });
});

const getAllCategories = catchAsync(async (req, res) => {
  const result = await categoryService.getAllCategories(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Categories fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await categoryService.getSingleCategory(id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Category fetched successfully',
    data: result,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await categoryService.updateCategory(
    id as string,
    req.body,
    req.file as Express.Multer.File,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Category updated successfully',
    data: result,
  });
});

const toggleDeletedCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await categoryService.toggleDeletedCategory(id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result?.isDeleted ? 'Category deleted successfully' : 'Category restored successfully',
    data: result,
  });
});

const categoryController = {
  createNewCategory,
  getAllCategories,
  getSingleCategory,
  updateCategory,
  toggleDeletedCategory,
};

export default categoryController;
