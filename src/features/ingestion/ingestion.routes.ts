import express from "express";
import { ingestionController } from "./ingestion.controller";

const routes = express.Router();

routes.post("/", ingestionController);

export default routes;
