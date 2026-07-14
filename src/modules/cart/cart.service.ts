import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import Product from '../product/product.model';
import { User } from '../user/user.model';
import { ICart } from './cart.interface';
import { Cart } from './cart.model';

const addToCartOrWishlist = async (email: string, payload: ICart) => {
  const { productId, quantity = 1, type } = payload;

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  // Find product
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  }

  // Only for_sale products can be added
  if (product.type !== 'for_sale') {
    throw new AppError(
      'Only for sale products can be added to cart or wishlist',
      StatusCodes.BAD_REQUEST,
    );
  }

  // Stock validation (only for cart)
  if (type === 'cart') {
    if (!product.quantity || product.quantity <= 0) {
      throw new AppError('Product is out of stock', StatusCodes.BAD_REQUEST);
    }

    if (quantity > product.quantity) {
      throw new AppError(
        `Only ${product.quantity} item(s) available in stock`,
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  // Check existing cart/wishlist item
  const existingItem = await Cart.findOne({
    userId: user._id,
    productId,
    type,
  });

  if (existingItem) {
    if (type === 'cart') {
      const newQuantity = (existingItem.quantity || 1) + quantity;

      if (newQuantity > (product.quantity || 0)) {
        throw new AppError(
          `Only ${product.quantity} item(s) available in stock`,
          StatusCodes.BAD_REQUEST,
        );
      }

      existingItem.quantity = newQuantity;
      await existingItem.save();

      return existingItem;
    }

    throw new AppError('Product already exists in wishlist', StatusCodes.BAD_REQUEST);
  }

  // Create new cart/wishlist item
  const newItem = await Cart.create({
    userId: user._id,
    productId,
    type,
    ...(type === 'cart' && { quantity }),
  });

  return newItem;
};

const getMyCartItems = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  const cartItems = await Cart.find({ userId: user._id, type: 'cart' }).populate('productId');

  return cartItems;
};

const getMyWishListItems = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  const wishListItems = await Cart.find({ userId: user._id, type: 'wishlist' }).populate(
    'productId',
  );

  return wishListItems;
};

const cartService = {
  addToCartOrWishlist,
  getMyCartItems,
  getMyWishListItems,
};

export default cartService;
