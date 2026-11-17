const { query } = require('../config/database');

/**
 * GET /api/overview
 * Returns system-wide or building-filtered network status, device counts,
 * incident counts, latest reading timestamp, and recent activity.
 */
async function getOverview(req, res, next) {
    try {
        const { building } = req.query;

        // Base filter clauses if building is provided
        const buildingFilterClause = building ? 'WHERE ap.building = $1' : '';
        const incidentBuildingClause = building
            ? 'JOIN access_points ap ON i.access_point_id = ap.access_point_id WHERE ap.building = $1'
            : '';
        const params = building ? [building] : [];

        // 1. Device Health Stats from v_latest_access_point_status
        const deviceStatsSql = `
            SELECT
                COUNT(*)::int AS total_access_points,
                COUNT(*) FILTER (WHERE current_status = 'Healthy')::int AS healthy_access_points,
                COUNT(*) FILTER (WHERE current_status = 'Degraded')::int AS degraded_access_points,
                COUNT(*) FILTER (WHERE current_status = 'Down')::int AS down_access_points,
                MAX(latest_reading_timestamp) AS latest_reading_timestamp
            FROM v_latest_access_point_status ap
            ${buildingFilterClause}
        `;
        const deviceStatsRes = await query(deviceStatsSql, params);
        const deviceStats = deviceStatsRes.rows[0];

        // 2. Incident Stats
        const incidentStatsSql = `
            SELECT
                COUNT(*)::int AS total_incidents,
                COUNT(*) FILTER (WHERE i.status = 'Resolved')::int AS resolved_incidents,
                COUNT(*) FILTER (WHERE i.status != 'Resolved')::int AS unresolved_incidents,
                COUNT(*) FILTER (WHERE i.status = 'Open')::int AS open_incidents,
                COUNT(*) FILTER (WHERE i.status = 'Investigating')::int AS investigating_incidents
            FROM incidents i
            ${incidentBuildingClause}
        `;
        const incidentStatsRes = await query(incidentStatsSql, params);
        const incidentStats = incidentStatsRes.rows[0];

        // 3. Recent Incidents (latest 5)
        const recentIncidentsSql = `
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
            ${building ? 'WHERE ap.building = $1' : ''}
            ORDER BY i.start_time DESC
            LIMIT 5
        `;
        const recentIncidentsRes = await query(recentIncidentsSql, params);

        // 4. Latest Readings per Device
        const latestReadingsSql = `
            SELECT
                access_point_id,
                building,
                location,
                latest_reading_timestamp AS timestamp,
                latest_latency_ms AS latency_ms,
                latest_packet_loss_pct AS packet_loss_pct,
                latest_is_up AS is_up,
                current_status AS health_status
            FROM v_latest_access_point_status ap
            ${buildingFilterClause}
            ORDER BY access_point_id ASC
        `;
        const latestReadingsRes = await query(latestReadingsSql, params);

        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    total_access_points: deviceStats.total_access_points || 0,
                    healthy_access_points: deviceStats.healthy_access_points || 0,
                    degraded_access_points: deviceStats.degraded_access_points || 0,
                    down_access_points: deviceStats.down_access_points || 0,
                    total_incidents: incidentStats.total_incidents || 0,
                    resolved_incidents: incidentStats.resolved_incidents || 0,
                    unresolved_incidents: incidentStats.unresolved_incidents || 0,
                    open_incidents: incidentStats.open_incidents || 0,
                    investigating_incidents: incidentStats.investigating_incidents || 0,
                    latest_reading_timestamp: deviceStats.latest_reading_timestamp,
                    filter_applied: building ? { building } : null,
                },
                recent_incidents: recentIncidentsRes.rows,
                latest_readings: latestReadingsRes.rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getOverview,
};
