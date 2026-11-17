const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../backend/config/db');

test('Database Integrity and Verification Suite', async (t) => {
    const client = await pool.connect();

    await t.test('1. Exact table row counts', async () => {
        const res = await client.query(`
            SELECT
                (SELECT COUNT(*)::int FROM access_points) AS ap_count,
                (SELECT COUNT(*)::int FROM network_readings) AS nr_count,
                (SELECT COUNT(*)::int FROM incidents) AS inc_count
        `);
        assert.equal(res.rows[0].ap_count, 12, 'access_points must have 12 rows');
        assert.equal(res.rows[0].nr_count, 4032, 'network_readings must have 4032 rows');
        assert.equal(res.rows[0].inc_count, 20, 'incidents must have 20 rows');
    });

    await t.test('2. Primary key uniqueness', async () => {
        const res = await client.query(`
            SELECT
                (SELECT COUNT(DISTINCT access_point_id)::int FROM access_points) AS unique_aps,
                (SELECT COUNT(DISTINCT reading_id)::int FROM network_readings) AS unique_readings,
                (SELECT COUNT(DISTINCT incident_id)::int FROM incidents) AS unique_incidents
        `);
        assert.equal(res.rows[0].unique_aps, 12);
        assert.equal(res.rows[0].unique_readings, 4032);
        assert.equal(res.rows[0].unique_incidents, 20);
    });

    await t.test('3. Foreign key integrity', async () => {
        const res = await client.query(`
            SELECT
                (SELECT COUNT(*)::int FROM network_readings r LEFT JOIN access_points ap ON r.access_point_id = ap.access_point_id WHERE ap.access_point_id IS NULL) AS orphan_readings,
                (SELECT COUNT(*)::int FROM incidents i LEFT JOIN access_points ap ON i.access_point_id = ap.access_point_id WHERE ap.access_point_id IS NULL) AS orphan_incidents
        `);
        assert.equal(res.rows[0].orphan_readings, 0, 'network_readings cannot contain orphan access_point_id');
        assert.equal(res.rows[0].orphan_incidents, 0, 'incidents cannot contain orphan access_point_id');
    });

    await t.test('4. Exact health classification distribution in v_network_readings_with_health', async () => {
        const res = await client.query(`
            SELECT health_status, COUNT(*)::int AS count
            FROM v_network_readings_with_health
            GROUP BY health_status
        `);
        const counts = {};
        res.rows.forEach(r => counts[r.health_status] = r.count);

        assert.equal(counts['Healthy'], 3966, 'Healthy readings must equal 3966');
        assert.equal(counts['Degraded'], 45, 'Degraded readings must equal 45');
        assert.equal(counts['Down'], 21, 'Down readings must equal 21');
    });

    await t.test('5. Incident resolution breakdown', async () => {
        const res = await client.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved_count,
                COUNT(*) FILTER (WHERE status != 'Resolved')::int AS unresolved_count
            FROM incidents
        `);
        assert.equal(res.rows[0].resolved_count, 18, 'Resolved incidents must equal 18');
        assert.equal(res.rows[0].unresolved_count, 2, 'Unresolved incidents must equal 2');
    });

    await t.test('6. View v_latest_access_point_status structure', async () => {
        const res = await client.query(`
            SELECT COUNT(*)::int AS count,
                   COUNT(current_status)::int AS status_count
            FROM v_latest_access_point_status
        `);
        assert.equal(res.rows[0].count, 12, 'Latest status view must report all 12 devices');
        assert.equal(res.rows[0].status_count, 12, 'All 12 devices must have non-null latest status');
    });

    client.release();
    await pool.end();
});
