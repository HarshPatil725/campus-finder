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

/**
 * POST /api/readings
 * Adds a new simulated network reading into PostgreSQL
 */
async function createReading(req, res, next) {
    try {
        const { access_point_id, timestamp, latency_ms, packet_loss_pct, is_up } = req.body;

        // 1. Validate Access Point existence
        if (!access_point_id) {
            return res.status(400).json({ status: 'error', message: 'access_point_id is required' });
        }
        const apCheck = await query('SELECT access_point_id FROM access_points WHERE LOWER(access_point_id) = LOWER($1)', [access_point_id]);
        if (apCheck.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: `Access point '${access_point_id}' does not exist.` });
        }
        const normalizedApId = apCheck.rows[0].access_point_id;

        // 2. Validate Timestamp
        if (!timestamp || isNaN(Date.parse(timestamp))) {
            return res.status(400).json({ status: 'error', message: 'Valid timestamp is required.' });
        }

        // 3. Validate Availability (is_up)
        const isUpBool = Boolean(is_up);

        // 4. Validate Packet Loss (0 - 100)
        const packetLoss = parseFloat(packet_loss_pct);
        if (isNaN(packetLoss) || packetLoss < 0 || packetLoss > 100) {
            return res.status(400).json({ status: 'error', message: 'Packet loss percentage must be between 0 and 100.' });
        }

        // 5. Validate Latency
        let latency = null;
        if (isUpBool) {
            if (latency_ms !== null && latency_ms !== undefined && latency_ms !== '') {
                latency = parseFloat(latency_ms);
                if (isNaN(latency) || latency < 0) {
                    return res.status(400).json({ status: 'error', message: 'Latency cannot be negative.' });
                }
            } else {
                latency = 0.0;
            }
        } else {
            // Down devices MUST have null latency
            latency = null;
        }

        // 6. Insert reading into PostgreSQL
        const insertSql = `
            INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING reading_id, access_point_id, timestamp, latency_ms, packet_loss_pct, is_up
        `;
        const insertRes = await query(insertSql, [normalizedApId, timestamp, latency, packetLoss, isUpBool]);
        const newReading = insertRes.rows[0];

        res.status(201).json({
            status: 'success',
            message: 'Network reading recorded successfully',
            data: newReading,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getReadings,
    createReading,
};
