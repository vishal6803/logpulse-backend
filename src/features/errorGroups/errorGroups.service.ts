import pool from "../../config/db";

export interface ListErrorGroupsOptions {
  userId?: string;
  projectId?: string;
  environmentId?: string;
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const listErrorGroupsService = async (options: ListErrorGroupsOptions = {}) => {
  const { userId, projectId, environmentId, search, status, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Filter by user's projects if they own projects, otherwise allow viewing available issues
  if (userId) {
    const userProjects = await pool.query("SELECT id FROM projects WHERE user_id = $1", [userId]);
    if (userProjects.rows.length > 0) {
      conditions.push(`p.user_id = $${paramIndex++}`);
      params.push(userId);
    }
  }

  if (projectId) {
    conditions.push(`eg.project_id = $${paramIndex++}`);
    params.push(projectId);
  }

  if (environmentId) {
    conditions.push(`eg.environment_id = $${paramIndex++}`);
    params.push(environmentId);
  }

  if (status) {
    conditions.push(`eg.status = $${paramIndex++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(eg.message ILIKE $${paramIndex} OR eg.fingerprint ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT 
      eg.id,
      eg.project_id,
      eg.environment_id,
      eg.fingerprint,
      eg.message,
      eg.occurrence_count,
      eg.first_seen,
      eg.last_seen,
      eg.status,
      eg.ai_summary,
      eg.ai_confidence,
      eg.ai_analyzed_at,
      p.name AS project_name,
      e.name AS environment_name
    FROM error_groups eg
    LEFT JOIN projects p ON eg.project_id = p.id
    LEFT JOIN environments e ON eg.environment_id = e.id
    ${whereClause}
    ORDER BY eg.last_seen DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  params.push(limit, offset);

  const res = await pool.query(query, params);
  return res.rows;
};

export const getErrorGroupDetailService = async (groupId: string, userId?: string) => {
  const query = `
    SELECT 
      eg.id,
      eg.project_id,
      eg.environment_id,
      eg.fingerprint,
      eg.message,
      eg.occurrence_count,
      eg.first_seen,
      eg.last_seen,
      eg.status,
      eg.ai_summary,
      eg.ai_root_cause,
      eg.ai_fix_suggestion,
      eg.ai_confidence,
      eg.ai_analyzed_at,
      p.name AS project_name,
      e.name AS environment_name
    FROM error_groups eg
    LEFT JOIN projects p ON eg.project_id = p.id
    LEFT JOIN environments e ON eg.environment_id = e.id
    WHERE eg.id = $1;
  `;

  const groupRes = await pool.query(query, [groupId]);

  if (groupRes.rows.length === 0) {
    const error: any = new Error("Error group not found");
    error.statusCode = 404;
    throw error;
  }

  const group = groupRes.rows[0];

  // Fetch recent events for stack traces and metadata
  const eventsQuery = `
    SELECT id, type, level, message, stack_trace, metadata, created_at
    FROM events
    WHERE error_group_id = $1
    ORDER BY created_at DESC
    LIMIT 10;
  `;
  const eventsRes = await pool.query(eventsQuery, [groupId]);

  return {
    ...group,
    events: eventsRes.rows,
  };
};
