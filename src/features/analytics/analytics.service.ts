import pool from "../../config/db";

export const getDashboardStatsService = async (
  userId: string,
  projectId: string | null,
  environmentId: string | null,
) => {
  try {
    if (projectId && environmentId) {
      // Fetch stats for specific environment
      const totalErrors24h = await pool.query(
        `
              SELECT 
        COALESCE(
          SUM(
            CASE
              WHEN eg.last_seen > NOW() - INTERVAL '24 hours'
              THEN eg.occurrence_count ELSE 0
            END
          ), 0) as current_24h,
          
        COALESCE(
          SUM(
            CASE
              WHEN eg.last_seen <= NOW() - INTERVAL '24 hours' -- Older than 24h
               AND eg.last_seen > NOW() - INTERVAL '48 hours'  -- But newer than 48h
              THEN eg.occurrence_count ELSE 0
            END
          ), 0) as previous_24h
      FROM projects p 
      JOIN users u ON p.user_id = u.id 
      JOIN error_groups eg ON eg.project_id = p.id  
      WHERE u.id = $1 
        AND p.id = $2 
        AND eg.environment_id = $3
      GROUP BY p.id, u.id;
              
              `,
        [userId, projectId, environmentId],
      );
      const previous24hPercentage = calculatePercentageChange(
        totalErrors24h.rows[0].previous_24h,
        totalErrors24h.rows[0].current_24h,
      );
      return { totalErrors: totalErrors24h.rows[0], previous24hPercentage };
    }
    if (projectId && !environmentId) {
      const totalErrors24h = await pool.query(
        `
              SELECT 
        COALESCE(
          SUM(
            CASE
              WHEN eg.last_seen > NOW() - INTERVAL '24 hours'
              THEN eg.occurrence_count ELSE 0
            END
          ), 0) as current_24h,
          
        COALESCE(
          SUM(
            CASE
              WHEN eg.last_seen <= NOW() - INTERVAL '24 hours' -- Older than 24h
               AND eg.last_seen > NOW() - INTERVAL '48 hours'  -- But newer than 48h
              THEN eg.occurrence_count ELSE 0
            END
          ), 0) as previous_24h
      FROM projects p 
      JOIN users u ON p.user_id = u.id 
      JOIN error_groups eg ON eg.project_id = p.id  
      WHERE u.id = $1 
        AND p.id = $2 
      GROUP BY p.id, u.id;
              
              `,
        [userId, projectId],
      );

      const previous24hPercentage = calculatePercentageChange(
        totalErrors24h.rows[0].previous_24h,
        totalErrors24h.rows[0].current_24h,
      );
      const result = {
        totalErrors: {
          totalErrors24h: totalErrors24h.rows[0].current_24h,
          previous24hPercentage,
        },
      };
      return result;
      // Fetch stats for specific project (all environments)
    }
    if (!projectId && !environmentId) {
      // Fetch stats for all projects and environments of the user
      const totalErrors24h = await pool.query(
        `
              SELECT 
        COALESCE(
          SUM(
            CASE
              WHEN eg.last_seen > NOW() - INTERVAL '24 hours'
              THEN eg.occurrence_count ELSE 0
            END
          ), 0) as current_24h,
          
        COALESCE(
          SUM(
            CASE
              WHEN eg.last_seen <= NOW() - INTERVAL '24 hours' -- Older than 24h
               AND eg.last_seen > NOW() - INTERVAL '48 hours'  -- But newer than 48h
              THEN eg.occurrence_count ELSE 0
            END
          ), 0) as previous_24h
      FROM projects p 
      JOIN users u ON p.user_id = u.id 
      JOIN error_groups eg ON eg.project_id = p.id  
      WHERE u.id = $1 
      GROUP BY p.id, u.id;
              
              `,
        [userId],
      );

      const previous24hPercentage = calculatePercentageChange(
        totalErrors24h.rows[0].previous_24h,
        totalErrors24h.rows[0].current_24h,
      );
      return { totalErrors: totalErrors24h.rows[0], previous24hPercentage };
    }
  } catch (error) {
    throw (error as Error).message;
  }
};

const calculatePercentageChange = (
  previous: number,
  current: number,
): number => {
  // folmula ((current - previous) / previous) * 100
  let percentageChange = 0;
  if (previous > 0) {
    percentageChange = ((current - previous) / previous) * 100;
  } else if (current > 0) {
    percentageChange = 100;
  }
  return percentageChange;
};
