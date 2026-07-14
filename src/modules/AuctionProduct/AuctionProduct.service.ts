import { Types } from 'mongoose';
import AuctionProduct from './AuctionProduct.model';

const getProductsByAuctionId = async (auctionId: string) => {
  const result = await AuctionProduct.find({
    auctionId: new Types.ObjectId(auctionId),
  }).populate('productId');

  return result;
};

const getSingleAuctionProduct = async () => {};

const auctionProductService = {
  getProductsByAuctionId,
  getSingleAuctionProduct,
};

export default auctionProductService;
