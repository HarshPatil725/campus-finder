const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../backend/server');

test('Phase 5: Frontend and Backend API Integration Verification Suite', async (t) => {
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

    // 1. Verify All 7 HTML Views correctly reference API and page scripts
    const pageScriptExpectations = [
        { path: '/index.html', script: '/js/overview.js' },
        { path: '/access-points.html', script: '/js/access-points.js' },
        { path: '/performance.html', script: '/js/performance.js' },
        { path: '/incidents.html', script: '/js/incidents.js' },
        { path: '/investigation.html', script: '/js/investigation.js' },
        { path: '/analytics.html', script: '/js/analytics.js' },
        { path: '/admin.html', script: '/js/admin.js' },
    ];

    for (const p of pageScriptExpectations) {
        await t.test(`HTML Page ${p.path} has correct script bindings`, async () => {
            const res = await fetch(`${baseUrl}${p.path}`);
            assert.equal(res.status, 200);
            const html = await res.text();
            assert.ok(html.includes('/js/api.js'), `${p.path} must include /js/api.js`);
            assert.ok(html.includes(p.script), `${p.path} must include ${p.script}`);
        });
    }

    // 2. Verify System-Wide Overview Integration
    await t.test('Overview API returns baseline counts for UI KPIs', async () => {
        const res = await fetch(`${baseUrl}/api/overview`);
        const json = await res.json();
        const { summary, latest_readings } = json.data;

        assert.equal(summary.total_access_points, 12);
        assert.ok(summary.healthy_access_points >= 10);
        assert.equal(summary.degraded_access_points, 1);
        assert.equal(summary.down_access_points, 1);
        assert.ok(summary.total_incidents >= 20);
        assert.ok(summary.unresolved_incidents >= 2);
        assert.equal(latest_readings.length, 12, 'Latest readings table must contain all 12 devices');
    });

    // 3. Verify All 6 Campus Building Filters across APIs
    const buildings = [
        { name: 'Academic Block', expectedAps: 2, minIncidents: 4 },
        { name: 'Administration', expectedAps: 2, minIncidents: 3 },
        { name: 'Computer Lab', expectedAps: 2, minIncidents: 4 },
        { name: 'Hostel', expectedAps: 2, minIncidents: 3 },
        { name: 'Library', expectedAps: 2, minIncidents: 3 },
        { name: 'Seminar Hall', expectedAps: 2, minIncidents: 3 },
    ];

    for (const b of buildings) {
        await t.test(`Verify Building Filter for "${b.name}"`, async () => {
            // Overview with building filter
            const overviewRes = await fetch(`${baseUrl}/api/overview?building=${encodeURIComponent(b.name)}`);
            const overviewJson = await overviewRes.json();
            assert.equal(overviewJson.data.summary.total_access_points, b.expectedAps);
            assert.ok(overviewJson.data.summary.total_incidents >= b.minIncidents);

            // Access points with building filter
            const apRes = await fetch(`${baseUrl}/api/access-points?building=${encodeURIComponent(b.name)}`);
            const apJson = await apRes.json();
            assert.equal(apJson.count, b.expectedAps);

            // Incidents with building filter
            const incRes = await fetch(`${baseUrl}/api/incidents?building=${encodeURIComponent(b.name)}`);
            const incJson = await incRes.json();
            assert.ok(incJson.count >= b.minIncidents);
        });
    }

    // 4. Verify Performance Telemetry Integration
    await t.test('Performance API returns chronological readings and respects pagination', async () => {
        const res = await fetch(`${baseUrl}/api/readings?page=1&limit=50&sort=ASC`);
        const json = await res.json();
        assert.equal(json.data.length, 50);
        assert.ok(json.pagination.total_records >= 4032);
        // Ensure null latency is correctly delivered for offline events
        const offlineReadingsRes = await fetch(`${baseUrl}/api/readings?status=Down`);
        const offlineJson = await offlineReadingsRes.json();
        assert.equal(offlineJson.pagination.total_records, 21, 'Down readings must equal 21');
        assert.ok(offlineJson.data.every(r => r.latency_ms === null), 'Down readings must have null latency');
    });

    // 5. Verify Investigation Telemetry Correlation
    await t.test('Investigation API correlates readings around incident window', async () => {
        const res = await fetch(`${baseUrl}/api/incidents/INC-001`);
        const json = await res.json();
        const inc = json.data;
        assert.equal(inc.incident_id, 'INC-001');
        assert.equal(inc.access_point_id, 'AP-02');
        assert.ok(inc.related_readings.length > 0, 'Incident must have correlated telemetry evidence');
        assert.ok(inc.related_readings.some(r => r.health_status === 'Degraded'), 'Correlated readings must capture degradation');
    });

    // 6. Verify Analytics Summary Integration
    await t.test('Analytics API provides exact distribution matching visual charts', async () => {
        const res = await fetch(`${baseUrl}/api/analytics/summary`);
        const json = await res.json();
        const { health_distribution, building_metrics, suspected_causes } = json.data;

        assert.ok(health_distribution.healthy >= 3966);
        assert.equal(health_distribution.degraded, 45);
        assert.equal(health_distribution.down, 21);
        assert.equal(building_metrics.length, 6);
        assert.ok(suspected_causes.length > 0);
    });

    await t.test('Teardown test server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
