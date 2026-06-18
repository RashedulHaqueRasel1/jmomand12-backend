import { StatusCodes } from 'http-status-codes';
import AppError from '../errors/AppError';
import { createToken } from '../utils/tokenGenerate';
import config from '../config';
import { IUser } from '../modules/user/user.interface';

export const validateUserStatus = (user: any) => {
  if (user.isSuspend) {
    throw new AppError('Your account has been suspended.', StatusCodes.FORBIDDEN);
  }

  if (user.isBlocked) {
    throw new AppError('Your account has been blocked.', StatusCodes.FORBIDDEN);
  }

  if (!user.isVerified) {
    throw new AppError('Please verify your email before logging in.', StatusCodes.UNAUTHORIZED);
  }
};

export const buildUserResponse = (user: any) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  image: user.image,
  phone: user.phone,
  street: user.street,
  location: user.location,
  postalCode: user.postalCode,
  dateOfBirth: user.dateOfBirth,
});

export const generateTokens = (user: any) => {
  const tokenPayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    tokenPayload,
    config.JWT_SECRET as string,
    config.JWT_EXPIRES_IN as string,
  );

  const refreshToken = createToken(
    tokenPayload,
    config.refreshTokenSecret as string,
    config.jwtRefreshTokenExpiresIn as string,
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const buildUserResponseRegister = (user: IUser) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  image: user.image,
});

import bcrypt from 'bcrypt';

export const generateOtp = async () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  return {
    otp,
    hashedOtp,
    otpExpires,
  };
};
