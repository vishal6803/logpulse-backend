import { Request, Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { sendResponse } from "../../utils/responseHandler";
import { getDashboardStatsService } from "./analytics.service";

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const projectId = req.query.projectId ?? null;
  const environmentId = req.query.environmentId ?? null;
  const userId = req.user?.id ?? null;
  if (!userId) {
    return sendResponse(res, 400, "User ID is required");
  }
  try {
    const stats = await getDashboardStatsService(
      userId,
      projectId as string | null,
      environmentId as string | null,
    );
    return sendResponse(
      res,
      200,
      "Dashboard stats fetched successfully",
      stats,
    );
  } catch (error) {
    return sendResponse(res, 500, "Error fetching dashboard stats");
  }
};
