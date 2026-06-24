import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import settingsService from './settings.service';

const getSettings = catchAsync(async (_req, res) => {
  const result = await settingsService.getSettings();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Platform settings fetched successfully',
    data: result,
  });
});

const updateSettings = catchAsync(async (req, res) => {
  const result = await settingsService.updateSettings(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Platform settings updated successfully',
    data: result,
    links: {
      pickupSlots: '/api/v1/pickups/slots',
      inventoryMonitoring: '/api/v1/products/inventory-monitoring',
    },
  });
});

const settingsController = {
  getSettings,
  updateSettings,
};

export default settingsController;
