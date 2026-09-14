import e, { Request, Response } from "express";
import { loginUserService, registerUserService } from "./auth.service";
import { sendResponse } from "../../utils/responseHandler";

export const registerUser = async (req: Request, res: Response) => {
  if (!req.body.email || !req.body.password || !req.body.name) {
    return res
      .status(400)
      .json({ message: "Email, password and name are required" });
  }
  // register a user
  try {
    const newUser = await registerUserService(req.body);
    return sendResponse(res, 201, "User registered successfully", newUser);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    if (errorMessage === "Email already exists") {
      return sendResponse(res, 409, errorMessage);
    }
    return sendResponse(res, 500, errorMessage);
  }
};

export const loginUser = async (req: Request, res: Response) => {
  if (!req.body.email || !req.body.password) {
    return sendResponse(res, 400, "Email and password are required");
  }

  try {
    const token = await loginUserService(req.body.email, req.body.password);
    res.cookie("lp_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Set secure flag in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Set sameSite to 'none' in production for cross-site cookies, otherwise 'lax'
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: "/", // Ensure cookie is available for all routes
    });
    return sendResponse(res, 200, "Login successful", { data: null });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    if (errorMessage === "Invalid email or password") {
      return sendResponse(res, 401, errorMessage);
    } else {
      return sendResponse(res, 500, errorMessage);
    }
  }
};
