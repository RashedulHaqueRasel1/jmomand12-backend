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
  const { id } = req.params;
  const result = await auctionService.getAuctionDetails(id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction details fetched successfully',
    data: result,
  });
});

const getActiveAuction = catchAsync(async (req, res) => {
  const result = await auctionService.getActiveAuctions(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Active auction fetched successfully',
    data: result,
  });
});

const getUpcomingAuctions = catchAsync(async (req, res) => {
  const result = await auctionService.getUpcomingAuctions(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Upcoming auctions fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getClosingSoonAuctions = catchAsync(async (req, res) => {
  const result = await auctionService.getClosingSoonAuctions(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Closing soon auctions fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getClosedAuctions = catchAsync(async (req, res) => {
  const result = await auctionService.getClosedAuctions(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Closed auctions fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const updateAuction = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await auctionService.updateAuction(id as string, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction updated successfully',
    data: result,
  });
});

const cancelAuction = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await auctionService.cancelAuction(id as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction cancelled successfully',
    data: result,
  });
});

const getAuctionsByDay = catchAsync(async (req, res) => {
  const { day } = req.query;
  const result = await auctionService.getAuctionsByDay(day as string | undefined);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: day
      ? `Auctions for ${result.selectedDay?.day} fetched successfully`
      : 'Available days fetched successfully',
    data: result,
  });
});

const auctionController = {
  createAuction,
  getAllAuctions,
  getAuctionDetails,
  getActiveAuction,
  getUpcomingAuctions,
  getClosingSoonAuctions,
  getClosedAuctions,
  getAuctionsByDay,
  updateAuction,
  cancelAuction,
};

export default auctionController;
