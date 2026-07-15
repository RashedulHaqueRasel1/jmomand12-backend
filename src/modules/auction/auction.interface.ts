import { Types } from 'mongoose';

export type AuctionStatus =
  | 'upcoming'
  | 'active'
  | 'ended'
  | 'payment_pending'
  | 'payment_failed'
  | 'sold'
  | 'unsold'
  | 'cancelled';

export interface IPickUpSchedule {
  startDate: Date;
  endDate: Date;
  dailyStartTime: string;
  dailyEndTime: string;
  durationInDays: number;
}

export interface IAuction {
  auctionId: string;
  products: Types.ObjectId[];
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  durationInDays: number;
  status: AuctionStatus;
  pickupSchedule?: IPickUpSchedule;
  winner?: Types.ObjectId;
}

export interface IDayAvailability {
  day: string;
  date: string;
  auctionCount: number;
}
