import { Types } from 'mongoose';

export type AuctionStatus =
  | 'scheduled'
  | 'active'
  | 'ended'
  | 'payment_pending'
  | 'payment_failed'
  | 'sold'
  | 'unsold'
  | 'cancelled';


  

export interface IAuction {
  product: Types.ObjectId;
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  startingBid: number;
  bidIncrement: number;
  reservePrice: number;
  status: AuctionStatus;
  highestBid?: {
    bidder?: Types.ObjectId;
    amount: number;
    bid?: Types.ObjectId;
    placedAt?: Date;
  };
  winner?: Types.ObjectId;
  closedAt?: Date;
  closeReason?: string;
}
