import { Document, Types } from 'mongoose';

export interface IPaymentRetry extends Document {
  auctionProductId: Types.ObjectId;
  auctionId: Types.ObjectId;
  winnerId: Types.ObjectId;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  failureReason?: string;
  stripePaymentIntentId?: string;
  productTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}
