import e, { Request, Response } from "express";
import { loginUserService, registerUserService } from "./auth.service";
export const registerUser = async (req: Request, res: Response) => {
  if (!req.body.email || !req.body.password || !req.body.name) {
    return res
      .status(400)
      .json({ message: "Email, password and name are required" });
  }
  // register a user
  try {
    const newUser = await registerUserService(req.body);
    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    if (errorMessage === "Email already exists") {
      return res.status(409).json({ message: errorMessage });
    }
    res.status(500).json({ message: errorMessage });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const token = await loginUserService(req.body.email, req.body.password);
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    if (errorMessage === "Invalid email or password") {
      res.status(401).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: errorMessage });
    }
  }
};
