import { Schema, model } from 'mongoose';
import { ICart } from './cart.interface';

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['cart', 'wishlist'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Prevent duplicate entries for the same user, product, and type
cartSchema.index({ userId: 1, productId: 1, type: 1 }, { unique: true });

// Ensure wishlist items don't store a quantity
cartSchema.pre('save', function (next) {
  if (this.type === 'wishlist') {
    this.quantity = undefined;
  }

  next();
});

export const Cart = model<ICart>('Cart', cartSchema);
