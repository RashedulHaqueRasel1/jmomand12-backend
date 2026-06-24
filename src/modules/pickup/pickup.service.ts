import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import Invoice from '../invoice/invoice.model';
import Product from '../product/product.model';
import { User } from '../user/user.model';
import { PickupAppointment, PickupSlot } from './pickup.model';

const createSlot = async (payload: {
  startsAt: Date;
  endsAt: Date;
  maxCustomers: number;
  maxItems: number;
}) => {
  const startsAt = new Date(payload.startsAt);
  const endsAt = new Date(payload.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new AppError('Pickup slot start time must be before end time', StatusCodes.BAD_REQUEST);
  }

  return PickupSlot.create({
    startsAt,
    endsAt,
    maxCustomers: payload.maxCustomers,
    maxItems: payload.maxItems,
  });
};

const getAvailableSlots = async () => {
  return PickupSlot.find({
    isActive: true,
    startsAt: { $gt: new Date() },
    $expr: {
      $and: [
        { $lt: ['$bookedCustomers', '$maxCustomers'] },
        { $lt: ['$bookedItems', '$maxItems'] },
      ],
    },
  }).sort({ startsAt: 1 });
};

const getAllSlots = async () => {
  return PickupSlot.find().sort({ startsAt: 1 });
};

const getMyReadyInvoices = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  const scheduledAppointments = await PickupAppointment.find({
    customer: user._id,
    status: { $in: ['scheduled', 'picked_up', 'completed'] },
  }).select('invoices');

  const scheduledInvoiceIds = scheduledAppointments.flatMap((appointment) =>
    appointment.invoices.map((invoiceId) => invoiceId.toString()),
  );

  return Invoice.find({
    customer: user._id,
    status: 'paid',
    _id: { $nin: scheduledInvoiceIds },
  })
    .populate('product')
    .sort({ paidAt: -1 });
};

const schedulePickup = async (
  email: string,
  payload: {
    slotId: string;
    invoiceIds: string[];
  },
) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  const uniqueInvoiceIds = Array.from(new Set(payload.invoiceIds || []));
  if (!uniqueInvoiceIds.length) {
    throw new AppError('At least one invoice is required', StatusCodes.BAD_REQUEST);
  }

  const invoices = await Invoice.find({
    _id: { $in: uniqueInvoiceIds },
    customer: user._id,
    status: 'paid',
  });

  if (invoices.length !== uniqueInvoiceIds.length) {
    throw new AppError('Only paid invoices owned by you can be scheduled', StatusCodes.BAD_REQUEST);
  }

  const existingAppointment = await PickupAppointment.findOne({
    invoices: { $in: uniqueInvoiceIds },
    status: { $ne: 'cancelled' },
  });

  if (existingAppointment) {
    throw new AppError('One or more items are already scheduled for pickup', StatusCodes.CONFLICT);
  }

  const slot = await PickupSlot.findOneAndUpdate(
    {
      _id: payload.slotId,
      isActive: true,
      startsAt: { $gt: new Date() },
      $expr: {
        $and: [
          { $lt: ['$bookedCustomers', '$maxCustomers'] },
          { $lte: [{ $add: ['$bookedItems', invoices.length] }, '$maxItems'] },
        ],
      },
    },
    {
      $inc: {
        bookedCustomers: 1,
        bookedItems: invoices.length,
      },
    },
    { new: true },
  );

  if (!slot) {
    throw new AppError('Pickup slot is full or unavailable', StatusCodes.BAD_REQUEST);
  }

  const products = invoices.map((invoice) => invoice.product as Types.ObjectId);
  const pickupCode = invoices.length === 1 ? invoices[0].pickupCode : invoices[0].pickupCode;

  const appointment = await PickupAppointment.create({
    customer: user._id,
    slot: slot._id,
    invoices: invoices.map((invoice) => invoice._id),
    products,
    pickupCode,
    status: 'scheduled',
  });

  await Product.updateMany(
    { _id: { $in: products } },
    {
      inventoryStatus: 'pickup_scheduled',
    },
  );

  return appointment.populate([
    { path: 'slot' },
    { path: 'invoices' },
    { path: 'products' },
  ]);
};

const getMyAppointments = async (email: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  return PickupAppointment.find({ customer: user._id })
    .populate('slot')
    .populate('invoices')
    .populate('products')
    .sort({ createdAt: -1 });
};

const getAllAppointments = async () => {
  return PickupAppointment.find()
    .populate('customer', 'firstName lastName email phone')
    .populate('slot')
    .populate('invoices')
    .populate('products')
    .sort({ createdAt: -1 });
};

const completePickup = async (
  adminEmail: string,
  payload: {
    appointmentId?: string;
    pickupCode?: string;
    notes?: string;
  },
) => {
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    throw new AppError('Admin account not found', StatusCodes.FORBIDDEN);
  }

  const query = payload.appointmentId
    ? { _id: payload.appointmentId }
    : { pickupCode: payload.pickupCode?.toUpperCase() };

  const appointment = await PickupAppointment.findOne(query);
  if (!appointment) {
    throw new AppError('Pickup appointment not found', StatusCodes.NOT_FOUND);
  }

  if (appointment.status === 'completed') {
    return appointment;
  }

  appointment.status = 'completed';
  appointment.pickedUpAt = new Date();
  appointment.completedAt = new Date();
  appointment.verifiedBy = admin._id as unknown as Types.ObjectId;
  appointment.notes = payload.notes;
  await appointment.save();

  await Product.updateMany(
    { _id: { $in: appointment.products } },
    {
      inventoryStatus: 'completed',
    },
  );

  return appointment.populate([
    { path: 'customer', select: 'firstName lastName email phone' },
    { path: 'slot' },
    { path: 'invoices' },
    { path: 'products' },
  ]);
};

const pickupService = {
  createSlot,
  getAvailableSlots,
  getAllSlots,
  getMyReadyInvoices,
  schedulePickup,
  getMyAppointments,
  getAllAppointments,
  completePickup,
};

export default pickupService;
