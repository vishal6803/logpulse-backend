import { Response } from "express";
import { ApiKeyRequest } from "../../middlewares/apiKey.middleware";
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
    !stack_trace
  ) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["environmentName", "level", "type", "message", "stack_trace"],
    });
  }

  try {
    const result = await createIngestion(
      id,
      environmentName,
      type,
      level,
      message,
      stack_trace,
      metadata || {},
    );

    return res.status(202).json({
      status: "queued",
      eventId: result.eventId,
    });
  } catch (error) {
    console.error("[Ingestion Error]:", (error as Error).message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
