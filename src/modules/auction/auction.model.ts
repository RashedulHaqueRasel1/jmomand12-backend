import { Schema, model } from 'mongoose';
import { AuctionStatus, IAuction, IPickUpSchedule } from './auction.interface';

const PickUpScheduleSchema = new Schema<IPickUpSchedule>(
  {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    dailyStartTime: {
      type: String,
      required: true,
      trim: true,
    },
    dailyEndTime: {
      type: String,
      required: true,
      trim: true,
    },
    durationInDays: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

// ২. Main Auction Schema
const AuctionSchema = new Schema<IAuction>(
  {
    auctionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    products: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
    ],
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Auction Schedule
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    durationInDays: {
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
      ] as AuctionStatus[],
      default: 'upcoming',
    },

    // PickUp Schedule Sub-document
    pickupSchedule: {
      type: PickUpScheduleSchema,
      required: false,
    },

    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

AuctionSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
AuctionSchema.index({ products: 1 });

// ৪. Export Mongoose Model
const Auction = model<IAuction>('Auction', AuctionSchema);
export default Auction;
