"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectById = exports.createProject = void 0;
const projects_service_1 = require("./projects.service");
const createProject = async (req, res) => {
    // create a project
    const { projectName, userId } = req.body;
    if (!projectName || !userId) {
        return res
            .status(400)
            .json({ message: "Project name and user ID are required" });
    }
    try {
        const response = await (0, projects_service_1.createProjectService)(projectName, userId);
        res.status(201).json(response);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating project" });
    }
};
exports.createProject = createProject;
const getProjectById = (req, res) => {
    // get a project by id
    res.status(200).json({ message: "Project fetched successfully" });
};
exports.getProjectById = getProjectById;
