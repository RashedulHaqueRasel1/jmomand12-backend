import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import auctionService from './auction.service';

const createAuction = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await auctionService.createAuction(req.body, email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction created successfully',
    data: result,
  });
});

const getAllAuctions = catchAsync(async (req, res) => {
  const result = await auctionService.getAllAuctions(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auctions fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getAuctionDetails = catchAsync(async (req, res) => {
  const result = await auctionService.getAuctionDetails(req.params.id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction details fetched successfully',
    data: result,
  });
});

const getAuctionBids = catchAsync(async (req, res) => {
  const result = await auctionService.getAuctionBids(req.params.id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction bids fetched successfully',
    data: result,
    links: {
      auction: `/api/v1/auctions/${req.params.id}`,
      placeBid: `/api/v1/auctions/${req.params.id}/bids`,
    },
  });
});

const placeBid = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await auctionService.placeBid(req.params.id as string, email, Number(req.body.amount));

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Bid placed successfully',
    data: result,
  });
});

const closeAuction = catchAsync(async (req, res) => {
  const result = await auctionService.closeAuction(req.params.id as string, req.body.reason);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction closed successfully',
    data: result,
  });
});

const closeDueAuctions = catchAsync(async (_req, res) => {
  const result = await auctionService.closeDueAuctions();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Due auctions processed successfully',
    data: result,
  });
});

const auctionController = {
  createAuction,
  getAllAuctions,
  getAuctionDetails,
  getAuctionBids,
  placeBid,
  closeAuction,
  closeDueAuctions,
};

export default auctionController;
