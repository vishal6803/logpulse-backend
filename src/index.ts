import express from "express";
import authRoutes from "./features/auth/auth.routes";
import projectsRoutes from "./features/projects/projects.routes";
import ingestionRoutes from "./features/ingestion/ingestion.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import { ApiKeyAuthMiddleware } from "./middlewares/apiKey.middleware";
const app = express();
require("dotenv").config();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || "v1";
app.get("/", authMiddleware, (req, res) => {
  // will chnage when projects craeted api will be created
  res.send("Hello World!");
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", authMiddleware, projectsRoutes);
app.use(`/api/${API_VERSION}/ingest`, ApiKeyAuthMiddleware, ingestionRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
