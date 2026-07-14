import { Types } from 'mongoose';

export type TCartType = 'cart' | 'wishlist';

export interface ICart {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  type: TCartType;
  quantity?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
