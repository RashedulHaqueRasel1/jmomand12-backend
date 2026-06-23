import { Types } from 'mongoose';

export type InvoiceStatus = 'payment_pending' | 'paid' | 'payment_failed' | 'void';

export interface IInvoice {
  invoiceNumber: string;
  auction: Types.ObjectId;
  product: Types.ObjectId;
  customer: Types.ObjectId;
  inventoryId: string;
  amount: number;
  status: InvoiceStatus;
  stripePaymentIntentId?: string;
  pickupCode: string;
  pickupTokenHash: string;
  pickupQrDataUrl?: string;
  paidAt?: Date;
  paymentFailureReason?: string;
}
