import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import Product from '../product/product.model';
import { User } from '../user/user.model';
import Bid from '../bid/bid.model';
import paymentService from '../payment/payment.service';
import invoiceService from '../invoice/invoice.service';
import Auction from './auction.model';
import { IAuction } from './auction.interface';

const resolveAuctionStatus = (startsAt: Date, endsAt: Date) => {
  const now = new Date();
  if (now < startsAt) return 'scheduled';
  if (now >= startsAt && now < endsAt) return 'active';
  return 'ended';
};

const createAuction = async (payload: Partial<IAuction> & { product: string }, email: string) => {
  const admin = await User.findOne({ email });
  if (!admin) {
    throw new AppError('Admin account not found', StatusCodes.FORBIDDEN);
  }

  const product = await Product.findById(payload.product);
  if (!product) {
    throw new AppError('Product not found', StatusCodes.NOT_FOUND);
  }

  if (product.inventoryStatus !== 'available' && product.inventoryStatus !== 'unsold') {
    throw new AppError('Product is not available for auction', StatusCodes.BAD_REQUEST);
  }

  const startsAt = new Date(payload.startsAt as Date);
  const endsAt = new Date(payload.endsAt as Date);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new AppError('Auction start time must be before end time', StatusCodes.BAD_REQUEST);
  }

  const status = resolveAuctionStatus(startsAt, endsAt);
  const auction = await Auction.create({
    product: product._id,
    title: payload.title || product.title,
    description: payload.description || product.description,
    startsAt,
    endsAt,
    startingBid: payload.startingBid ?? 1,
    bidIncrement: payload.bidIncrement ?? 1,
    reservePrice: payload.reservePrice ?? product.reservePrice,
    status,
    highestBid: {
      amount: 0,
    },
  });

  product.inventoryStatus = status === 'active' ? 'auction_active' : 'available';
  await product.save();

  return auction.populate('product');
};

const activateDueAuctions = async () => {
  const now = new Date();
  const auctions = await Auction.find({
    status: 'scheduled',
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  });

  await Promise.all(
    auctions.map(async (auction) => {
      auction.status = 'active';
      await auction.save();
      await Product.findByIdAndUpdate(auction.product, { inventoryStatus: 'auction_active' });
    }),
  );

  return auctions.length;
};

const getAllAuctions = async (query: Record<string, unknown>) => {
  const { status, page = 1, limit = 10 } = query;
  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const auctions = await Auction.find(filter)
    .populate('product')
    .populate('highestBid.bidder', 'firstName lastName email')
    .populate('winner', 'firstName lastName email')
    .sort({ startsAt: -1 })
    .skip(skip)
    .limit(limitNumber);

  const total = await Auction.countDocuments(filter);

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPage: Math.ceil(total / limitNumber),
    },
    data: auctions,
  };
};

const getAuctionDetails = async (id: string) => {
  const auction = await Auction.findById(id)
    .populate('product')
    .populate('highestBid.bidder', 'firstName lastName email')
    .populate('winner', 'firstName lastName email');

  if (!auction) {
    throw new AppError('Auction not found', StatusCodes.NOT_FOUND);
  }

  return auction;
};

const getAuctionBids = async (auctionId: string) => {
  const auction = await Auction.findById(auctionId).select('_id');
  if (!auction) {
    throw new AppError('Auction not found', StatusCodes.NOT_FOUND);
  }

  return Bid.find({ auction: auctionId })
    .populate('bidder', 'firstName lastName email')
    .sort({ amount: -1, createdAt: 1 });
};

const placeBid = async (auctionId: string, email: string, amount: number) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  if (!user.hasDefaultPaymentMethod || !user.defaultPaymentMethodId || !user.stripeCustomerId) {
    throw new AppError('A saved payment card is required before bidding', StatusCodes.BAD_REQUEST);
  }

  const auction = await Auction.findById(auctionId);
  if (!auction) {
    throw new AppError('Auction not found', StatusCodes.NOT_FOUND);
  }

  const now = new Date();
  if (auction.status !== 'active' || auction.startsAt > now || auction.endsAt <= now) {
    throw new AppError('Auction is not active', StatusCodes.BAD_REQUEST);
  }

  const currentHighest = auction.highestBid?.amount || 0;
  const minimumBid = currentHighest > 0 ? currentHighest + auction.bidIncrement : auction.startingBid;
  if (amount < minimumBid) {
    throw new AppError(`Bid must be at least ${minimumBid}`, StatusCodes.BAD_REQUEST);
  }

  const bid = await Bid.create({
    auction: auction._id,
    product: auction.product,
    bidder: user._id,
    amount,
  });

  const updated = await Auction.findOneAndUpdate(
    {
      _id: auction._id,
      status: 'active',
      endsAt: { $gt: now },
      $or: [{ 'highestBid.amount': { $lt: amount } }, { 'highestBid.amount': { $exists: false } }],
    },
    {
      highestBid: {
        bidder: user._id,
        amount,
        bid: bid._id,
        placedAt: new Date(),
      },
    },
    { new: true },
  ).populate('product');

  if (!updated) {
    await Bid.findByIdAndDelete(bid._id);
    throw new AppError('A higher bid was placed before yours', StatusCodes.CONFLICT);
  }

  return updated;
};

