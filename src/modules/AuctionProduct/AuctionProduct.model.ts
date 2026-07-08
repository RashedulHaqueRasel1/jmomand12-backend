import { Schema, model } from 'mongoose';
import { IAuctionProduct } from './AuctionProduct.interface';

const highestBidSchema = new Schema(
  {
    bidder: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    bid: {
      type: Schema.Types.ObjectId,
      ref: 'Bid',
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    placedAt: {
      type: Date,
    },
  },
  {
    _id: false,
  },
);

const auctionProductSchema = new Schema<IAuctionProduct>(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    startingBid: {
      type: Number,
      required: true,
      min: 0,
    },

    reservePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    bidIncrement: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: [
        'upcoming',
        'active',
        'ended',
        'payment_pending',
        'payment_failed',
        'sold',
        'unsold',
        'cancelled',
      ],
      default: 'upcoming',
    },

    highestBid: {
      type: highestBidSchema,
      default: {
        amount: 0,
      },
    },

    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    soldPrice: {
      type: Number,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },

    pickupStatus: {
      type: String,
      enum: ['pending', 'scheduled', 'completed'],
      default: 'pending',
    },

    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Prevent the same product from being added to the same auction twice
auctionProductSchema.index({ auctionId: 1, productId: 1 }, { unique: true });

const AuctionProduct = model<IAuctionProduct>('AuctionProduct', auctionProductSchema);

export default AuctionProduct;
