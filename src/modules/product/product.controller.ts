import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import productService from './product.service';

const creteNewProduct = catchAsync(async (req, res) => {
  const { email } = req.user;
  const files = req.files;
  const result = await productService.createProduct(
    req.body,
    email,
    files as Express.Multer.File[],
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'New product created successfully',
    data: result,
  });
});

const getAllProducts = catchAsync(async (req, res) => {
  const result = await productService.getAllProducts(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Products fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getProductDetails = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await productService.getProductDetails(id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product details fetched successfully',
    data: result,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];

  const result = await productService.updateProduct(id as string, req.body, email, files);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product updated successfully',
    data: result,
  });
});

const productController = {
  creteNewProduct,
  getAllProducts,
  getProductDetails,
  updateProduct,
};

export default productController;
