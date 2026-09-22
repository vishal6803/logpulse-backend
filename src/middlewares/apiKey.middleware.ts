import { NextFunction, Request, Response } from "express";
import { getProjectByApiKey } from "../services/cache.service";

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
    // Zero DB hits on hot path: check L1/L2 cache first
    const project = await getProjectByApiKey(apiKey);

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
