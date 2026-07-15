import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import Product from '../product/product.model';
import { User } from '../user/user.model';
import Auction from './auction.model';
import { AuctionStatus, IAuction, IDayAvailability } from './auction.interface';
import { generateAuctionId } from '../../utils/product.utils';
import AuctionProduct from '../AuctionProduct/AuctionProduct.model';

const AUCTION_PUBLISHABLE_STATUSES = ['available', 'unsold'] as const;
const LOCKING_AUCTION_PRODUCT_STATUSES = [
  'upcoming',
  'active',
  'payment_pending',
  'payment_failed',
  'sold',
] as const;

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

  const requestedProductIds: unknown[] = Array.isArray(payload.products) ? payload.products : [];
  const productIds = Array.from(new Set(requestedProductIds.map((productId) => String(productId))));

  if (!productIds.length) {
    throw new AppError('At least one product is required', StatusCodes.BAD_REQUEST);
  }

  if (productIds.some((productId) => !Types.ObjectId.isValid(productId))) {
    throw new AppError('One or more selected product IDs are invalid', StatusCodes.BAD_REQUEST);
  }

  const products = await Product.find({
    _id: { $in: productIds },
  });

  if (!products.length) {
    throw new AppError('Products not found', StatusCodes.NOT_FOUND);
  }

  if (products.length !== productIds.length) {
    throw new AppError('One or more selected products were not found', StatusCodes.NOT_FOUND);
  }

  const lockedAuctionProductIds = await AuctionProduct.distinct('productId', {
    productId: { $in: productIds },
    status: { $in: LOCKING_AUCTION_PRODUCT_STATUSES },
  });
  const lockedProductIds = new Set(lockedAuctionProductIds.map(String));

  const invalidProducts = products.filter(
    (product) =>
      product.type !== 'for_auction' ||
      lockedProductIds.has(product._id.toString()) ||
      !AUCTION_PUBLISHABLE_STATUSES.includes(
        product.inventoryStatus as (typeof AUCTION_PUBLISHABLE_STATUSES)[number],
      ),
  );

  if (invalidProducts.length) {
    const details = invalidProducts
      .map((product) => `${product.title} (${product.inventoryStatus})`)
      .join(', ');

    throw new AppError(
      `Only available or unsold auction products can be published. Invalid selections: ${details}`,
      StatusCodes.BAD_REQUEST,
    );
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
    status,
    pickupSchedule: payload.pickupSchedule,
  });

  await AuctionProduct.insertMany(
    products.map((product) => ({
      auctionId: auction._id,
      productId: product._id,
      startingBid: payload.startingBid,
      ...(payload.reservePrice != null ? { reservePrice: payload.reservePrice } : {}),
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
      inventoryStatus: status === 'ended' ? 'auction_ended' : 'auction_active',
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
    .populate('winner', 'firstName lastName email profileImage');

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

const getClosingSoonAuctions = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 10 } = query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const filter = {
    status: 'active',
    endsAt: { $gt: now, $lte: threeDaysLater },
  };

  const [auctions, total] = await Promise.all([
    Auction.find(filter)
      .populate('products')
      .populate('winner', 'firstName lastName email')
      .sort({ endsAt: 1 })
      .skip(skip)
      .limit(limitNumber),

    Auction.countDocuments(filter),
  ]);

  const data = auctions.map((auction) => {
    const auctionObj = auction.toObject();
    const timeRemaining = Math.max(
      0,
      Math.floor((new Date(auctionObj.endsAt).getTime() - now.getTime()) / 1000),
    );
    return { ...auctionObj, timeRemaining };
  });

  return {
    meta: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPage: Math.ceil(total / limitNumber),
    },
    data,
  };
};

const getClosedAuctions = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 10 } = query;

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {
    status: 'ended',
  };

  const [auctions, total] = await Promise.all([
    Auction.find(filter)
      .populate('products')
      .populate('winner', 'firstName lastName email')
      .sort({ endsAt: -1 })
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

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getNextWeekdayDate = (dayIndex: number): Date => {
  const today = new Date();
  const currentDayIndex = today.getDay();

  let daysUntilTarget = dayIndex - currentDayIndex;
  if (daysUntilTarget < 0) daysUntilTarget += 7;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate;
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const getAuctionsByDay = async (dayName?: string) => {
  if (dayName) {
    const normalized = dayName.toLowerCase();

    if (!VALID_DAYS.includes(normalized as (typeof VALID_DAYS)[number])) {
      throw new AppError(
        `Invalid day name: ${dayName}. Must be one of: ${VALID_DAYS.join(', ')}`,
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  const availableDays: IDayAvailability[] = [];

  // JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Display order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  for (const dayIndex of dayOrder) {
    const nextDate = getNextWeekdayDate(dayIndex);
    const nextDateEnd = new Date(nextDate);
    nextDateEnd.setHours(23, 59, 59, 999);

    const auctionCount = await Auction.countDocuments({
      status: 'active',
      startsAt: { $lte: nextDateEnd },
      endsAt: { $gte: nextDate },
    });

    if (auctionCount > 0) {
      availableDays.push({
        day: DAY_NAMES[dayIndex],
        date: formatDate(nextDate),
        auctionCount,
      });
    }
  }

  let selectedDay = null;
  let auctions = null;

  if (dayName) {
    const normalized = dayName.toLowerCase();
    const dayIndex = (VALID_DAYS as readonly string[]).indexOf(normalized);
    const jsDayIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Convert Mon=0 to JS 1, etc.
    const actualJsDayIndex = dayOrder[jsDayIndex];

    const nextDate = getNextWeekdayDate(actualJsDayIndex);
    const nextDateEnd = new Date(nextDate);
    nextDateEnd.setHours(23, 59, 59, 999);

    const matchingAuctions = await Auction.find({
      status: 'active',
      startsAt: { $lte: nextDateEnd },
      endsAt: { $gte: nextDate },
    }).populate('products');

    const auctionsWithProducts = await Promise.all(
      matchingAuctions.map(async (auction) => {
        const products = await AuctionProduct.find({ auctionId: auction._id })
          .populate('productId')
          .populate('highestBid.bidder', 'firstName lastName');

        return {
          ...auction.toObject(),
          products,
        };
      }),
    );

    selectedDay = {
      day: DAY_NAMES[actualJsDayIndex],
      date: formatDate(nextDate),
    };
    auctions = auctionsWithProducts;
  }

  return {
    availableDays,
    selectedDay,
    auctions,
  };
};

const auctionService = {
  createAuction,
  getActiveAuctions,
  getAllAuctions,
  getAuctionDetails,
  getUpcomingAuctions,
  getClosingSoonAuctions,
  getClosedAuctions,
  getAuctionsByDay,
  updateAuction,
  cancelAuction,
};

export default auctionService;
