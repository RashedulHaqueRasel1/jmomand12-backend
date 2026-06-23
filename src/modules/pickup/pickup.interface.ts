import { Types } from 'mongoose';

export type PickupAppointmentStatus = 'scheduled' | 'picked_up' | 'completed' | 'cancelled';

export interface IPickupSlot {
  startsAt: Date;
  endsAt: Date;
  maxCustomers: number;
  maxItems: number;
  bookedCustomers: number;
  bookedItems: number;
  isActive: boolean;
}

export interface IPickupAppointment {
  customer: Types.ObjectId;
  slot: Types.ObjectId;
  invoices: Types.ObjectId[];
  products: Types.ObjectId[];
  pickupCode: string;
  status: PickupAppointmentStatus;
  pickedUpAt?: Date;
  completedAt?: Date;
  verifiedBy?: Types.ObjectId;
  notes?: string;
}
