import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import contactService from "./contact.service";

const sendContact = catchAsync(async (req, res) => {
  const result = await contactService.sendContact(req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Contact message sent successfully",
    data: result,
  });
});

export const contactController = {
  sendContact,
};
