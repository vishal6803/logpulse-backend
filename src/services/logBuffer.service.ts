import crypto from "crypto";
import pool from "../config/db";

interface LogEvent {
  projectId: string;
  environmentId: string;
  type: string;
  level: string;
  message: string;
  stackTrace: string;
  metadata: any;
  fingerprint: string;
}
class LogBiffer {
  private buffer: LogEvent[] = [];
  private readonly FLUSH_INTERVAL_MS = 3000;
  private readonly MAX_BATCH_SIZE = 200;

  // THE SAFETY LOCK
  private isFlushing = false;

  constructor() {
    setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  public addLog(
    projectId: string,
    environmentId: string,
    type: string,
    level: string,
    message: string,
    stackTrace: string,
    metadata: any,
  ) {
    const fingerprintString = `${type}-${message}-${stackTrace}`;
    const fingerprint = crypto
      .createHash("sha256")
      .update(fingerprintString)
      .digest("hex");

    // push the log event to the buffer
    this.buffer.push({
      projectId,
      environmentId,
      type,
      level,
      message,
      stackTrace,
      metadata,
      fingerprint,
    });

    if (this.buffer.length >= this.MAX_BATCH_SIZE && !this.isFlushing) {
      setImmediate(() => this.flush());
    }
  }

  private async flush() {
    if (this.buffer.length === 0 || this.isFlushing) return;
    this.isFlushing = true;

    const batch = this.buffer.splice(0, this.MAX_BATCH_SIZE);

    console.log(`[LogBuffer] Flushing ${batch.length} logs to Postgres...`);

    const groups = new Map<string, { logs: LogEvent[]; count: number }>();

    for (const log of batch) {
      if (!groups.has(log.fingerprint)) {
        groups.set(log.fingerprint, { logs: [log], count: 1 });
      } else {
        const group = groups.get(log.fingerprint)!;
        group.logs.push(log);
        group.count += 1;
      }
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      for (const [fingerprint, data] of groups.entries()) {
        const groupResult = await client.query(
          `INSERT INTO error_groups (project_id, environment_id, fingerprint, message) 
                VALUES ($1, $2, $3, $4) 
                ON CONFLICT (fingerprint) 
                DO UPDATE SET 
                    occurrence_count = error_groups.occurrence_count + $5,
                    last_seen = CURRENT_TIMESTAMP 
                RETURNING id`,
          [
            data.logs[0].projectId,
            data.logs[0].environmentId,
            fingerprint,
            data.logs[0].message,
            data.count,
          ],
        );

        const errorGroupId = groupResult.rows[0].id;

        const valueStrings: string[] = [];
        const flattenedValues: any[] = [];
        let paramIndex = 1;
        for (const event of data.logs) {
          valueStrings.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
          );

          flattenedValues.push(
            event.projectId,
            event.environmentId,
            errorGroupId,
            event.type,
            event.level,
            event.message,
            event.stackTrace,
            event.metadata,
          );
        }
        // sending a large query with multiple rows to insert at once
        const bulkInsertQuery = `
INSERT INTO events (project_id, environment_id, error_group_id, type, level, message, stack_trace, metadata)
VALUES ${valueStrings.join(",")}
`;
        await client.query(bulkInsertQuery, flattenedValues);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error in flush:", error);
      this.buffer.unshift(...batch);
      throw error;
    } finally {
      client.release();
      this.isFlushing = false;
    }
  }
}

export const logBuffer = new LogBiffer();
