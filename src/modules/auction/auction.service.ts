import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import Bid from '../bid/bid.model';
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

const VALID_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BROWSEABLE_AUCTION_STATUSES: AuctionStatus[] = ['active', 'upcoming'];

const normalizeDayName = (dayName?: string | null) => {
  if (!dayName) return null;

  const normalized = dayName.trim().toLowerCase();
  return VALID_DAYS.includes(normalized as (typeof VALID_DAYS)[number]) ? normalized : null;
};

const formatDayName = (dayName: string) => {
  const normalized = normalizeDayName(dayName);
  if (!normalized) return dayName;

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const getNextWeekdayDate = (dayName: string): Date => {
  const normalized = normalizeDayName(dayName);
  if (!normalized) {
    throw new AppError(
      `Invalid day name: ${dayName}. Must be one of: ${VALID_DAYS.join(', ')}`,
      StatusCodes.BAD_REQUEST,
    );
  }

  const today = new Date();
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const currentDayIndex = todayMidnight.getDay();
  const targetJsDayIndex = (VALID_DAYS as readonly string[]).indexOf(normalized) + 1;
  const safeTargetJsDayIndex = targetJsDayIndex === 7 ? 0 : targetJsDayIndex;

  let daysUntilTarget = safeTargetJsDayIndex - currentDayIndex;
  if (daysUntilTarget < 0) daysUntilTarget += 7;

  const targetDate = new Date(todayMidnight);
  targetDate.setDate(todayMidnight.getDate() + daysUntilTarget);
  return targetDate;
};

const getBidStatsByAuctionProductIds = async (auctionProductIds: Types.ObjectId[]) => {
  if (!auctionProductIds.length) {
    return new Map<string, { totalBids: number; uniqueBidderCount: number }>();
  }

  const bidStats = await Bid.aggregate([
    {
      $match: {
        auctionProductId: { $in: auctionProductIds },
      },
    },
    {
      $group: {
        _id: '$auctionProductId',
        totalBids: { $sum: 1 },
        bidders: { $addToSet: '$bidderId' },
      },
    },
    {
      $project: {
        totalBids: 1,
        uniqueBidderCount: { $size: '$bidders' },
      },
    },
  ]);

  return new Map(
    bidStats.map((item) => [
      String(item._id),
      {
        totalBids: item.totalBids ?? 0,
        uniqueBidderCount: item.uniqueBidderCount ?? 0,
      },
    ]),
  );
};

const getAuctionLotsByAuctionIds = async (auctionIds: Types.ObjectId[]) => {
  const auctionProducts = await AuctionProduct.find({
    auctionId: { $in: auctionIds },
  })
    .populate(
      'productId',
      'title category images reservePrice day condition inventoryStatus type averageReview',
    )
    .populate('highestBid.bidder', 'firstName lastName')
    .lean();

  const bidStatsByAuctionProductId = await getBidStatsByAuctionProductIds(
    auctionProducts.map((item) => item._id),
  );

  const lotsByAuctionId = new Map<string, Array<Record<string, unknown>>>();

  auctionProducts.forEach((item) => {
    const product = item.productId as any;
    if (!product) return;

    const bidStats = bidStatsByAuctionProductId.get(String(item._id));
    const highestBidder = item.highestBid?.bidder as any;
    const currentBid = item.highestBid?.amount || item.startingBid || product.reservePrice || 0;
    const displayValue = Math.max(
      currentBid,
      item.reservePrice || 0,
      product.reservePrice || 0,
      item.startingBid || 0,
    );

    const lotSummary = {
      auctionProductId: item._id,
      productId: product._id,
      title: product.title,
      category: product.category,
      day: product.day || null,
      image: product.images?.[0]?.url || null,
      reservePrice: item.reservePrice || product.reservePrice || 0,
      startingBid: item.startingBid,
      currentBid,
      displayValue,
      highestBidder: highestBidder
        ? {
            _id: highestBidder._id,
            firstName: highestBidder.firstName,
            lastName: highestBidder.lastName,
          }
        : null,
      totalBids: bidStats?.totalBids ?? 0,
      uniqueBidderCount: bidStats?.uniqueBidderCount ?? 0,
    };

    const auctionId = String(item.auctionId);
    const existingLots = lotsByAuctionId.get(auctionId) || [];
    existingLots.push(lotSummary);
    lotsByAuctionId.set(auctionId, existingLots);
  });

  return lotsByAuctionId;
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
  const twelveHoursLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const filter = {
    status: 'active',
    endsAt: { $gt: now, $lte: twelveHoursLater },
  };

  const [auctions, total] = await Promise.all([
    Auction.find(filter)
      .populate('products')
      .populate('winner', 'firstName lastName email')
      .lean()
      .sort({ endsAt: 1 })
      .skip(skip)
      .limit(limitNumber),

    Auction.countDocuments(filter),
  ]);

  const lotsByAuctionId = await getAuctionLotsByAuctionIds(auctions.map((auction) => auction._id));

  const data = auctions.map((auction) => {
    const lots = lotsByAuctionId.get(String(auction._id)) || [];
    const timeRemaining = Math.max(
      0,
      Math.floor((new Date(auction.endsAt).getTime() - now.getTime()) / 1000),
    );

    const highValueLots = [...lots]
      .sort(
        (left, right) =>
          Number(right.displayValue || 0) -
            Number(left.displayValue || 0) ||
          Number(right.currentBid || 0) - Number(left.currentBid || 0),
      )
      .slice(0, 9);

    const mostBidLots = [...lots]
      .sort(
        (left, right) =>
          Number(right.totalBids || 0) -
            Number(left.totalBids || 0) ||
          Number(right.uniqueBidderCount || 0) -
            Number(left.uniqueBidderCount || 0) ||
          Number(right.currentBid || 0) - Number(left.currentBid || 0),
      )
      .slice(0, 9);

    return {
      ...auction,
      timeRemaining,
      totalLots: lots.length,
      highValueLots,
      mostBidLots,
      summary: {
        highestBidAmount: Number(highValueLots[0]?.currentBid || 0),
        highestBidder: highValueLots[0]?.highestBidder || null,
        mostBidsCount: Number(mostBidLots[0]?.totalBids || 0),
        mostBiddersCount: Number(mostBidLots[0]?.uniqueBidderCount || 0),
      },
    };
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

const getAuctionsByDay = async (dayName?: string) => {
  const normalizedDay = normalizeDayName(dayName);
  if (dayName && !normalizedDay) {
    throw new AppError(
      `Invalid day name: ${dayName}. Must be one of: ${VALID_DAYS.join(', ')}`,
      StatusCodes.BAD_REQUEST,
    );
  }

  const auctionProducts = await AuctionProduct.find({
    status: { $in: BROWSEABLE_AUCTION_STATUSES },
  })
    .populate('auctionId', 'auctionId title description startsAt endsAt status durationInDays')
    .populate(
      'productId',
      'title description category images day condition reservePrice inventoryStatus type averageReview',
    )
    .populate('highestBid.bidder', 'firstName lastName')
    .lean();

  const bidStatsByAuctionProductId = await getBidStatsByAuctionProductIds(
    auctionProducts.map((item) => item._id),
  );

  const dayAuctionIdsMap = new Map<string, Set<string>>();
  const dayLotsMap = new Map<
    string,
    Map<string, { auction: Record<string, unknown>; lots: Array<Record<string, unknown>> }>
  >();

  auctionProducts.forEach((item) => {
    const auction = item.auctionId as any;
    const product = item.productId as any;
    const normalizedProductDay = normalizeDayName(product?.day);

    if (!auction || !product || !normalizedProductDay) return;

    const bidStats = bidStatsByAuctionProductId.get(String(item._id));
    const highestBidder = item.highestBid?.bidder as any;
    const dayDisplayName = formatDayName(normalizedProductDay);

    if (!dayAuctionIdsMap.has(dayDisplayName)) {
      dayAuctionIdsMap.set(dayDisplayName, new Set<string>());
    }
    dayAuctionIdsMap.get(dayDisplayName)?.add(String(auction._id));

    const lotsByAuction = dayLotsMap.get(dayDisplayName) || new Map();
    const existingAuction =
      lotsByAuction.get(String(auction._id)) ||
      ({
        auction: {
          _id: auction._id,
          auctionId: auction.auctionId,
          title: auction.title,
          description: auction.description,
          startsAt: auction.startsAt,
          endsAt: auction.endsAt,
          status: auction.status,
          durationInDays: auction.durationInDays,
        },
        lots: [],
      } as { auction: Record<string, unknown>; lots: Array<Record<string, unknown>> });

    existingAuction.lots.push({
      auctionProductId: item._id,
      productId: product._id,
      title: product.title,
      description: product.description,
      category: product.category,
      condition: product.condition,
      image: product.images?.[0]?.url || null,
      day: dayDisplayName,
      reservePrice: item.reservePrice || product.reservePrice || 0,
      startingBid: item.startingBid,
      currentBid: item.highestBid?.amount || item.startingBid || product.reservePrice || 0,
      totalBids: bidStats?.totalBids ?? 0,
      uniqueBidderCount: bidStats?.uniqueBidderCount ?? 0,
      highestBidder: highestBidder
        ? {
            _id: highestBidder._id,
            firstName: highestBidder.firstName,
            lastName: highestBidder.lastName,
          }
        : null,
    });

    lotsByAuction.set(String(auction._id), existingAuction);
    dayLotsMap.set(dayDisplayName, lotsByAuction);
  });

  const availableDays: IDayAvailability[] = DAY_NAMES.map((day) => {
    const nextDate = getNextWeekdayDate(day);
    return {
      day,
      date: formatDate(nextDate),
      auctionCount: dayAuctionIdsMap.get(day)?.size || 0,
    };
  }).filter((item) => item.auctionCount > 0);

  let selectedDay = null;
  let auctions = null;

  if (normalizedDay) {
    const displayDay = formatDayName(normalizedDay);
    const nextDate = getNextWeekdayDate(displayDay);
    const matchingAuctions = Array.from(dayLotsMap.get(displayDay)?.values() || [])
      .map((item) => ({
        ...(item.auction as Record<string, unknown>),
        products: item.lots.sort(
          (left, right) =>
            Number(right.totalBids || 0) - Number(left.totalBids || 0) ||
            Number(right.currentBid || 0) - Number(left.currentBid || 0),
        ),
      }))
      .sort(
        (left, right) =>
          new Date(String(((left as unknown) as { endsAt: string | Date }).endsAt)).getTime() -
          new Date(String(((right as unknown) as { endsAt: string | Date }).endsAt)).getTime(),
      );

    selectedDay = {
      day: displayDay,
      date: formatDate(nextDate),
      auctionCount: matchingAuctions.length,
    };
    auctions = matchingAuctions;
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
