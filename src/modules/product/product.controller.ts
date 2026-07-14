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

const productBulkUpload = catchAsync(async (req, res) => {
  const { email } = req.user;
  const zipFile = req.file as Express.Multer.File;
  const type = (req.body.type || req.query.type) as 'for_sale' | 'for_auction';
  const result = await productService.bulkUploadProducts(zipFile, email, type);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Bulk product upload processed',
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

const getInventoryMonitoring = catchAsync(async (req, res) => {
  const result = await productService.getInventoryMonitoring(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Inventory monitoring fetched successfully',
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

const deleteProduct = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { id } = req.params;

  const result = await productService.deleteProduct(id as string, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Product deleted successfully',
    data: result,
    links: {
      products: '/api/v1/products',
      inventoryMonitoring: '/api/v1/products/inventory-monitoring',
    },
  });
});

const getInventoryProducts = catchAsync(async (req, res) => {
  const result = await productService.getInventoryProducts(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Inventory products fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getAuctionProducts = catchAsync(async (req, res) => {
  const result = await productService.getAuctionProducts(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction products fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const browseProducts = catchAsync(async (req, res) => {
  const result = await productService.browseProducts(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Products browsed successfully',
    meta: result.meta,
    data: result.data,
  });
});

const productController = {
  creteNewProduct,
  productBulkUpload,
  getAllProducts,
  getProductDetails,
  getInventoryProducts,
  getAuctionProducts,
  getInventoryMonitoring,
  browseProducts,
  updateProduct,
  deleteProduct,
};

export default productController;
