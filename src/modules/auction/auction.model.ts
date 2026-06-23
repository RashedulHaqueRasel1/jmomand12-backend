import { Schema, model } from 'mongoose';
import { IAuction } from './auction.interface';

const auctionSchema = new Schema<IAuction>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
      index: true,
    },
    startingBid: {
      type: Number,
      required: true,
      min: 0,
    },
    bidIncrement: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    reservePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'scheduled',
        'active',
        'ended',
        'payment_pending',
        'payment_failed',
        'sold',
        'unsold',
        'cancelled',
      ],
      default: 'scheduled',
      index: true,
    },
    highestBid: {
      bidder: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
      bid: {
        type: Schema.Types.ObjectId,
        ref: 'Bid',
      },
      placedAt: {
        type: Date,
      },
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    closedAt: Date,
    closeReason: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

auctionSchema.index({ status: 1, startsAt: 1, endsAt: 1 });

const Auction = model<IAuction>('Auction', auctionSchema);
export default Auction;
