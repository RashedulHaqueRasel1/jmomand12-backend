import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import cartService from './cart.service';

const addToCartOrWishlist = catchAsync(async (req, res) => {
  const result = await cartService.addToCartOrWishlist(req.user.email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message:
      req.body.type === 'cart'
        ? 'Product added to cart successfully'
        : 'Product added to wishlist successfully',
    data: result,
  });
});

const getMyCartItems = catchAsync(async (req, res) => {
  const result = await cartService.getMyCartItems(req.user.email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Cart items retrieved successfully',
    data: result,
  });
});

const getMyWishListItems = catchAsync(async (req, res) => {
  const result = await cartService.getMyWishListItems(req.user.email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Wishlist items retrieved successfully',
    data: result,
  });
});

const cartController = {
  addToCartOrWishlist,
  getMyCartItems,
  getMyWishListItems,
};

export default cartController;
