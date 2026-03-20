import express from "express";
import pool from "../../config/db";
import { ApiKeyRequest } from "../../middlewares/apiKey.middleware";
import { ingestionController } from "./ingestion.controller";
const routes = express.Router();

const req = {
  environment_name: "Production",
  level: "error",
  type: "ReferenceError",
  message: "window.analytics is not a function",
  stack_trace:
    "ReferenceError: window.analytics is not a function \n at onClick (Button.jsx:12) \n at render (App.jsx:45)",
  metadata: {
    browser: "Chrome 120",
    os: "Windows 11",
    url: "https://mycoolapp.com/checkout",
  },
};

routes.post("/", ingestionController);

export default routes;
