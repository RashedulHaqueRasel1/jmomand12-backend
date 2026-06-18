import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import userService from "./user.service";
import config from "../../config";

const registerUser = catchAsync(async (req, res) => {
  const result = await userService.registerUser(req.body);

  const { refreshToken, accessToken, user } = result;
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: config.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Account created successfully. Please verify your email.",
    data: {
      accessToken,
      user,
    },
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await userService.verifyEmail(email, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Email verified successfully. You can now log in.",
    data: result,
  });
});

const resendOtpCode = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await userService.resendOtpCode(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "OTP code sent successfully",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const result = await userService.getAllUsers();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Users retrieved successfully.",
    data: result,
  });
});

const getAdminId = catchAsync(async (req, res) => {
  const result = await userService.getAdminId();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Admin ID fetched successfully",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const { email } = req.user;

  const result = await userService.getMyProfile(email);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Your profile has been retrieved successfully.",
    data: result,
  });
});

const updateUserProfile = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await userService.updateUserProfile(req.body, email, req.file);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Your profile has been updated successfully.",
    data: result,
  });
});

const userController = {
  registerUser,
  verifyEmail,
  resendOtpCode,
  getAllUsers,
  getMyProfile,
  updateUserProfile,
  getAdminId,
};

export default userController;
