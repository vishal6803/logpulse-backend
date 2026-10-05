import dotenv from "dotenv";
dotenv.config();

import express, { Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./features/auth/auth.routes";
import projectsRoutes from "./features/projects/projects.routes";
import analyticsRoutes from "./features/analytics/analytics.routes";
import ingestionRoutes from "./features/ingestion/ingestion.routes";
import aiRoutes from "./features/ai/ai.routes";
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware";
import {
  ApiKeyAuthMiddleware,
  ApiKeyRequest,
} from "./middlewares/apiKey.middleware";
import pool from "./config/db";
import redis from "./config/redis";
import { sendResponse } from "./utils/responseHandler";

const app = express();

app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || "v1";

// Telemetry & Health endpoint
app.get("/health", async (req, res) => {
  try {
    const dbCheck = await pool.query("SELECT 1");
    const redisCheck = await redis.ping();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: dbCheck.rows.length > 0 ? "healthy" : "unhealthy",
        redis: redisCheck === "PONG" ? "healthy" : "unhealthy",
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: "degraded",
      error: error.message,
    });
  }
});

app.get("/", authMiddleware, (req, res) => {
  // will chnage when projects craeted api will be created
  res.send("Hello World!");
});

app.use(
  "/api/auth/me",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const user = await pool.query(
      "SELECT id, email, name FROM users WHERE id = $1",
      [req.user.id],
    );
    const userData = user.rows[0];

    res.json({
      success: true,
      user: { id: userData.id, name: userData.name, email: userData.email },
    });
  },
);
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/projects`, authMiddleware, projectsRoutes);
app.use(`/api/${API_VERSION}/analytics`, authMiddleware, analyticsRoutes);
app.use(`/api/${API_VERSION}/ingest`, ApiKeyAuthMiddleware, ingestionRoutes);
app.use(`/api/${API_VERSION}/ai`, authMiddleware, aiRoutes);
app.use(`/api/${API_VERSION}/error-groups`, authMiddleware, aiRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// app.use((req, res, next) => {
//   console.log("REQ:", req.method, req.url);
//   next();
// });
