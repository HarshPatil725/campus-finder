const { query } = require('../config/database');

/**
 * GET /api/readings
 * Query params: access_point_id, building, start_date, end_date, status, page, limit, sort
 */
async function getReadings(req, res, next) {
    try {
        const {
            access_point_id,
            building,
            start_date,
            end_date,
            from,
            to,
            status,
            page = 1,
            limit = 50,
            sort = 'DESC',
        } = req.query;

        const conditions = [];
        const params = [];
        let pIdx = 1;

        if (access_point_id) {
            conditions.push(`LOWER(r.access_point_id) = LOWER($${pIdx})`);
            params.push(access_point_id);
            pIdx++;
        }

        if (building) {
            conditions.push(`LOWER(ap.building) = LOWER($${pIdx})`);
            params.push(building);
            pIdx++;
        }

        const effectiveStartDate = start_date || from;
        if (effectiveStartDate) {
            conditions.push(`r.timestamp >= $${pIdx}::timestamp`);
            params.push(effectiveStartDate);
            pIdx++;
        }

        const effectiveEndDate = end_date || to;
        if (effectiveEndDate) {
            conditions.push(`r.timestamp <= $${pIdx}::timestamp`);
            params.push(effectiveEndDate);
            pIdx++;
        }

        if (status) {
            conditions.push(`LOWER(r.health_status) = LOWER($${pIdx})`);
            params.push(status);
            pIdx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sortDirection = String(sort).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Count Total Matching Records
        const countSql = `
            SELECT COUNT(*)::int AS total
            FROM v_network_readings_with_health r
            JOIN access_points ap ON r.access_point_id = ap.access_point_id
            ${whereClause}
        `;
        const countRes = await query(countSql, params);
        const totalRecords = countRes.rows[0].total;

        // Pagination parameters
        let pageNum = Math.max(1, parseInt(page, 10) || 1);
        let pageSize = limit === 'all' ? 5000 : Math.min(5000, Math.max(1, parseInt(limit, 10) || 50));
        const totalPages = Math.ceil(totalRecords / pageSize) || 1;
        const offset = (pageNum - 1) * pageSize;

        // Data Query
        const dataSql = `
            SELECT
                r.reading_id,
                r.access_point_id,
                ap.building,
                ap.location,
                r.timestamp,
                r.latency_ms,
                r.packet_loss_pct,
                r.is_up,
                r.health_status
            FROM v_network_readings_with_health r
            JOIN access_points ap ON r.access_point_id = ap.access_point_id
            ${whereClause}
            ORDER BY r.timestamp ${sortDirection}, r.reading_id ${sortDirection}
            LIMIT $${pIdx} OFFSET $${pIdx + 1}
        `;
        const dataParams = [...params, pageSize, offset];
        const dataRes = await query(dataSql, dataParams);

        res.status(200).json({
            status: 'success',
            pagination: {
                total_records: totalRecords,
                page: pageNum,
                limit: pageSize,
                total_pages: totalPages,
            },
            data: dataRes.rows,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getReadings,
};
