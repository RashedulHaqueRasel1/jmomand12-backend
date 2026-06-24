import Stripe from 'stripe';
import { StatusCodes } from 'http-status-codes';
import config from '../../config';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';

const isProbablyPlaceholderKey = (key?: string) => {
  if (!key) return true;

  return (
    key.includes('your_') ||
    key.includes('****************') ||
    key.endsWith('_key') ||
    !/^sk_(test|live)_[A-Za-z0-9]/.test(key)
  );
};

const stripe = !isProbablyPlaceholderKey(config.stripe.secretKey)
  ? new Stripe(config.stripe.secretKey as string, {
      apiVersion: '2025-08-27.basil',
    })
  : null;

const isStripeTestMode = () => config.stripe.secretKey?.startsWith('sk_test_') === true;

const requireStripe = () => {
  if (!stripe) {
    throw new AppError(
      'Stripe is not configured with a valid secret key. Add a real STRIPE_SECRET_KEY in .env and restart the server.',
      StatusCodes.BAD_GATEWAY,
    );
  }

  return stripe;
};

const handleStripeError = (error: any): never => {
  if (error?.type === 'StripeAuthenticationError') {
    throw new AppError(
      'Stripe rejected the configured secret key. Add a valid test/live secret key in .env and restart the server.',
      StatusCodes.BAD_GATEWAY,
    );
  }

  if (error?.type === 'StripeInvalidRequestError') {
    throw new AppError(error.message || 'Invalid Stripe request', StatusCodes.BAD_REQUEST);
  }

  if (error?.type === 'StripeCardError') {
    throw new AppError(error.message || 'Card was declined', StatusCodes.PAYMENT_REQUIRED);
  }

  throw error;
};

const toAppStripeError = (error: any): never => handleStripeError(error);

const getOrCreateStripeCustomer = async (email: string): Promise<string> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  try {
    const stripeClient = requireStripe();
    const customer = await stripeClient.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      metadata: {
        userId: user._id.toString(),
      },
    });

    user.stripeCustomerId = customer.id;
    await user.save();

    return customer.id;
  } catch (error) {
    return toAppStripeError(error);
  }
};

const createSetupIntent = async (email: string): Promise<{
  customerId: string;
  setupIntentId: string;
  clientSecret: string | null;
  publishableKey?: string;
}> => {
  const stripeClient = requireStripe();
  const customerId = await getOrCreateStripeCustomer(email);

  try {
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    const response: {
      customerId: string;
      setupIntentId: string;
      clientSecret: string | null;
      publishableKey?: string;
    } = {
      customerId,
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
    };

    if (config.stripe.publishableKey) {
      response.publishableKey = config.stripe.publishableKey;
    }

    return response;
  } catch (error) {
    return toAppStripeError(error);
  }
};

const getSetupIntentStatus = async (email: string, setupIntentId: string) => {
  const stripeClient = requireStripe();
  const customerId = await getOrCreateStripeCustomer(email);

  if (!setupIntentId?.trim()) {
    throw new AppError('setupIntentId is required', StatusCodes.BAD_REQUEST);
  }

  try {
    const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId.trim());
    if (setupIntent.customer !== customerId) {
      throw new AppError('SetupIntent does not belong to this customer', StatusCodes.FORBIDDEN);
    }

    return {
      id: setupIntent.id,
      status: setupIntent.status,
      customer: setupIntent.customer,
      paymentMethodId:
        typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : undefined,
      canSaveAsDefault: setupIntent.status === 'succeeded',
      nextStep:
        setupIntent.status === 'succeeded'
          ? 'Send this setupIntentId to /api/v1/payments/default-payment-method.'
          : 'Confirm the clientSecret with Stripe.js/Elements before saving this card.',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return toAppStripeError(error);
  }
};

