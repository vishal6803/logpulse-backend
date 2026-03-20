import { Response } from "express";
import pool from "../../config/db";
import crypto from "crypto";
import { ApiKeyRequest } from "../../middlewares/apiKey.middleware";
import { logBuffer } from "../../services/logBuffer.service";
export const createIngestion = async (
  projectId: string,
  environmentName: string,
  type: string,
  level: string,
  message: string,
  stack_trace: string,
  metadata: any,
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // have to check for fingerprint exist or not if exist then update the record otherwise create a new record in ingestions table
    const fingerprintString = `${type}-${message}-${stack_trace}`;
    const fingerprint = crypto
      .createHash("sha256")
      .update(fingerprintString)
      .digest("hex");

    // get env id from env name and project id
    const environmentId = await getEnvironmentIdByEnvironmentName(
      client,
      projectId,
      environmentName,
    );

    if (!environmentId) {
      throw new Error("Environment not found");
    }

    logBuffer.addLog(
      projectId,
      environmentId,
      type,
      level,
      message,
      stack_trace,
      metadata,
    );
    await client.query("COMMIT");
    return {
      message: "Log queued for ingestion",
    };

    // Next step: Use this errorGroupId to insert the full event (with level, metadata, stack_trace) into the 'events' table!
  } catch (error) {
    client.query("ROLLBACK");
    console.error("Error in createIngestion:", (error as Error).message);
    throw new Error("Failed to create ingestion");
  } finally {
    // release the client back to the pool
    client.release();
  }
};

const getEnvironmentIdByEnvironmentName = async (
  client: any,
  projectId: string,
  environmentName: string,
) => {
  try {
    const result = await client.query(
      "SELECT id FROM environments WHERE project_id = $1 AND name = $2",
      [projectId, environmentName],
    );
    return result.rows[0].id;
  } catch (error) {
    client.query("ROLLBACK");
    throw new Error("Environment not found");
  }
};
