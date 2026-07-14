import { Types } from 'mongoose';

export type AuctionProductStatus =
  | 'upcoming'
  | 'active'
  | 'ended'
  | 'payment_pending'
  | 'payment_failed'
  | 'sold'
  | 'unsold'
  | 'cancelled';

export interface IAuctionHighestBid {
  bidder?: Types.ObjectId;
  bid?: Types.ObjectId;
  amount: number;
  placedAt?: Date;
}

export interface IAuctionProduct {
  auctionId: Types.ObjectId;
  productId: Types.ObjectId;
  startingBid: number;
  reservePrice?: number;
  bidIncrement: number;
  status: AuctionProductStatus;
  highestBid: IAuctionHighestBid;
  winner?: Types.ObjectId;
  soldPrice?: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  pickupStatus: 'pending' | 'scheduled' | 'completed';
  closedAt?: Date;
  paymentRetryCount?: number;
  lastPaymentRetryAt?: Date;
}