const closeAuction = async (auctionId: string, reason = 'scheduled_close') => {
  const auction = await Auction.findById(auctionId).populate('product');
  if (!auction) {
    throw new AppError('Auction not found', StatusCodes.NOT_FOUND);
  }

  if (['sold', 'unsold', 'cancelled'].includes(auction.status)) {
    return auction;
  }

  const product: any = auction.product;
  const highestAmount = auction.highestBid?.amount || 0;
  const winnerId = auction.highestBid?.bidder;

  auction.status = 'ended';
  auction.closedAt = new Date();
  auction.closeReason = reason;

  if (!winnerId || highestAmount < auction.reservePrice) {
    auction.status = 'unsold';
    await auction.save();
    await Product.findByIdAndUpdate(product._id, { inventoryStatus: 'unsold' });
    return auction;
  }

  const winner = await User.findById(winnerId);
  if (!winner) {
    throw new AppError('Winning bidder not found', StatusCodes.NOT_FOUND);
  }

  auction.winner = winner._id as unknown as Types.ObjectId;
  auction.status = 'payment_pending';
  await auction.save();
  await Product.findByIdAndUpdate(product._id, {
    inventoryStatus: 'payment_pending',
  });

  try {
    const paymentIntent = await paymentService.chargeSavedPaymentMethod({
      customerId: winner.stripeCustomerId as string,
      paymentMethodId: winner.defaultPaymentMethodId as string,
      amount: highestAmount,
      description: `Auction win: ${product.title}`,
      metadata: {
        auctionId: auction._id.toString(),
        productId: product._id.toString(),
        inventoryId: product.inventoryId,
        winnerId: winner._id.toString(),
      },
    });

    const invoice = await invoiceService.createPaidInvoice({
      auctionId: auction._id.toString(),
      productId: product._id.toString(),
      customerId: winner._id.toString(),
      inventoryId: product.inventoryId,
      amount: highestAmount,
      stripePaymentIntentId: paymentIntent.id,
      productTitle: product.title,
    });

    auction.status = 'sold';
    await auction.save();
    await Product.findByIdAndUpdate(product._id, {
      inventoryStatus: 'ready_for_pickup',
    });

    return { auction, invoice };
  } catch (error: any) {
    await invoiceService.createFailedPaymentInvoice({
      auctionId: auction._id.toString(),
      productId: product._id.toString(),
      customerId: winner._id.toString(),
      inventoryId: product.inventoryId,
      amount: highestAmount,
      failureReason: error.message || 'Payment failed',
    });

    auction.status = 'payment_failed';
    await auction.save();
    await Product.findByIdAndUpdate(product._id, {
      inventoryStatus: 'payment_pending',
    });

    throw new AppError(
      `Winner assigned but saved card charge failed: ${error.message}`,
      StatusCodes.PAYMENT_REQUIRED,
    );
  }
};

const closeDueAuctions = async () => {
  await activateDueAuctions();

  const dueAuctions = await Auction.find({
    status: 'active',
    endsAt: { $lte: new Date() },
  }).select('_id');

  const results = [];
  for (const auction of dueAuctions) {
    try {
      results.push(await closeAuction(auction._id.toString(), 'scheduled_close'));
    } catch (error: any) {
      results.push({
        auction: auction._id,
        success: false,
        message: error.message,
      });
    }
  }

  return {
    closed: results.length,
    results,
  };
};

const auctionService = {
  createAuction,
  activateDueAuctions,
  getAllAuctions,
  getAuctionDetails,
  getAuctionBids,
  placeBid,
  closeAuction,
  closeDueAuctions,
};

export default auctionService;
