import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AuctionProduct from './AuctionProduct.model';
import AppError from '../../errors/AppError';

const getProductsByAuctionId = async (auctionId: string) => {
  const result = await AuctionProduct.find({
    auctionId: new Types.ObjectId(auctionId),
  }).populate('productId');

  return result;
};

const getSingleAuctionProduct = async (auctionProductId: string) => {
  if (!Types.ObjectId.isValid(auctionProductId)) {
    throw new AppError('Invalid auction product id', StatusCodes.BAD_REQUEST);
  }

  const auctionProduct =
    (await AuctionProduct.findById(auctionProductId)
      .populate('productId')
      .populate('auctionId', 'auctionId title description startsAt endsAt status')
      .populate('highestBid.bidder', 'firstName lastName')
      .populate('winner', 'firstName lastName')) ||
    (await AuctionProduct.findOne({ productId: new Types.ObjectId(auctionProductId) })
      .sort({ createdAt: -1 })
      .populate('productId')
      .populate('auctionId', 'auctionId title description startsAt endsAt status')
      .populate('highestBid.bidder', 'firstName lastName')
      .populate('winner', 'firstName lastName'));

  if (!auctionProduct) {
    throw new AppError('Auction product not found', StatusCodes.NOT_FOUND);
  }

  const product = auctionProduct.productId as any;
  const auction = auctionProduct.auctionId as any;
  const highestBidBidder = auctionProduct.highestBid?.bidder as any;
  const winner = auctionProduct.winner as any;
  const currentBid = auctionProduct.highestBid?.amount ?? 0;
  const minimumNextBid =
    currentBid > 0 ? currentBid + auctionProduct.bidIncrement : auctionProduct.startingBid;

  return {
    auctionProductId: auctionProduct._id,
    status: auctionProduct.status,
    canBid: auctionProduct.status === 'active',
    startingBid: auctionProduct.startingBid,
    reservePrice: auctionProduct.reservePrice,
    bidIncrement: auctionProduct.bidIncrement,
    highestBid: {
      amount: currentBid,
      placedAt: auctionProduct.highestBid?.placedAt ?? null,
      bidder: highestBidBidder
        ? {
            _id: highestBidBidder._id,
            firstName: highestBidBidder.firstName,
            lastName: highestBidBidder.lastName,
          }
        : null,
    },
    minimumNextBid,
    winner: winner
      ? {
          _id: winner._id,
          firstName: winner.firstName,
          lastName: winner.lastName,
        }
      : null,
    closedAt: auctionProduct.closedAt ?? null,
    paymentStatus: auctionProduct.paymentStatus,
    pickupStatus: auctionProduct.pickupStatus,
    auction: auction
      ? {
          _id: auction._id,
          auctionId: auction.auctionId,
          title: auction.title,
          description: auction.description,
          startsAt: auction.startsAt,
          endsAt: auction.endsAt,
          status: auction.status,
        }
      : null,
    product: product
      ? {
          _id: product._id,
          inventoryId: product.inventoryId,
          title: product.title,
          description: product.description,
          category: product.category,
          condition: product.condition,
          day: product.day,
          reservePrice: product.reservePrice,
          inventoryStatus: product.inventoryStatus,
          images: product.images,
          totalReview: product.totalReview,
          type: product.type,
          color: product.color,
          quantity: product.quantity,
          averageReview: product.averageReview,
          manufacturer: product.manufacturer,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        }
      : null,
  };
};

const auctionProductService = {
  getProductsByAuctionId,
  getSingleAuctionProduct,
};

export default auctionProductService;
