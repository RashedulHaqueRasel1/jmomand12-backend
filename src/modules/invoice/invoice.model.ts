import { Schema, model } from 'mongoose';
import { IInvoice } from './invoice.interface';

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    auction: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    inventoryId: {
      type: String,
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
      enum: ['payment_pending', 'paid', 'payment_failed', 'void'],
      default: 'payment_pending',
      index: true,
    },
    stripePaymentIntentId: String,
    pickupCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pickupTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pickupQrDataUrl: String,
    paidAt: Date,
    paymentFailureReason: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Invoice = model<IInvoice>('Invoice', invoiceSchema);
export default Invoice;
