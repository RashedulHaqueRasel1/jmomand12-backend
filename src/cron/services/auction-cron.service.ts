import { HydratedDocument, Types } from 'mongoose';
import AppError from '../../errors/AppError';
import logger from '../../logger';
import Auction from '../../modules/auction/auction.model';
import { IAuctionProduct } from '../../modules/AuctionProduct/AuctionProduct.interface';
import AuctionProduct from '../../modules/AuctionProduct/AuctionProduct.model';
import invoiceService from '../../modules/invoice/invoice.service';
import paymentService from '../../modules/payment/payment.service';
import Product from '../../modules/product/product.model';
import { User } from '../../modules/user/user.model';

export interface IAuctionActivationResult {
  activatedCount: number;
  executionTimeMs: number;
  logs: string[];
}

export interface IAuctionProductProcessingResult {
  auctionProductId: string;
  status: string;
  paymentStatus?: string;
  message: string;
}

export interface IAuctionProcessingResult {
  auctionId: string;
  success: boolean;
  message: string;
  processedProducts: number;
  productResults: IAuctionProductProcessingResult[];
  errors?: string[];
}

export interface IAuctionCloseResult {
  closed: number;
  executionTimeMs: number;
  results: IAuctionProcessingResult[];
}

const buildErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

const activateDueAuctions = async (): Promise<IAuctionActivationResult> => {
  const startTime = Date.now();
  const now = new Date();

  logger.info({ now }, 'Auction activation service started');

  const auctions = await Auction.find({
    status: 'upcoming',
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).select('_id');

  if (auctions.length === 0) {
    const executionTimeMs = Date.now() - startTime;
    const message = 'No auctions ready for activation';
    logger.info({ executionTimeMs }, message);
    return {
      activatedCount: 0,
      executionTimeMs,
      logs: [message],
    };
  }

  const auctionIds = auctions.map((auction) => auction._id);
  const auctionUpdate = await Auction.updateMany(
    { _id: { $in: auctionIds } },
    { status: 'active' },
  );

  const auctionProductUpdate = await AuctionProduct.updateMany(
    { auction: { $in: auctionIds } },
    { status: 'active' },
  );

  const executionTimeMs = Date.now() - startTime;
  const message = `Activated ${auctionUpdate.modifiedCount} auction(s) and updated ${auctionProductUpdate.modifiedCount} auction product(s)`;

  logger.info(
    {
      activatedCount: auctionUpdate.modifiedCount,
      auctionProductsUpdated: auctionProductUpdate.modifiedCount,
      executionTimeMs,
    },
    message,
  );

  return {
    activatedCount: auctionUpdate.modifiedCount,
    executionTimeMs,
    logs: [message],
  };
};

const closeDueAuctions = async (): Promise<IAuctionCloseResult> => {
  const startTime = Date.now();
  const now = new Date();

  logger.info({ now }, 'Auction closing service started');

  const auctions = await Auction.find({
    status: 'active',
    endsAt: { $lte: now },
  });

  const results: IAuctionProcessingResult[] = [];

  for (const auction of auctions) {
    try {
      const auctionResult = await processAuction(auction);
      results.push(auctionResult);
    } catch (error: unknown) {
      const message = buildErrorMessage(error);
      logger.error(
        {
          auctionId: auction._id.toString(),
          error: message,
        },
        'Failed to process auction during closeDueAuctions',
      );
      results.push({
        auctionId: auction._id.toString(),
        success: false,
        message,
        processedProducts: 0,
        productResults: [],
        errors: [message],
      });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  logger.info(
    {
      closed: results.length,
      executionTimeMs,
    },
    'Auction closing service completed',
  );

  return {
    closed: results.length,
    executionTimeMs,
    results,
  };
};

const processAuction = async (auction: {
  _id: Types.ObjectId;
  auctionId?: string;
}): Promise<IAuctionProcessingResult> => {
  const auctionId = auction._id.toString();
  const productResults: IAuctionProductProcessingResult[] = [];

  logger.info({ auctionId }, 'Processing auction close event');

  const auctionProducts = await AuctionProduct.find({ auction: auction._id });

  await Auction.findByIdAndUpdate(auction._id, { status: 'ended' });

  for (const auctionProduct of auctionProducts) {
    try {
      const result = await processAuctionProduct(auctionProduct);
      productResults.push(result);
    } catch (error: unknown) {
      const message = buildErrorMessage(error);
      logger.error(
        {
          auctionId,
          auctionProductId: auctionProduct._id.toString(),
          error: message,
        },
        'Failed to process auction product',
      );
      productResults.push({
        auctionProductId: auctionProduct._id.toString(),
        status: auctionProduct.status,
        message,
      });
    }
  }

  const success = productResults.every((result) => result.status !== 'payment_failed');
  const message = `Auction processing completed for ${auctionId}`;

  return {
    auctionId,
    success,
    message,
    processedProducts: auctionProducts.length,
    productResults,
  };
};

const processAuctionProduct = async (
  auctionProduct: HydratedDocument<IAuctionProduct>,
): Promise<IAuctionProductProcessingResult> => {
  auctionProduct.closedAt = new Date();

  if (!auctionProduct.highestBid?.amount || auctionProduct.highestBid.amount <= 0) {
    return await markUnsold(auctionProduct, 'No bids received');
  }

  if (auctionProduct.highestBid.amount < auctionProduct.reservePrice) {
    return await markUnsold(auctionProduct, 'Reserve price not met');
  }

  await assignWinner(auctionProduct);

  const paymentResult = await processPayment(auctionProduct);
  return paymentResult;
};

const markUnsold = async (
  auctionProduct: HydratedDocument<IAuctionProduct>,
  reason: string,
): Promise<IAuctionProductProcessingResult> => {
  auctionProduct.status = 'unsold';
  auctionProduct.paymentStatus = 'failed';
  auctionProduct.pickupStatus = 'pending';
  await auctionProduct.save();

  logger.info(
    {
      auctionProductId: auctionProduct._id.toString(),
      reason,
    },
    'Auction product marked unsold',
  );

  return {
    auctionProductId: auctionProduct._id.toString(),
    status: auctionProduct.status,
    paymentStatus: auctionProduct.paymentStatus,
    message: reason,
  };
};

const assignWinner = async (auctionProduct: HydratedDocument<IAuctionProduct>): Promise<void> => {
  if (!auctionProduct.highestBid?.bidder) {
    throw new AppError('Cannot assign winner because highest bidder is missing', 500);
  }

  auctionProduct.winner = auctionProduct.highestBid.bidder;
  auctionProduct.status = 'payment_pending';
  auctionProduct.paymentStatus = 'pending';
  await auctionProduct.save();

  logger.info(
    {
      auctionProductId: auctionProduct._id.toString(),
      winnerId: auctionProduct.winner.toString(),
    },
    'Winner assigned to auction product',
  );
};

const processPayment = async (
  auctionProduct: HydratedDocument<IAuctionProduct>,
): Promise<IAuctionProductProcessingResult> => {
  if (!auctionProduct.winner) {
    throw new AppError('Auction product winner is not assigned', 500);
  }

  const winner = await User.findById(auctionProduct.winner);
  if (!winner) {
    throw new AppError('Winner user not found', 404);
  }

  if (
    !winner.hasDefaultPaymentMethod ||
    !winner.defaultPaymentMethodId ||
    !winner.stripeCustomerId
  ) {
    throw new AppError('Winner does not have a saved payment method', 400);
  }

  const product = await Product.findById(auctionProduct.product);
  if (!product) {
    throw new AppError('Auction product base product not found', 404);
  }

  try {
    const paymentIntent = await paymentService.chargeSavedPaymentMethod({
      customerId: winner.stripeCustomerId,
      paymentMethodId: winner.defaultPaymentMethodId,
      amount: auctionProduct.highestBid.amount,
      description: `Auction payment for ${product.title}`,
      metadata: {
        auctionProductId: auctionProduct._id.toString(),
        auctionId: auctionProduct.auction.toString(),
        productId: product._id.toString(),
        winnerId: winner._id.toString(),
      },
    });

    const invoice = await invoiceService.createPaidInvoice({
      auctionId: auctionProduct.auction.toString(),
      productId: product._id.toString(),
      customerId: winner._id.toString(),
      inventoryId: product.inventoryId,
      amount: auctionProduct.highestBid.amount,
      stripePaymentIntentId: paymentIntent.id,
      productTitle: product.title,
    });

    auctionProduct.status = 'sold';
    auctionProduct.paymentStatus = 'paid';
    auctionProduct.soldPrice = auctionProduct.highestBid.amount;
    auctionProduct.pickupStatus = 'pending';
    await auctionProduct.save();

    await Product.findByIdAndUpdate(product._id, {
      inventoryStatus: 'ready_for_pickup',
    });

    logger.info(
      {
        auctionProductId: auctionProduct._id.toString(),
        invoiceId: invoice._id.toString(),
      },
      'Auction product payment succeeded',
    );

    return {
      auctionProductId: auctionProduct._id.toString(),
      status: auctionProduct.status,
      paymentStatus: auctionProduct.paymentStatus,
      message: 'Payment succeeded and item is ready for pickup',
    };
  } catch (error: unknown) {
    const failureReason = buildErrorMessage(error);

    auctionProduct.status = 'payment_failed';
    auctionProduct.paymentStatus = 'failed';
    await auctionProduct.save();

    await invoiceService.createFailedPaymentInvoice({
      auctionId: auctionProduct.auction.toString(),
      productId: product._id.toString(),
      customerId: winner._id.toString(),
      inventoryId: product.inventoryId,
      amount: auctionProduct.highestBid.amount,
      failureReason,
    });

    await Product.findByIdAndUpdate(product._id, {
      inventoryStatus: 'payment_pending',
    });

    logger.error(
      {
        auctionProductId: auctionProduct._id.toString(),
        winnerId: winner._id.toString(),
        reason: failureReason,
      },
      'Auction product payment failed',
    );

    return {
      auctionProductId: auctionProduct._id.toString(),
      status: auctionProduct.status,
      paymentStatus: auctionProduct.paymentStatus,
      message: `Payment failed: ${failureReason}`,
    };
  }
};

const auctionCronService = {
  activateDueAuctions,
  closeDueAuctions,
  processAuction,
  processAuctionProduct,
  assignWinner,
  processPayment,
};

export default auctionCronService;
