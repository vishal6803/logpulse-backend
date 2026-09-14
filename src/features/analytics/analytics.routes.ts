import express from "express";
import { getDashboardStats } from "./analytics.controller";
const routes = express.Router();

routes.get("/dashboard-stats", getDashboardStats);

export default routes;
