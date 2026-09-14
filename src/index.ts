import express, { Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./features/auth/auth.routes";
import projectsRoutes from "./features/projects/projects.routes";
import analyticsRoutes from "./features/analytics/analytics.routes";
import ingestionRoutes from "./features/ingestion/ingestion.routes";
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware";
import {
  ApiKeyAuthMiddleware,
  ApiKeyRequest,
} from "./middlewares/apiKey.middleware";
import pool from "./config/db";
import { sendResponse } from "./utils/responseHandler";
const app = express();
// app.use(cors({ origin: "*" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

require("dotenv").config();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || "v1";
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// app.use((req, res, next) => {
//   console.log("REQ:", req.method, req.url);
//   next();
// });
