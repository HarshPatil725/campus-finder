const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../backend/server');

test('Phase 3: Read-Only REST API Suite', async (t) => {
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

    // 1. OVERVIEW API TESTS
    await t.test('GET /api/overview returns system baseline metrics', async () => {
        const res = await fetch(`${baseUrl}/api/overview`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'success');

        const { summary } = body.data;
        assert.equal(summary.total_access_points, 12, 'Total APs must be 12');
        assert.ok(summary.healthy_access_points >= 10, 'Healthy APs must be >= 10');
        assert.equal(summary.degraded_access_points, 1, 'Degraded APs must be 1');
        assert.equal(summary.down_access_points, 1, 'Down APs must be 1');
        assert.ok(summary.total_incidents >= 20, 'Total incidents must be >= 20');
        assert.ok(summary.resolved_incidents >= 18, 'Resolved incidents must be >= 18');
        assert.ok(summary.unresolved_incidents >= 2, 'Unresolved incidents must be >= 2');
        assert.ok(summary.latest_reading_timestamp, 'Latest reading timestamp must be present');
    });

    await t.test('GET /api/overview?building=Library filters correctly', async () => {
        const res = await fetch(`${baseUrl}/api/overview?building=Library`);
        assert.equal(res.status, 200);
        const body = await res.json();
        const { summary } = body.data;
        assert.equal(summary.total_access_points, 2, 'Library has 2 APs');
        assert.ok(summary.total_incidents >= 3, 'Library has at least 3 incidents');
    });

    // 2. ACCESS POINTS API TESTS
    await t.test('GET /api/access-points returns all 12 devices', async () => {
        const res = await fetch(`${baseUrl}/api/access-points`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.count, 12, 'Must return 12 devices');
        assert.equal(body.data.length, 12);
    });

    await t.test('GET /api/access-points?building=Library returns 2 APs', async () => {
        const res = await fetch(`${baseUrl}/api/access-points?building=Library`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.count, 2);
        assert.ok(body.data.every(ap => ap.building === 'Library'));
    });

    await t.test('GET /api/access-points?search=AP-03 returns AP-03', async () => {
        const res = await fetch(`${baseUrl}/api/access-points?search=AP-03`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.count, 1);
        assert.equal(body.data[0].access_point_id, 'AP-03');
        assert.equal(body.data[0].current_status, 'Down');
    });

    await t.test('GET /api/access-points/:id returns single AP details, incidents, and readings', async () => {
        const res = await fetch(`${baseUrl}/api/access-points/AP-01`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.access_point_id, 'AP-01');
        assert.equal(body.data.building, 'Library');
        assert.ok(Array.isArray(body.data.incidents));
        assert.ok(Array.isArray(body.data.recent_readings));
    });

    await t.test('GET /api/access-points/:id with invalid ID returns 404', async () => {
        const res = await fetch(`${baseUrl}/api/access-points/INVALID_AP`);
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.status, 'error');
    });

    // 3. READINGS API TESTS
    await t.test('GET /api/readings returns paginated readings with >= 4032 total records', async () => {
        const res = await fetch(`${baseUrl}/api/readings`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.pagination.total_records >= 4032);
        assert.equal(body.pagination.limit, 50);
        assert.equal(body.data.length, 50);
    });

    await t.test('GET /api/readings?building=Library returns >= 672 readings', async () => {
        const res = await fetch(`${baseUrl}/api/readings?building=Library`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.pagination.total_records >= 672, 'Library must have >= 672 readings');
    });

    await t.test('GET /api/readings?access_point_id=AP-01 returns >= 336 readings', async () => {
        const res = await fetch(`${baseUrl}/api/readings?access_point_id=AP-01`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.pagination.total_records >= 336);
    });

    // 4. INCIDENTS API TESTS
    await t.test('GET /api/incidents returns >= 20 incidents', async () => {
        const res = await fetch(`${baseUrl}/api/incidents`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.count >= 20);
    });

    await t.test('GET /api/incidents?status=Resolved returns >= 18 incidents', async () => {
        const res = await fetch(`${baseUrl}/api/incidents?status=Resolved`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.count >= 18);
    });

    await t.test('GET /api/incidents?status=unresolved returns >= 2 incidents', async () => {
        const res = await fetch(`${baseUrl}/api/incidents?status=unresolved`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.count >= 2);
    });

    await t.test('GET /api/incidents?building=Library returns >= 3 incidents', async () => {
        const res = await fetch(`${baseUrl}/api/incidents?building=Library`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.count >= 3, 'Library must have >= 3 incidents');
    });

    await t.test('GET /api/incidents/:id returns single incident and telemetry evidence', async () => {
        const res = await fetch(`${baseUrl}/api/incidents/INC-001`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.incident_id, 'INC-001');
        assert.equal(body.data.access_point_id, 'AP-02');
        assert.equal(body.data.building, 'Library');
        assert.ok(Array.isArray(body.data.related_readings));
        assert.ok(body.data.related_readings.length > 0);
    });

    await t.test('GET /api/incidents/:id with invalid ID returns 404', async () => {
        const res = await fetch(`${baseUrl}/api/incidents/INC-999`);
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.status, 'error');
    });

    // 5. ANALYTICS API TESTS
    await t.test('GET /api/analytics/summary returns accurate aggregations', async () => {
        const res = await fetch(`${baseUrl}/api/analytics/summary`);
        assert.equal(res.status, 200);
        const body = await res.json();
        const { health_distribution, current_device_status, incident_overview, building_metrics } = body.data;

        assert.ok(health_distribution.healthy >= 3966, 'Healthy readings must be >= 3966');
        assert.equal(health_distribution.degraded, 45, 'Degraded readings must equal 45');
        assert.equal(health_distribution.down, 21, 'Down readings must equal 21');

        assert.ok(current_device_status.healthy >= 10);
        assert.equal(current_device_status.degraded, 1);
        assert.equal(current_device_status.down, 1);
        assert.equal(current_device_status.total_devices, 12);

        assert.ok(incident_overview.total >= 20);
        assert.ok(incident_overview.resolved >= 18);
        assert.ok(incident_overview.unresolved >= 2);

        assert.equal(building_metrics.length, 6, 'There must be 6 campus buildings');
    });

    await t.test('Teardown test server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
