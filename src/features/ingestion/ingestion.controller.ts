import { Response } from "express";
import { ApiKeyRequest } from "../../middlewares/apiKey.middleware";
import pool from "../../config/db";
import { createIngestion } from "./ingestion.service";

export const ingestionController = async (
  req: ApiKeyRequest,
  res: Response,
) => {
  const { environmentName, level, type, message, stack_trace, metadata } =
    req.body ?? {};
  const { id } = req.project ?? {};
  if (
    !id ||
    !environmentName ||
    !level ||
    !type ||
    !message ||
    !stack_trace ||
    !metadata
  ) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  try {
    const result = await createIngestion(
      id,
      environmentName,
      type,
      level,
      message,
      stack_trace,
      metadata,
    );
    console.log(result, "result from ingestion controller");
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
  res.send("Create a new ingestion");
};
