import { Response } from "express";
import { stat } from "node:fs";

export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data: any = null,
) => {
  return res.status(statusCode).json({
    success: statusCode < 400,
    statusCode,
    message,
    data,
    error: statusCode >= 400 ? message : null,
  });
};
