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
    inventoryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

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

    category: {
      type: String,
      required: true,
      trim: true,
    },

    categoryImage: {
      public_id: {
        type: String,
        trim: true,
      },
      url: {
        type: String,
        trim: true,
      },
    },

    condition: {
      type: String,
      required: true,
      enum: [
        'new',
        'open_box',
        'like_new',
        'used',
        'damaged',
        'for_parts',
        'brand_new',
        'like_new_open_box',
        'scratch_and_dent',
        'salvage',
      ],
    },
    day: { type: String, trim: true },
    reservePrice: {
      type: Number,
      min: 0,
    },

    inventoryStatus: {
      type: String,
      enum: [
        'available',
        'auction_active',
        'auction_ended',
        'winner_assigned',
        'payment_pending',
        'payment_completed',
        'ready_for_pickup',
        'pickup_scheduled',
        'picked_up',
        'completed',
        'unsold',
        'unavailable',
      ],
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
    type: {
      type: String,
      enum: ['for_sale', 'for_auction'],
    },
    color: {
      type: [String],
      default: [],
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      min: 1,
    },
    manufacturer: {
      type: String,
      trim: true,
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

productSchema.pre('validate', function (next) {
  if (this.type === 'for_sale') {
    if (this.price == null) {
      return next(new Error('Price is required for sale products'));
    }

    if (this.quantity == null || this.quantity <= 0) {
      return next(new Error('Quantity is required for sale products'));
    }
  }

  next();
});

const Product = model<IProduct>('Product', productSchema);
export default Product;
