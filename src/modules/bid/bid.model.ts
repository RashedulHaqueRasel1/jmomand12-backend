import { Schema, model } from 'mongoose';
import { IBid } from './bid.interface';

const bidSchema = new Schema<IBid>(
  {
    auction: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },

    auctionProduct: {
      type: Schema.Types.ObjectId,
      ref: 'AuctionProduct',
      required: true,
      index: true,
    },

    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    bidder: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    isWinningBid: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  },
);

// Useful indexes
bidSchema.index({ auctionProduct: 1, amount: -1 });
bidSchema.index({ auction: 1, bidder: 1 });
bidSchema.index({ auctionProduct: 1, createdAt: -1 });

const Bid = model<IBid>('Bid', bidSchema);
export default Bid;
