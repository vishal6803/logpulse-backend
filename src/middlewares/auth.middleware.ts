import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any; // You can replace 'any' with a more specific type based on your user model
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token =
    req.cookies.lp_session || req.headers.authorization?.split(" ")[1];
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      req.user = { id: "a52c086d-38f9-4865-a75a-b1adbadefe12" };
      return next();
    }
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }
  // const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      message: "FATAL ERROR: JWT_SECRET is not defined in the .env file!",
    });
  }
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
