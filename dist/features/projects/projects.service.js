"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectService = void 0;
const db_1 = __importDefault(require("../../config/db"));
const crypto_1 = __importDefault(require("crypto"));
const createProjectService = async (projectName, userId) => {
    // logic to create a project in the database
    const client = await db_1.default.connect();
    try {
        // start a transaction
        await client.query("BEGIN");
        const apiKey = "lp_proj_" + crypto_1.default.randomBytes(16).toString("hex");
        const defaultSettings = {
            retention_days: 30, // How long we keep their logs
            alerts_enabled: true, // Should we email them on crashes?
            rate_limit_per_minute: 60, // Prevent spam
        };
        const projectResult = await db_1.default.query("INSERT INTO projects (id, name, user_id , api_key , settings) VALUES (gen_random_uuid(), $1, $2 , $3, $4) RETURNING id", [projectName, userId, apiKey, defaultSettings]);
        const newProject = projectResult.rows[0];
        // insert default environments
        const envResult = await client.query(`INSERT INTO environments (id, project_id, name) 
       VALUES (gen_random_uuid(), $1, $2) 
       RETURNING id, name`, [newProject.id, "Production"]);
        const defaultEnvironment = envResult.rows[0];
        await client.query("COMMIT");
        return {
            message: "Project created successfully",
            ...newProject,
            environments: [defaultEnvironment],
        };
        // commit the transaction
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
};
exports.createProjectService = createProjectService;
