import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import paymentService from './payment.service';
import config from '../../config';
import Stripe from 'stripe';

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

const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const body = req.body;

  if (!signature || !config.stripe.webhookSecret) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Missing webhook signature or webhook secret not configured',
    });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(config.stripe.secretKey as string, {
      apiVersion: '2025-08-27.basil',
    });

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      config.stripe.webhookSecret as string,
    );
  } catch (error: any) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: `Webhook Error: ${error.message}`,
    });
  }

  // Handle different webhook events
  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      // Payment succeeded - update records
      // This is informational as the payment retry service already handles it
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      // Payment failed - could trigger notifications
    } else if (event.type === 'charge.refunded') {
      // Handle refund events
    } else if (event.type === 'customer.deleted') {
      // Handle customer deletion
    }

    res.json({
      received: true,
      eventType: event.type,
    });
  } catch (error: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message,
    });
  }
};

const paymentController = {
  createSetupIntent,
  getSetupIntentStatus,
  saveDefaultPaymentMethod,
  createTestDefaultPaymentMethod,
  handleStripeWebhook,
};

export default paymentController;
