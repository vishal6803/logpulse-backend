import express from "express";
import {
  getErrorGroupDetail,
  listErrorGroups,
} from "./errorGroups.controller";
import {
  analyzeErrorGroup,
  getExistingAnalysis,
} from "../ai/ai.controller";

const router = express.Router();

// List error groups
router.get("/", listErrorGroups);

// Get specific error group detail with events and AI analysis
router.get("/:id", getErrorGroupDetail);

// AI Analysis endpoints for this error group
router.post("/:id/analyze", analyzeErrorGroup);
router.get("/:id/analysis", getExistingAnalysis);

export default router;
