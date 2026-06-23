import { Schema, model } from 'mongoose';
import { IPickupAppointment, IPickupSlot } from './pickup.interface';

const pickupSlotSchema = new Schema<IPickupSlot>(
  {
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    maxCustomers: {
      type: Number,
      required: true,
      min: 1,
    },
    maxItems: {
      type: Number,
      required: true,
      min: 1,
    },
    bookedCustomers: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookedItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const pickupAppointmentSchema = new Schema<IPickupAppointment>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    slot: {
      type: Schema.Types.ObjectId,
      ref: 'PickupSlot',
      required: true,
      index: true,
    },
    invoices: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Invoice',
        required: true,
      },
    ],
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
    ],
    pickupCode: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'picked_up', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    pickedUpAt: Date,
    completedAt: Date,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const PickupSlot = model<IPickupSlot>('PickupSlot', pickupSlotSchema);
export const PickupAppointment = model<IPickupAppointment>(
  'PickupAppointment',
  pickupAppointmentSchema,
);
