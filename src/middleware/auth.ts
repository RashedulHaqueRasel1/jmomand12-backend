import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import config from "../config";
import AppError from "../errors/AppError";
import logger from "../logger";
import { verifyToken } from "../utils/tokenGenerate";

const auth = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const extractedToken = req.headers.authorization;
      const token = extractedToken?.split(" ")[1];
      if (!token) {
        throw new AppError("Invalid token", StatusCodes.UNAUTHORIZED);
      }

      const verifyUserData = verifyToken(token, config.JWT_SECRET as string);

      req.user = verifyUserData;

      if (roles.length && !roles.includes(verifyUserData.role)) {
        throw new AppError("You are not authorized!", StatusCodes.UNAUTHORIZED);
      }

      next();
    } catch (error: any) {
      logger.error("Authorization error:", error);
      throw new AppError("You are not authorized", StatusCodes.UNAUTHORIZED);
    }
  };
};

export default auth;
