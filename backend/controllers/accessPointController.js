const { query } = require('../config/database');

/**
 * GET /api/access-points
 * Query params: building, search, status
 */
async function getAllAccessPoints(req, res, next) {
    try {
        const { building, search, status } = req.query;

        const conditions = [];
        const params = [];
        let pIdx = 1;

        if (building) {
            conditions.push(`LOWER(building) = LOWER($${pIdx})`);
            params.push(building);
            pIdx++;
        }

        if (search) {
            conditions.push(`(LOWER(access_point_id) LIKE LOWER($${pIdx}) OR LOWER(location) LIKE LOWER($${pIdx}))`);
            params.push(`%${search}%`);
            pIdx++;
        }

        if (status) {
            conditions.push(`LOWER(current_status) = LOWER($${pIdx})`);
            params.push(status);
            pIdx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT
                access_point_id,
                building,
                location,
                reading_id,
                latest_reading_timestamp,
                latest_latency_ms,
                latest_packet_loss_pct,
                latest_is_up,
                current_status
            FROM v_latest_access_point_status
            ${whereClause}
            ORDER BY access_point_id ASC
        `;

        const result = await query(sql, params);

        res.status(200).json({
            status: 'success',
            count: result.rows.length,
            data: result.rows,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/access-points/:id
 * Returns access point details, current status, recent incidents, and recent readings
 */
async function getAccessPointById(req, res, next) {
    try {
        const { id } = req.params;

        // Fetch access point with latest status
        const apSql = `
            SELECT
                access_point_id,
                building,
                location,
                reading_id,
                latest_reading_timestamp,
                latest_latency_ms,
                latest_packet_loss_pct,
                latest_is_up,
                current_status
            FROM v_latest_access_point_status
            WHERE LOWER(access_point_id) = LOWER($1)
        `;
        const apRes = await query(apSql, [id]);

        if (apRes.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: `Access point '${id}' not found`,
            });
        }

        const accessPoint = apRes.rows[0];

        // Fetch all incidents for this access point
        const incSql = `
            SELECT
                incident_id,
                access_point_id,
                start_time,
                end_time,
                status,
                suspected_cause,
                resolution
            FROM incidents
            WHERE LOWER(access_point_id) = LOWER($1)
            ORDER BY start_time DESC
        `;
        const incRes = await query(incSql, [id]);

        // Fetch latest 10 readings for quick inspection
        const readingsSql = `
            SELECT
                reading_id,
                access_point_id,
                timestamp,
                latency_ms,
                packet_loss_pct,
                is_up,
                health_status
            FROM v_network_readings_with_health
            WHERE LOWER(access_point_id) = LOWER($1)
            ORDER BY timestamp DESC
            LIMIT 10
        `;
        const readingsRes = await query(readingsSql, [id]);

        res.status(200).json({
            status: 'success',
            data: {
                ...accessPoint,
                incidents: incRes.rows,
                recent_readings: readingsRes.rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAllAccessPoints,
    getAccessPointById,
};
