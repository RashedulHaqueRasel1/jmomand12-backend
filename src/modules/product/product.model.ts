import { Schema, model } from 'mongoose';
import { IProduct } from './product.interface';

const imageSchema = new Schema(
  {
    public_id: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const productSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    categoryId: {
      type: Schema.ObjectId,
    },

    condition: {
      type: String,
      required: true,
      enum: ['new', 'open_box', 'like_new', 'used', 'damaged', 'for_parts'],
    },

    inventoryStatus: {
      type: String,
      enum: ['available', 'unavailable'],
      default: 'available',
    },

    images: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (images: unknown[]) => images.length > 0,
        message: 'At least one product image is required',
      },
    },

    totalReview: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageReview: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Product = model<IProduct>('Product', productSchema);
export default Product;
