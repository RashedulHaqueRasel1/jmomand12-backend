import { Response } from "express";

type TMeta = {
  limit: number;
  page: number;
  total: number;
  totalPage: number;
};

type TResponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string;
  data?: T;
  meta?: TMeta;
  links?: Record<string, string>;
};

const sendResponse = <T>(res: Response, data: TResponse<T>) => {
  res.status(data.statusCode).json({
    success: data.success,
    message: data.message,
    statusCode: data.statusCode,
    data: data.data,
    meta: data?.meta,
    _links: data?.links,
  });
};

export default sendResponse;