const saveDefaultPaymentMethod = async (
  email: string,
  payload: {
    setupIntentId?: string;
    paymentMethodId?: string;
  },
) => {
  const stripeClient = requireStripe();
  const customerId = await getOrCreateStripeCustomer(email);

  const setupIntentId = payload.setupIntentId?.trim();
  let paymentMethodId = payload.paymentMethodId?.trim();

  if (!setupIntentId && !paymentMethodId) {
    throw new AppError(
      'setupIntentId is required after confirming the card with Stripe Elements.',
      StatusCodes.BAD_REQUEST,
    );
  }

  try {
    if (setupIntentId) {
      const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId);
      if (setupIntent.customer !== customerId) {
        throw new AppError('SetupIntent does not belong to this customer', StatusCodes.FORBIDDEN);
      }

      if (setupIntent.status !== 'succeeded') {
        throw new AppError(
          `Card setup is not completed yet. Current SetupIntent status is "${setupIntent.status}". Confirm the clientSecret with Stripe.js/Elements first, then retry this endpoint.`,
          StatusCodes.BAD_REQUEST,
        );
      }

      if (typeof setupIntent.payment_method !== 'string') {
        throw new AppError('SetupIntent does not have a saved payment method', StatusCodes.BAD_REQUEST);
      }

      paymentMethodId = setupIntent.payment_method;
    }

    if (!paymentMethodId) {
      throw new AppError('A valid payment method is required', StatusCodes.BAD_REQUEST);
    }

    const confirmedPaymentMethodId = paymentMethodId;
    const paymentMethod = await stripeClient.paymentMethods.retrieve(confirmedPaymentMethodId);
    if (paymentMethod.customer && paymentMethod.customer !== customerId) {
      throw new AppError('Payment method belongs to another Stripe customer', StatusCodes.FORBIDDEN);
    }

    if (!paymentMethod.customer) {
      await stripeClient.paymentMethods.attach(confirmedPaymentMethodId, {
        customer: customerId,
      });
    }

    await stripeClient.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: confirmedPaymentMethodId,
      },
    });

    paymentMethodId = confirmedPaymentMethodId;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return toAppStripeError(error);
  }

  const user = await User.findOneAndUpdate(
    { email },
    {
      stripeCustomerId: customerId,
      defaultPaymentMethodId: paymentMethodId,
      hasDefaultPaymentMethod: true,
    },
    { new: true },
  ).select('-password -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires');

  return user;
};

const createTestDefaultPaymentMethod = async (
  email: string,
  payload: {
    testPaymentMethodId?: string;
  },
) => {
  if (config.NODE_ENV === 'production' || !isStripeTestMode()) {
    throw new AppError(
      'Test card helper is available only outside production with a Stripe test secret key.',
      StatusCodes.FORBIDDEN,
    );
  }

  const stripeClient = requireStripe();
  const customerId = await getOrCreateStripeCustomer(email);
  const testPaymentMethodId = payload.testPaymentMethodId?.trim() || 'pm_card_visa';

  if (!testPaymentMethodId.startsWith('pm_card_')) {
    throw new AppError(
      'Only Stripe test payment method IDs like pm_card_visa are allowed here.',
      StatusCodes.BAD_REQUEST,
    );
  }

  try {
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method: testPaymentMethodId,
      payment_method_types: ['card'],
      usage: 'off_session',
      confirm: true,
    });

    return saveDefaultPaymentMethod(email, {
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    return toAppStripeError(error);
  }
};

const chargeSavedPaymentMethod = async (params: {
  customerId: string;
  paymentMethodId: string;
  amount: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<Stripe.PaymentIntent> => {
  const stripeClient = requireStripe();

  try {
    return await stripeClient.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: 'usd',
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      off_session: true,
      confirm: true,
      description: params.description,
      metadata: params.metadata,
    });
  } catch (error) {
    return toAppStripeError(error);
  }
};

const paymentService = {
  createSetupIntent,
  getSetupIntentStatus,
  saveDefaultPaymentMethod,
  createTestDefaultPaymentMethod,
  chargeSavedPaymentMethod,
};

export default paymentService;
