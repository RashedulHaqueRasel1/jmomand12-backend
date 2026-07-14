import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import AuctionProduct from '../AuctionProduct/AuctionProduct.model';
import Invoice from '../invoice/invoice.model';
import { PickupAppointment } from '../pickup/pickup.model';
import Bid from './bid.model';

const addBid = async (email: string, payload: any) => {
  // Find user
  const { auctionProductId, amount } = payload;
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  // Check if user has a default payment method before accepting bid
  if (!user.hasDefaultPaymentMethod || !user.defaultPaymentMethodId) {
    throw new AppError(
      'You must have a saved payment method before placing a bid.',
      StatusCodes.BAD_REQUEST,
    );
  }

  // Find auction product
  const auctionProduct = await AuctionProduct.findById(auctionProductId);

  if (!auctionProduct) {
    throw new AppError('Auction product not found', StatusCodes.NOT_FOUND);
  }

  // Product must be active
  if (auctionProduct.status !== 'active') {
    throw new AppError('This product is not available for bidding.', StatusCodes.BAD_REQUEST);
  }

  // Calculate minimum bid
  const minimumBid =
    auctionProduct.highestBid.amount > 0
      ? auctionProduct.highestBid.amount + auctionProduct.bidIncrement
      : auctionProduct.startingBid;

  if (amount < minimumBid) {
    throw new AppError(`Minimum bid amount is ${minimumBid}`, StatusCodes.BAD_REQUEST);
  }

  // Prevent current highest bidder from bidding again (optional)
  if (
    auctionProduct.highestBid.bidder &&
    auctionProduct.highestBid.bidder.toString() === user._id.toString()
  ) {
    throw new AppError('You already have the highest bid.', StatusCodes.BAD_REQUEST);
  }

  // Create bid
  const bid = await Bid.create({
    auctionId: auctionProduct.auctionId,
    auctionProductId: auctionProduct._id,
    productId: auctionProduct.productId,
    bidderId: user._id,
    amount,
    isWinningBid: true,
  });

  // Previous winning bid becomes false
  await Bid.updateMany(
    {
      auctionProductId: auctionProduct._id,
      _id: { $ne: bid._id },
      isWinningBid: true,
    },
    {
      isWinningBid: false,
    },
  );

  // Update auction product
  auctionProduct.highestBid = {
    bidder: user._id as any,
    bid: bid._id,
    amount,
    placedAt: new Date(),
  };

  await auctionProduct.save();

  return bid;
};

