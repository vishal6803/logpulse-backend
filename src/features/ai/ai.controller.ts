import { Request, Response } from "express";
import { sendResponse } from "../../utils/responseHandler";
import {
  analyzeErrorGroupService,
  getCachedAnalysisService,
} from "./ai.service";

/**
 * Trigger AI Root-Cause Analysis for a given error group.
 * Supports on-demand triggering and forced cache bypass (e.g. ?force=true).
 */
export const analyzeErrorGroup = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params as { id: string };
  const force = req.query.force === "true" || req.body?.force === true;

  if (!id) {
    sendResponse(res, 400, "Error group ID is required");
    return;
  }

  try {
    const analysis = await analyzeErrorGroupService(id, { force });
    sendResponse(
      res,
      200,
      analysis.cached
        ? "Retrieved cached AI analysis"
        : "AI root-cause analysis completed successfully",
      analysis
    );
  } catch (error: any) {
    console.error(`[AIController] Error analyzing error group ${id}:`, error);

    const statusCode = error.statusCode || 500;
    const message =
      error.message || "Failed to analyze error group with AI engine";

    sendResponse(res, statusCode, message);
  }
};

/**
 * Retrieve existing/cached AI analysis for an error group without invoking the LLM.
 */
export const getExistingAnalysis = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params as { id: string };

  if (!id) {
    sendResponse(res, 400, "Error group ID is required");
    return;
  }

  try {
    const analysis = await getCachedAnalysisService(id);
    if (!analysis) {
      sendResponse(
        res,
        404,
        "No AI analysis found for this error group. Trigger an analysis via POST."
      );
      return;
    }

    sendResponse(
      res,
      200,
      "Retrieved cached AI analysis successfully",
      analysis
    );
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Failed to retrieve cached AI analysis";
    sendResponse(res, statusCode, message);
  }
};
