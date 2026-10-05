import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { sendResponse } from "../../utils/responseHandler";
import {
  getErrorGroupDetailService,
  listErrorGroupsService,
} from "./errorGroups.service";

export const listErrorGroups = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { projectId, environmentId, search, status, limit, offset } = req.query;

    const groups = await listErrorGroupsService({
      userId,
      projectId: projectId ? String(projectId) : undefined,
      environmentId: environmentId ? String(environmentId) : undefined,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });

    sendResponse(res, 200, "Error groups fetched successfully", groups);
  } catch (error: any) {
    console.error("[ErrorGroupsController] listErrorGroups error:", error);
    sendResponse(res, 500, error.message || "Failed to fetch error groups");
  }
};

export const getErrorGroupDetail = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user?.id;

    if (!id) {
      sendResponse(res, 400, "Error group ID is required");
      return;
    }

    const detail = await getErrorGroupDetailService(id, userId);
    sendResponse(res, 200, "Error group details fetched successfully", detail);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    sendResponse(res, statusCode, error.message || "Failed to fetch error group details");
  }
};
