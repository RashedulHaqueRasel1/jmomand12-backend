import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import Product from '../product/product.model';
import { User } from '../user/user.model';
import Auction from './auction.model';
import { AuctionStatus, IAuction } from './auction.interface';
import { generateAuctionId } from '../../utils/product.utils';
import AuctionProduct from '../AuctionProduct/AuctionProduct.model';

const resolveAuctionStatus = (startsAt: Date, endsAt: Date): AuctionStatus => {
  const now = new Date();

  if (now < startsAt) return 'upcoming';
  if (now >= startsAt && now < endsAt) {
    return 'active';
  }

  return 'ended';
};

const createAuction = async (payload: any, email: string) => {
  const admin = await User.findOne({ email });

  if (!admin) {
    throw new AppError('Admin account not found', StatusCodes.FORBIDDEN);
  }

  const products = await Product.find({
    _id: { $in: payload.products },
  });

  if (!products.length) {
    throw new AppError('Products not found', StatusCodes.NOT_FOUND);
  }

  for (const product of products) {
    if (product.inventoryStatus !== 'available' && product.inventoryStatus !== 'unsold') {
      throw new AppError(`${product.title} is not available for auction`, StatusCodes.BAD_REQUEST);
    }
  }

  const startsAt = new Date(
    `${payload.auctionSchedule.startDate}T${payload.auctionSchedule.startTime}:00`,
  );

  const endsAt = new Date(startsAt);

  endsAt.setDate(endsAt.getDate() + payload.auctionSchedule.durationInDays);

  const status = resolveAuctionStatus(startsAt, endsAt);

  const auction = await Auction.create({
    auctionId: await generateAuctionId(),
    products: products.map((p) => p._id),
    title: payload.title,
    description: payload.description,
    startsAt,
    endsAt,
    durationInDays: payload.auctionSchedule.durationInDays,
    startingBid: payload.startingBid,
    bidIncrement: payload.bidIncrement,
    reservePrice: payload.reservePrice,
    status,
    pickupSchedule: payload.pickupSchedule,
    highestBid: {
      amount: 0,
    },
  });

  await AuctionProduct.insertMany(
    products.map((product) => ({
      auction: auction._id,
      product: product._id,
      startingBid: payload.startingBid,
      reservePrice: payload.reservePrice,
      bidIncrement: payload.bidIncrement,
      status: auction.status,
    })),
  );

  await Product.updateMany(
    {
      _id: {
        $in: products.map((p) => p._id),
      },
    },
    {
      inventoryStatus: status === 'active' ? 'auction_active' : 'available',
    },
  );

  return auction.populate('products');
};

const getActiveAuctions = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 10 } = query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const skip = (pageNumber - 1) * limitNumber;

  const [auctions, total] = await Promise.all([
    Auction.find({ status: 'active' })
      .populate('products')
      .populate('winner', 'firstName lastName email')
      .sort({ startsAt: 1 })
      .skip(skip)
      .limit(limitNumber),

    Auction.countDocuments({
      status: 'active',
    }),
  ]);

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

const getAllAuctions = async (query: Record<string, unknown>) => {
  const {
    status,
    searchTerm,
    page = 1,
    limit = 10,
    sortBy = 'startsAt',
    sortOrder = 'desc',
  } = query;

  const filter: Record<string, unknown> = {};

  // Status Filter
  if (status) {
    filter.status = status;
  }

  // Search
  if (searchTerm) {
    filter.$or = [
      {
        auctionId: {
          $regex: searchTerm,
          $options: 'i',
        },
      },
      {
        title: {
          $regex: searchTerm,
          $options: 'i',
        },
      },
    ];
  }

  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  const skip = (pageNumber - 1) * limitNumber;

  const sort: Record<string, 1 | -1> = {
    [String(sortBy)]: sortOrder === 'asc' ? 1 : -1,
  };

  const [auctions, total] = await Promise.all([
    Auction.find(filter)
      .populate('products')
      .populate('winner', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber),

    Auction.countDocuments(filter),
  ]);

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
    .populate('products')
    .populate('highestBid.bidder', 'firstName lastName email profileImage')
    .populate('winner', 'firstName lastName email profileImage')
    .populate({
      path: 'highestBid.bid',
      populate: {
        path: 'bidder',
        select: 'firstName lastName email',
      },
    });

  if (!auction) {
    throw new AppError('Auction not found', StatusCodes.NOT_FOUND);
  }

  return auction;
};

const getUpcomingAuctions = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 10 } = query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {
    status: 'upcoming',
  };

  const [auctions, total] = await Promise.all([
    Auction.find(filter)
      .populate('products')
      .populate('highestBid.bidder', 'firstName lastName email')
      .populate('winner', 'firstName lastName email')
      .sort({ startsAt: 1 })
      .skip(skip)
      .limit(limitNumber),

    Auction.countDocuments(filter),
  ]);

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

const updateAuction = async (id: string, data: Partial<IAuction>) => {};
const cancelAuction = async (id: string) => {};

const auctionService = {
  createAuction,
  getActiveAuctions,
  getAllAuctions,
  getAuctionDetails,
  getUpcomingAuctions,
  updateAuction,
  cancelAuction,
};

export default auctionService;
