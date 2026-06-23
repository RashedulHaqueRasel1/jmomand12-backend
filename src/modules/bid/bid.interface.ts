import { Types } from 'mongoose';

export interface IBid {
  auction: Types.ObjectId;
  product: Types.ObjectId;
  bidder: Types.ObjectId;
  amount: number;
}
