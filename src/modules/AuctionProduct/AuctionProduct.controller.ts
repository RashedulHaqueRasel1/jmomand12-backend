import catchAsync from '../../utils/catchAsync';

const getAllAuctionProducts = catchAsync(async (req, res) => {});
const getSingleAuctionProduct = catchAsync(async (req, res) => {});

const auctionProductController = {
  getAllAuctionProducts,
  getSingleAuctionProduct,
};

export default auctionProductController;
