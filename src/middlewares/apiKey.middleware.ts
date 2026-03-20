import { NextFunction, Request, Response } from "express";
import pool from "../config/db";

export interface ApiKeyRequest extends Request {
  project?: {
    id: string;
  };
}

export const ApiKeyAuthMiddleware = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Missing x-api-key header" });
  }

  try {
    // check for apikey exist in out database
    const result = await pool.query(
      "SELECT id FROM projects WHERE api_key = $1",
      [apiKey],
    );

    const project = result.rows[0];

    if (!project) {
      return res.status(401).json({ message: "Unauthorized: Invalid API key" });
    }

    req.project = { id: project.id };
    next();
  } catch (error) {
    console.error("[API Key Middleware Error]:", (error as Error).message);
    return res.status(401).json({ message: "Unauthorized: Invalid API key" });
  }
};
