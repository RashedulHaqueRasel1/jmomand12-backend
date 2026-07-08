import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import auctionProductService from './AuctionProduct.service';

const getProductsByAuctionId = catchAsync(async (req, res) => {
  const { auctionId } = req.params;
  const result = await auctionProductService.getProductsByAuctionId(auctionId as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Products retrieved successfully',
    data: result,
  });
});

const getSingleAuctionProduct = catchAsync(async (req, res) => {});

const auctionProductController = {
  getProductsByAuctionId,
  getSingleAuctionProduct,
};

export default auctionProductController;
