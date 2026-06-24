import { Types } from 'mongoose';

export type ProductCondition = 'new' | 'open_box' | 'like_new' | 'used' | 'damaged' | 'for_parts';

export interface IProduct {
  inventoryId: string;
  title: string;
  description: string;
  categoryId: Types.ObjectId;
  condition: ProductCondition;
  reservePrice: number;
  retailPrice?: number;
  inventoryStatus:
    | 'available'
    | 'auction_active'
    | 'auction_ended'
    | 'winner_assigned'
    | 'payment_pending'
    | 'payment_completed'
    | 'ready_for_pickup'
    | 'pickup_scheduled'
    | 'picked_up'
    | 'completed'
    | 'unsold'
    | 'unavailable';
  images: {
    public_id: string;
    url: string;
  }[];
  totalReview: number;
  averageReview: number;
}
