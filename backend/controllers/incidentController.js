const { query, getClient } = require('../config/database');

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

/**
 * POST /api/incidents
 * Registers a new incident into PostgreSQL
 */
async function createIncident(req, res, next) {
    try {
        let { incident_id, access_point_id, start_time, end_time, status = 'Open', suspected_cause, resolution } = req.body;

        // 1. Generate Incident ID if not provided
        if (!incident_id) {
            const maxIdRes = await query(`
                SELECT COALESCE(MAX(CAST(SUBSTRING(incident_id FROM 5) AS INTEGER)), 0) AS max_num
                FROM incidents
                WHERE incident_id ~ '^INC-[0-9]+$'
            `);
            const nextNum = parseInt(maxIdRes.rows[0].max_num, 10) + 1;
            incident_id = `INC-${String(nextNum).padStart(3, '0')}`;
        }

        // 2. Validate Access Point
        if (!access_point_id) {
            return res.status(400).json({ status: 'error', message: 'access_point_id is required' });
        }
        const apCheck = await query('SELECT access_point_id FROM access_points WHERE LOWER(access_point_id) = LOWER($1)', [access_point_id]);
        if (apCheck.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: `Access point '${access_point_id}' does not exist.` });
        }
        const normalizedApId = apCheck.rows[0].access_point_id;

        // 3. Validate Start Time
        if (!start_time || isNaN(Date.parse(start_time))) {
            return res.status(400).json({ status: 'error', message: 'Valid start_time is required.' });
        }

        // 4. Validate Status
        const validStatuses = ['Open', 'Investigating', 'Resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ status: 'error', message: `Status must be one of: ${validStatuses.join(', ')}` });
        }

        // 5. Validate Suspected Cause
        if (!suspected_cause || !suspected_cause.trim()) {
            return res.status(400).json({ status: 'error', message: 'suspected_cause is required.' });
        }

        // 6. Enforce chk_incidents_resolved_details constraint
        let finalEndTime = end_time ? end_time : null;
        let finalResolution = resolution ? resolution.trim() : null;

        if (status === 'Resolved') {
            if (!finalResolution) {
                return res.status(400).json({ status: 'error', message: 'Resolution details are required when incident status is Resolved.' });
            }
            if (!finalEndTime) {
                return res.status(400).json({ status: 'error', message: 'End time is required when incident status is Resolved.' });
            }
            if (new Date(finalEndTime) < new Date(start_time)) {
                return res.status(400).json({ status: 'error', message: 'End time cannot precede start time.' });
            }
        }

        // 7. Insert into PostgreSQL
        const insertSql = `
            INSERT INTO incidents (incident_id, access_point_id, start_time, end_time, status, suspected_cause, resolution)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const insertRes = await query(insertSql, [
            incident_id,
            normalizedApId,
            start_time,
            finalEndTime,
            status,
            suspected_cause.trim(),
            finalResolution,
        ]);

        res.status(201).json({
            status: 'success',
            message: 'Incident registered successfully',
            data: insertRes.rows[0],
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/incidents/:id
 * Updates an existing incident with transaction atomicity
 */
async function updateIncident(req, res, next) {
    const client = await getClient();
    try {
        const { id } = req.params;
        const { status, suspected_cause, resolution, end_time } = req.body;

        await client.query('BEGIN');

        // Fetch existing record
        const findSql = 'SELECT * FROM incidents WHERE LOWER(incident_id) = LOWER($1) FOR UPDATE';
        const findRes = await client.query(findSql, [id]);

        if (findRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', message: `Incident '${id}' not found.` });
        }

        const current = findRes.rows[0];

        // Determine updated values
        const newStatus = status !== undefined ? status : current.status;
        const newCause = suspected_cause !== undefined ? suspected_cause.trim() : current.suspected_cause;
        let newResolution = resolution !== undefined ? (resolution ? resolution.trim() : null) : current.resolution;
        let newEndTime = end_time !== undefined ? (end_time ? end_time : null) : current.end_time;

        // Validation for status change to Resolved
        if (newStatus === 'Resolved') {
            if (!newResolution) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    status: 'error',
                    message: 'Resolution details are strictly required when resolving an incident.'
                });
            }
            if (!newEndTime) {
                // Default to current timestamp if not explicitly supplied
                newEndTime = new Date().toISOString().replace('T', ' ').substring(0, 16);
            }
            if (new Date(newEndTime) < new Date(current.start_time)) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    status: 'error',
                    message: 'Incident end time cannot precede start time.'
                });
            }
        }

        // Validate status domain
        const validStatuses = ['Open', 'Investigating', 'Resolved'];
        if (!validStatuses.includes(newStatus)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ status: 'error', message: `Invalid status: ${newStatus}` });
        }

        const updateSql = `
            UPDATE incidents
            SET status = $1, suspected_cause = $2, resolution = $3, end_time = $4
            WHERE incident_id = $5
            RETURNING *
        `;
        const updateRes = await client.query(updateSql, [
            newStatus,
            newCause,
            newResolution,
            newEndTime,
            current.incident_id,
        ]);

        await client.query('COMMIT');

        res.status(200).json({
            status: 'success',
            message: 'Incident updated successfully',
            data: updateRes.rows[0],
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
}

module.exports = {
    getAllIncidents,
    getIncidentById,
    createIncident,
    updateIncident,
};
