import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import Notification from "./notification.model";

export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await Notification.updateMany(
    { isViewed: false },
    { isViewed: true }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read successfully",
    data: result,
  });
});

export const getAllNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Notification.countDocuments();
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notifications fetched successfully",
      meta: {
        page,
        limit,
        totalPage: Math.ceil(total / limit),
        total,
      },
      data: notifications,
    });
  }
);
