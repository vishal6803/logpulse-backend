import { Request, Response } from "express";
import {
  createProjectService,
  deleteProjectService,
  getUserProjects,
} from "./projects.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const createProject = async (req: AuthRequest, res: Response) => {
  // create a project
  const { projectName } = req.body ?? {};
  const userId = req.user.id;
  if (!projectName || !userId) {
    return res
      .status(400)
      .json({ message: "Project name and user ID are required" });
  }
  try {
    const response = await createProjectService(projectName, userId);
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ message: "Error creating project" });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  // delete a project
  const { id } = req.params as { id: string };
  const userId = req.user.id; // Assuming user ID is sent in the body for authentication

  try {
    const response = await deleteProjectService(id, userId);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: "Error deleting project" });
  }
};

export const getAllProjectByUserId = async (
  req: AuthRequest,
  res: Response,
) => {
  // get all projects by user ID
  const userId = req.user.id;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  try {
    const userProjects = await getUserProjects(userId);
    if (userProjects.length === 0) {
      return res
        .status(404)
        .json({ message: "No projects found for this user" });
    }
    res.status(200).json(userProjects);
  } catch (error) {
    res.status(500).json({ message: "Error fetching projects" });
  }
};
