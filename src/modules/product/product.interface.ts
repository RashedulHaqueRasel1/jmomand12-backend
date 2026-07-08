import { Types } from 'mongoose';

export type ProductCondition = 'new' | 'open_box' | 'like_new' | 'used' | 'damaged' | 'for_parts';

export interface IProduct {
  inventoryId: string;
  title: string;
  description: string;
  category: string;
  condition: ProductCondition;
  reservePrice: number;
  retailPrice?: number;
  day: string;
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
  color: [string];
  totalReview: number;
  averageReview: number;
}

export interface IBulkProductRow {
  title: string;
  description: string;
  day: string;
  category: string;
  condition: string;
  reservePrice: number;
  retailPrice?: number;
  color: string[];
  imageFolder: string;
}

export interface IBulkUploadSuccess {
  row: number;
  title: string;
  inventoryId: string;
  productId: string;
}

export interface IBulkUploadFailure {
  row: number;
  title?: string;
  error: string;
}

export interface IBulkUploadResult {
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  success: IBulkUploadSuccess[];
  failed: IBulkUploadFailure[];
}
