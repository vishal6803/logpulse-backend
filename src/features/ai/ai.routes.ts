import express from "express";
import { analyzeErrorGroup, getExistingAnalysis } from "./ai.controller";

const router = express.Router();

/**
 * AI Root-Cause Analysis Endpoints
 * POST /api/v1/ai/error-groups/:id/analyze (or /api/v1/error-groups/:id/analyze)
 * GET  /api/v1/ai/error-groups/:id/analysis (or /api/v1/error-groups/:id/analysis)
 */
router.post("/error-groups/:id/analyze", analyzeErrorGroup);
router.get("/error-groups/:id/analysis", getExistingAnalysis);

// Also direct alias if mounted at /error-groups
router.post("/:id/analyze", analyzeErrorGroup);
router.get("/:id/analysis", getExistingAnalysis);

export default router;
