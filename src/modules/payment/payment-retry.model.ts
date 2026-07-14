import { Schema, model } from 'mongoose';
import { IPaymentRetry } from './payment.interface';

const paymentRetrySchema = new Schema<IPaymentRetry>(
  {
    auctionProductId: {
      type: Schema.Types.ObjectId,
      ref: 'AuctionProduct',
      required: true,
      index: true,
    },
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    winnerId: {
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
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 1,
    },
    lastAttemptAt: {
      type: Date,
    },
    nextRetryAt: {
      type: Date,
      index: true,
    },
    failureReason: {
      type: String,
    },
    stripePaymentIntentId: {
      type: String,
    },
    productTitle: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const PaymentRetry = model<IPaymentRetry>('PaymentRetry', paymentRetrySchema);

export default PaymentRetry;
