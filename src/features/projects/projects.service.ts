import pool from "../../config/db";
import crypto from "crypto";
export const createProjectService = async (
  projectName: string,
  userId: string,
) => {
  // logic to create a project in the database
  const client = await pool.connect();

  try {
    // start a transaction
    await client.query("BEGIN");
    const apiKey = "lp_proj_" + crypto.randomBytes(16).toString("hex");
    const defaultSettings = {
      retention_days: 30, // How long we keep their logs
      alerts_enabled: true, // Should we email them on crashes?
      rate_limit_per_minute: 60, // Prevent spam
    };

    const projectResult = await client.query(
      "INSERT INTO projects (id, name, user_id , api_key) VALUES (gen_random_uuid(), $1, $2 , $3) RETURNING id",
      [projectName, userId, apiKey],
    );

    const newProject = projectResult.rows[0];

    // insert default environments
    const envResult = await client.query(
      `INSERT INTO environments (id, project_id, name , settings) 
       VALUES (gen_random_uuid(), $1, $2, $3) 
       RETURNING id, name`,
      [newProject.id, "Production", defaultSettings],
    );
    const defaultEnvironment = envResult.rows[0];

    await client.query("COMMIT");

    return {
      message: "Project created successfully",
      ...newProject,
      environments: [defaultEnvironment],
    };

    // commit the transaction
  } catch (error) {
    console.error("🔥 DB CRASH REASON:", (error as Error).message);
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteProjectService = async (
  projectId: string,
  userId: string,
) => {
  // logic to delete a project from the database
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // DELETE Environments
    await client.query("DELETE FROM environments WHERE project_id = $1", [
      projectId,
    ]);

    // DELETE Project
    const result = await client.query(
      "DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id",
      [projectId, userId],
    );

    const deletedProject = result.rows[0];

    // Check if it actually deleted anything
    if (!deletedProject) {
      // If we throw here, the ROLLBACK automatically restores the environments we just deleted!
      throw new Error(
        "Project not found or you don't have permission to delete",
      );
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("🔥 DB CRASH REASON:", (error as Error).message);
    throw error;
  } finally {
    client.release();
  }
};

export const getUserProjects = async (userId: string) => {
  const projects = await pool.query(
    `SELECT 
      p.id, 
      p.name, 
      p.api_key, 
      p.created_at,
      -- This squashes the environments into an array of objects!
      COALESCE(
        json_agg(
          json_build_object('id', e.id, 'name', e.name)
        ) FILTER (WHERE e.id IS NOT NULL), 
        '[]'
      ) AS environments
    FROM projects p
    LEFT JOIN environments e ON p.id = e.project_id
    WHERE p.user_id = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC`,
    [userId],
  );
  return projects.rows;
};