const getMyDashboardAuctionActivity = async (email: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  const bidAuctionProductIds = await Bid.distinct('auctionProductId', {
    bidderId: user._id,
  });

  if (!bidAuctionProductIds.length) {
    return {
      summary: {
        active: 0,
        won: 0,
        lost: 0,
      },
      active: [],
      won: [],
      lost: [],
    };
  }

  const objectIds = bidAuctionProductIds.map((id) => new Types.ObjectId(id));

  const [auctionProducts, bidStats, userBidStats, appointments] = await Promise.all([
    AuctionProduct.find({ _id: { $in: objectIds } })
      .populate('auctionId', 'auctionId title endsAt status')
      .populate('productId', 'title category images type')
      .lean(),
    Bid.aggregate([
      {
        $match: {
          auctionProductId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: '$auctionProductId',
          totalBids: { $sum: 1 },
        },
      },
    ]),
    Bid.aggregate([
      {
        $match: {
          auctionProductId: { $in: objectIds },
          bidderId: user._id,
        },
      },
      {
        $sort: {
          amount: -1,
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: '$auctionProductId',
          yourBid: { $first: '$amount' },
          latestBidAt: { $first: '$createdAt' },
        },
      },
    ]),
    PickupAppointment.find({
      customer: user._id,
    })
      .select('status invoices')
      .lean(),
  ]);

  const productIds = auctionProducts
    .map((item) => normalizeProduct(item.productId)?._id)
    .filter(Boolean);

  const invoices = await Invoice.find({
    customer: user._id,
    product: {
      $in: productIds,
    },
  })
    .select('product invoiceNumber status _id')
    .lean();

  const bidCountByAuctionProductId = new Map<string, number>();
  bidStats.forEach((item) => {
    bidCountByAuctionProductId.set(String(item._id), item.totalBids);
  });

  const userBidByAuctionProductId = new Map<
    string,
    {
      yourBid: number;
      latestBidAt?: Date;
    }
  >();
  userBidStats.forEach((item) => {
    userBidByAuctionProductId.set(String(item._id), {
      yourBid: item.yourBid,
      latestBidAt: item.latestBidAt,
    });
  });

  const invoiceByProductId = new Map<string, (typeof invoices)[number]>();
  invoices.forEach((invoice) => {
    invoiceByProductId.set(String(invoice.product), invoice);
  });

  const appointmentByInvoiceId = new Map<string, (typeof appointments)[number]>();
  appointments.forEach((appointment) => {
    appointment.invoices.forEach((invoiceId) => {
      appointmentByInvoiceId.set(String(invoiceId), appointment);
    });
  });

  const active: Array<Record<string, unknown>> = [];
  const won: Array<Record<string, unknown>> = [];
  const lost: Array<Record<string, unknown>> = [];

  for (const item of auctionProducts) {
    const auctionProductId = String(item._id);
    const auction = normalizeAuction(item.auctionId);
    const product = normalizeProduct(item.productId);
    const highestBidAmount = item.highestBid?.amount ?? 0;
    const yourBidDetails = userBidByAuctionProductId.get(auctionProductId);
    const yourBid = yourBidDetails?.yourBid ?? 0;
    const totalBids = bidCountByAuctionProductId.get(auctionProductId) ?? 0;
    const minimumNextBid =
      highestBidAmount > 0 ? highestBidAmount + item.bidIncrement : item.startingBid;

    const baseData = {
      auctionProductId,
      auctionId: auction?._id ?? null,
      auctionRef: auction?.auctionId ?? null,
      productId: product?._id ?? null,
      title: product?.title ?? 'Auction item',
      category: product?.category ?? 'Uncategorized',
      image: product?.images?.[0]?.url ?? null,
    };

    if (item.status === 'active') {
      active.push({
        ...baseData,
        endsAt: auction?.endsAt ?? null,
        totalBids,
        currentBid: highestBidAmount,
        yourBid,
        minimumNextBid,
        isLeading:
          Boolean(item.highestBid?.bidder) &&
          String(item.highestBid.bidder) === String(user._id),
        outbidBy: yourBid > 0 && highestBidAmount > yourBid ? highestBidAmount - yourBid : 0,
      });
      continue;
    }

    if (item.winner && String(item.winner) === String(user._id)) {
      const invoice = product?._id ? invoiceByProductId.get(String(product._id)) : undefined;
      const appointment = invoice ? appointmentByInvoiceId.get(String(invoice._id)) : undefined;

      won.push({
        ...baseData,
        winningBid: item.soldPrice ?? highestBidAmount,
        winningDate: item.closedAt ?? auction?.endsAt ?? null,
        paymentStatus: invoice?.status ?? item.paymentStatus,
        pickupStatus: appointment?.status ?? item.pickupStatus,
        invoiceId: invoice?._id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
      });
      continue;
    }

    lost.push({
      ...baseData,
      yourFinalBid: yourBid,
      winningBid: item.soldPrice ?? highestBidAmount,
      endedOn: item.closedAt ?? auction?.endsAt ?? null,
    });
  }

  return {
    summary: {
      active: active.length,
      won: won.length,
      lost: lost.length,
    },
    active,
    won,
    lost,
  };
};

function normalizeAuction(auction: any) {
  if (!auction || Array.isArray(auction)) return null;
  return auction;
}

function normalizeProduct(product: any) {
  if (!product || Array.isArray(product)) return null;
  return product;
}

const bidService = {
  addBid,
  getMyDashboardAuctionActivity,
};

export default bidService;
