const { query } = require('../config/database');

/**
 * GET /api/analytics/summary
 * Aggregated network and incident statistics across all buildings and access points
 */
async function getAnalyticsSummary(req, res, next) {
    try {
        // 1. Overall Reading Health Distribution
        const healthDistSql = `
            SELECT
                health_status,
                COUNT(*)::int AS count,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM network_readings)), 2)::float AS percentage
            FROM v_network_readings_with_health
            GROUP BY health_status
            ORDER BY health_status
        `;
        const healthDistRes = await query(healthDistSql);

        // Map health distribution
        const healthMap = { Healthy: 0, Degraded: 0, Down: 0 };
        healthDistRes.rows.forEach(r => {
            healthMap[r.health_status] = r.count;
        });

        // 2. Current Device Status Distribution
        const deviceStatusSql = `
            SELECT
                current_status,
                COUNT(*)::int AS count
            FROM v_latest_access_point_status
            GROUP BY current_status
            ORDER BY current_status
        `;
        const deviceStatusRes = await query(deviceStatusSql);
        const deviceStatusMap = { Healthy: 0, Degraded: 0, Down: 0 };
        deviceStatusRes.rows.forEach(r => {
            deviceStatusMap[r.current_status] = r.count;
        });

        // 3. Building-wise Aggregation
        const buildingStatsSql = `
            SELECT
                ap.building,
                COUNT(DISTINCT ap.access_point_id)::int AS access_point_count,
                COUNT(r.reading_id)::int AS total_readings,
                ROUND(AVG(r.latency_ms)::numeric, 1)::float AS avg_latency_ms,
                ROUND(AVG(r.packet_loss_pct)::numeric, 1)::float AS avg_packet_loss_pct,
                COUNT(r.reading_id) FILTER (WHERE r.health_status = 'Degraded')::int AS degraded_readings,
                COUNT(r.reading_id) FILTER (WHERE r.health_status = 'Down')::int AS down_readings,
                COUNT(DISTINCT i.incident_id)::int AS incident_count
            FROM access_points ap
            LEFT JOIN v_network_readings_with_health r ON ap.access_point_id = r.access_point_id
            LEFT JOIN incidents i ON ap.access_point_id = i.access_point_id
            GROUP BY ap.building
            ORDER BY ap.building ASC
        `;
        const buildingStatsRes = await query(buildingStatsSql);

        // 4. Suspected Causes Breakdown
        const causeStatsSql = `
            SELECT
                suspected_cause,
                COUNT(*)::int AS count
            FROM incidents
            GROUP BY suspected_cause
            ORDER BY count DESC, suspected_cause ASC
        `;
        const causeStatsRes = await query(causeStatsSql);

        // 5. Incident Resolution Totals
        const incidentTotalsSql = `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
                COUNT(*) FILTER (WHERE status = 'Investigating')::int AS investigating,
                COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
                COUNT(*) FILTER (WHERE status != 'Resolved')::int AS unresolved
            FROM incidents
        `;
        const incidentTotalsRes = await query(incidentTotalsSql);

        // 6. Monitoring Period Bounds
        const periodSql = `
            SELECT
                MIN(timestamp) AS start_time,
                MAX(timestamp) AS end_time,
                COUNT(*)::int AS total_readings
            FROM network_readings
        `;
        const periodRes = await query(periodSql);

        res.status(200).json({
            status: 'success',
            data: {
                monitoring_period: {
                    start: periodRes.rows[0].start_time,
                    end: periodRes.rows[0].end_time,
                    total_readings: periodRes.rows[0].total_readings,
                },
                health_distribution: {
                    healthy: healthMap.Healthy || 0,
                    degraded: healthMap.Degraded || 0,
                    down: healthMap.Down || 0,
                    breakdown: healthDistRes.rows,
                },
                current_device_status: {
                    healthy: deviceStatusMap.Healthy || 0,
                    degraded: deviceStatusMap.Degraded || 0,
                    down: deviceStatusMap.Down || 0,
                    total_devices: (deviceStatusMap.Healthy || 0) + (deviceStatusMap.Degraded || 0) + (deviceStatusMap.Down || 0),
                },
                incident_overview: incidentTotalsRes.rows[0],
                suspected_causes: causeStatsRes.rows,
                building_metrics: buildingStatsRes.rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAnalyticsSummary,
};
