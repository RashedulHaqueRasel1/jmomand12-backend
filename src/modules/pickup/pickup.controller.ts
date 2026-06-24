import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pickupService from './pickup.service';

const createSlot = catchAsync(async (req, res) => {
  const result = await pickupService.createSlot(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup slot created successfully',
    data: result,
  });
});

const getAvailableSlots = catchAsync(async (_req, res) => {
  const result = await pickupService.getAvailableSlots();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Available pickup slots fetched successfully',
    data: result,
  });
});

const getAllSlots = catchAsync(async (_req, res) => {
  const result = await pickupService.getAllSlots();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup slots fetched successfully',
    data: result,
  });
});

const getMyReadyInvoices = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await pickupService.getMyReadyInvoices(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Ready pickup invoices fetched successfully',
    data: result,
  });
});

const schedulePickup = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await pickupService.schedulePickup(email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup scheduled successfully',
    data: result,
  });
});

const getMyAppointments = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await pickupService.getMyAppointments(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup appointments fetched successfully',
    data: result,
  });
});

const getAllAppointments = catchAsync(async (_req, res) => {
  const result = await pickupService.getAllAppointments();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup appointments fetched successfully',
    data: result,
  });
});

const completePickup = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await pickupService.completePickup(email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup completed successfully',
    data: result,
  });
});

const pickupController = {
  createSlot,
  getAvailableSlots,
  getAllSlots,
  getMyReadyInvoices,
  schedulePickup,
  getMyAppointments,
  getAllAppointments,
  completePickup,
};

export default pickupController;
