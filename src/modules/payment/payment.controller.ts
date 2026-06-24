import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import paymentService from './payment.service';

const createSetupIntent = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await paymentService.createSetupIntent(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stripe setup intent created successfully',
    data: result,
  });
});

const getSetupIntentStatus = catchAsync(async (req, res) => {
  const { email } = req.user;
  const setupIntentId = String(req.params.setupIntentId || '');
  const result = await paymentService.getSetupIntentStatus(email, setupIntentId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stripe setup intent status fetched successfully',
    data: result,
  });
});

const saveDefaultPaymentMethod = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await paymentService.saveDefaultPaymentMethod(email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Default payment method saved successfully',
    data: result,
  });
});

const createTestDefaultPaymentMethod = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await paymentService.createTestDefaultPaymentMethod(email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Test default payment method saved successfully',
    data: result,
  });
});

const paymentController = {
  createSetupIntent,
  getSetupIntentStatus,
  saveDefaultPaymentMethod,
  createTestDefaultPaymentMethod,
};

export default paymentController;
