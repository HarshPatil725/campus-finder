const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { pool } = require('../backend/config/database');
const app = require('../backend/server');

test('Phase 6: Incident Management and Data Entry Write Operations Suite', async (t) => {
    let server;
    let baseUrl;

    await t.test('Start Express Server on ephemeral port', () => {
        return new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                resolve();
            });
        });
    });

    let tempReadingId = null;
    let tempIncidentId = null;

    await t.test('1. Verify Persistence of Created Reading #4033 in PostgreSQL', async () => {
        const res = await pool.query('SELECT * FROM network_readings WHERE reading_id = 4033');
        assert.equal(res.rows.length, 1, 'Reading #4033 must exist in PostgreSQL');
        assert.equal(res.rows[0].access_point_id, 'AP-01');
        assert.equal(parseFloat(res.rows[0].latency_ms), 35.2);
    });

    await t.test('2. Verify Persistence of Created & Resolved Incident INC-021 in PostgreSQL', async () => {
        const res = await pool.query('SELECT * FROM incidents WHERE incident_id = $1', ['INC-021']);
        assert.equal(res.rows.length, 1, 'Incident INC-021 must exist in PostgreSQL');
        assert.equal(res.rows[0].status, 'Resolved');
        assert.ok(res.rows[0].resolution, 'Resolution notes must be persisted');
        assert.ok(res.rows[0].end_time, 'End time must be persisted');
    });

    await t.test('3. Test POST /api/readings with Validation Rules', async () => {
        // Invalid AP ID
        const badApRes = await fetch(`${baseUrl}/api/readings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_point_id: 'NONEXISTENT_AP', timestamp: '2026-11-15 00:00:00', packet_loss_pct: 1.0, is_up: true }),
        });
        assert.equal(badApRes.status, 400);

        // Invalid negative latency
        const badLatencyRes = await fetch(`${baseUrl}/api/readings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_point_id: 'AP-01', timestamp: '2026-11-15 00:00:00', latency_ms: -10, packet_loss_pct: 1.0, is_up: true }),
        });
        assert.equal(badLatencyRes.status, 400);

        // Valid down reading with null latency enforcement (use non-latest timestamp to avoid affecting latest status view)
        const downReadingRes = await fetch(`${baseUrl}/api/readings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_point_id: 'AP-02', timestamp: '2026-11-01 00:00:01', latency_ms: 100, packet_loss_pct: 100, is_up: false }),
        });
        assert.equal(downReadingRes.status, 201);
        const downBody = await downReadingRes.json();
        assert.equal(downBody.data.latency_ms, null, 'Down reading must enforce null latency');
        tempReadingId = downBody.data.reading_id;
    });

    await t.test('4. Test POST /api/incidents and Incident Lifecycle Workflow', async () => {
        // 4a. Create new test incident
        const createRes = await fetch(`${baseUrl}/api/incidents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_point_id: 'AP-03',
                start_time: '2026-11-15 04:00:00',
                status: 'Open',
                suspected_cause: 'DHCP lease pool exhaustion',
            }),
        });
        assert.equal(createRes.status, 201);
        const createBody = await createRes.json();
        tempIncidentId = createBody.data.incident_id;
        assert.equal(createBody.data.status, 'Open');

        // 4b. Change status: Open -> Investigating
        const patchInvRes = await fetch(`${baseUrl}/api/incidents/${tempIncidentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Investigating',
                suspected_cause: 'DHCP scope pool exhaustion on VLAN 40',
            }),
        });
        assert.equal(patchInvRes.status, 200);
        const patchInvBody = await patchInvRes.json();
        assert.equal(patchInvBody.data.status, 'Investigating');

        // 4c. Reject resolution without resolution notes
        const badResolveRes = await fetch(`${baseUrl}/api/incidents/${tempIncidentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Resolved' }),
        });
        assert.equal(badResolveRes.status, 400);

        // 4d. Complete resolution: Investigating -> Resolved
        const resolveRes = await fetch(`${baseUrl}/api/incidents/${tempIncidentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Resolved',
                end_time: '2026-11-15 06:00:00',
                resolution: 'Expanded DHCP pool subnet mask and flushed stale client leases.',
            }),
        });
        assert.equal(resolveRes.status, 200);
        const resolveBody = await resolveRes.json();
        assert.equal(resolveBody.data.status, 'Resolved');
    });

    await t.test('5. Clean Up Ephemeral Test Rows to Preserve Exact Target Counts', async () => {
        if (tempReadingId) {
            await pool.query('DELETE FROM network_readings WHERE reading_id = $1', [tempReadingId]);
        }
        if (tempIncidentId) {
            await pool.query('DELETE FROM incidents WHERE incident_id = $1', [tempIncidentId]);
        }
        await pool.query("SELECT setval('network_readings_reading_id_seq', 4033, true)");
    });

    await t.test('Teardown test server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
