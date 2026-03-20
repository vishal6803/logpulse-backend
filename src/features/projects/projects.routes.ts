import express from "express";
import * as projectsController from "./projects.controller";
const routes = express.Router();

// create a new project
routes.post("/", projectsController.createProject);

// delete a project
routes.delete("/:id", projectsController.deleteProject);

// get a specific project by id
routes.get("/all", projectsController.getAllProjectByUserId);

export default routes;
