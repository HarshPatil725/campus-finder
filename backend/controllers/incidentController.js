const { query } = require('../config/database');

/**
 * GET /api/incidents
 * Query params: status, building, access_point_id, search
 */
async function getAllIncidents(req, res, next) {
    try {
        const { status, building, access_point_id, search } = req.query;

        const conditions = [];
        const params = [];
        let pIdx = 1;

        if (status) {
            if (status.toLowerCase() === 'unresolved') {
                conditions.push(`i.status != 'Resolved'`);
            } else {
                conditions.push(`LOWER(i.status) = LOWER($${pIdx})`);
                params.push(status);
                pIdx++;
            }
        }

        if (building) {
            conditions.push(`LOWER(ap.building) = LOWER($${pIdx})`);
            params.push(building);
            pIdx++;
        }

        if (access_point_id) {
            conditions.push(`LOWER(i.access_point_id) = LOWER($${pIdx})`);
            params.push(access_point_id);
            pIdx++;
        }

        if (search) {
            conditions.push(`(
                LOWER(i.incident_id) LIKE LOWER($${pIdx}) OR
                LOWER(i.suspected_cause) LIKE LOWER($${pIdx}) OR
                LOWER(COALESCE(i.resolution, '')) LIKE LOWER($${pIdx}) OR
                LOWER(i.access_point_id) LIKE LOWER($${pIdx})
            )`);
            params.push(`%${search}%`);
            pIdx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT
                i.incident_id,
                i.access_point_id,
                ap.building,
                ap.location,
                i.start_time,
                i.end_time,
                i.status,
                i.suspected_cause,
                i.resolution
            FROM incidents i
            JOIN access_points ap ON i.access_point_id = ap.access_point_id
            ${whereClause}
            ORDER BY i.start_time DESC
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
 * GET /api/incidents/:id
 * Returns single incident with affected device details and related telemetry evidence readings
 */
async function getIncidentById(req, res, next) {
    try {
        const { id } = req.params;

        const incSql = `
            SELECT
                i.incident_id,
                i.access_point_id,
                ap.building,
                ap.location,
                i.start_time,
                i.end_time,
                i.status,
                i.suspected_cause,
                i.resolution
            FROM incidents i
            JOIN access_points ap ON i.access_point_id = ap.access_point_id
            WHERE LOWER(i.incident_id) = LOWER($1)
        `;
        const incRes = await query(incSql, [id]);

        if (incRes.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: `Incident '${id}' not found`,
            });
        }

        const incident = incRes.rows[0];

        // Fetch related network readings for the affected device surrounding the incident window
        // (Window: 2 hours before start_time up to 2 hours after end_time, or latest readings if unresolved)
        const readingsSql = `
            SELECT
                r.reading_id,
                r.access_point_id,
                r.timestamp,
                r.latency_ms,
                r.packet_loss_pct,
                r.is_up,
                r.health_status
            FROM v_network_readings_with_health r
            WHERE LOWER(r.access_point_id) = LOWER($1)
              AND r.timestamp >= ($2::timestamp - INTERVAL '2 hours')
              AND r.timestamp <= (COALESCE($3::timestamp, (SELECT MAX(timestamp) FROM network_readings)) + INTERVAL '2 hours')
            ORDER BY r.timestamp ASC
        `;
        const readingsRes = await query(readingsSql, [
            incident.access_point_id,
            incident.start_time,
            incident.end_time,
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                ...incident,
                related_readings_count: readingsRes.rows.length,
                related_readings: readingsRes.rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAllIncidents,
    getIncidentById,
};
