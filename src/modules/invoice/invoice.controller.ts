import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import invoiceService from './invoice.service';

const getMyInvoices = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await invoiceService.getMyInvoices(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoices fetched successfully',
    data: result,
  });
});

const getAllInvoices = catchAsync(async (_req, res) => {
  const result = await invoiceService.getAllInvoices();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoices fetched successfully',
    data: result,
  });
});

const verifyPickupToken = catchAsync(async (req, res) => {
  const { tokenOrCode } = req.body;
  const result = await invoiceService.verifyPickupToken(tokenOrCode);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Pickup token verified successfully',
    data: result,
  });
});

const invoiceController = {
  getMyInvoices,
  getAllInvoices,
  verifyPickupToken,
};

export default invoiceController;
