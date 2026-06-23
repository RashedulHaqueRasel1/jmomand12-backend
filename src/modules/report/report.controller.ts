import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import reportService from './report.service';

const getRevenueSummary = catchAsync(async (req, res) => {
  const result = await reportService.getRevenueSummary(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Revenue report fetched successfully',
    data: result,
  });
});

const getAuctionSummary = catchAsync(async (req, res) => {
  const result = await reportService.getAuctionSummary(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Auction report fetched successfully',
    data: result,
  });
});

const getPickupSummary = catchAsync(async (req, res) => {
  const result = await reportService.getPickupSummary(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup report fetched successfully',
    data: result,
  });
});

const getInventorySummary = catchAsync(async (_req, res) => {
  const result = await reportService.getInventorySummary();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Inventory report fetched successfully',
    data: result,
  });
});

const reportController = {
  getRevenueSummary,
  getAuctionSummary,
  getPickupSummary,
  getInventorySummary,
};

export default reportController;
