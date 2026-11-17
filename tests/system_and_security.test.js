const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { pool } = require('../backend/config/database');
const app = require('../backend/server');

test('Phase 7: System Testing and Security Suite', async (t) => {
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

    // ==========================================
    // 1. DATABASE TESTS
    // ==========================================
    await t.test('1. Database Constraints: Primary Key, Foreign Key, Duplicates, and Nulls', async (tSub) => {
        // 1a. Primary Key Uniqueness in access_points
        await tSub.test('Primary Key constraint prevents duplicate access_point_id', async () => {
            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO access_points (access_point_id, building, location) VALUES ($1, $2, $3)',
                        ['AP-01', 'Library', 'Duplicate AP-01']
                    );
                },
                /duplicate key value violates unique constraint/i,
                'PostgreSQL must reject duplicate AP primary key'
            );
        });

        // 1b. Foreign Key Constraint on invalid access_point_id in network_readings
        await tSub.test('Foreign Key constraint rejects readings referencing non-existent access points', async () => {
            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up) VALUES ($1, $2, $3, $4, $5)',
                        ['AP-NONEXISTENT', '2026-11-15 12:00:00', 25.0, 0.0, true]
                    );
                },
                /violates foreign key constraint/i,
                'PostgreSQL must reject orphan reading foreign key'
            );
        });

        // 1c. Foreign Key Constraint on invalid access_point_id in incidents
        await tSub.test('Foreign Key constraint rejects incidents referencing non-existent access points', async () => {
            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO incidents (incident_id, access_point_id, start_time, status, suspected_cause) VALUES ($1, $2, $3, $4, $5)',
                        ['INC-FAKE-999', 'AP-NONEXISTENT', '2026-11-15 12:00:00', 'Open', 'Fake cause']
                    );
                },
                /violates foreign key constraint/i,
                'PostgreSQL must reject orphan incident foreign key'
            );
        });

        // 1d. Null constraint enforcement on required columns
        await tSub.test('NOT NULL constraints prevent insertion of missing required fields', async () => {
            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO access_points (access_point_id, building, location) VALUES ($1, $2, $3)',
                        ['AP-NULL-TEST', null, 'Room 101']
                    );
                },
                /null value in column "building".*violates not-null constraint/i,
                'PostgreSQL must reject null building'
            );

            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up) VALUES ($1, $2, $3, $4, $5)',
                        ['AP-01', '2026-11-15 12:00:00', 20.0, null, true]
                    );
                },
                /null value in column "packet_loss_pct".*violates not-null constraint/i,
                'PostgreSQL must reject null packet_loss_pct'
            );
        });

        // 1e. CHECK constraint on packet loss bounds and latency non-negativity
        await tSub.test('CHECK constraints prevent negative latency and invalid packet loss', async () => {
            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up) VALUES ($1, $2, $3, $4, $5)',
                        ['AP-01', '2026-11-15 12:00:00', -5.0, 0.0, true]
                    );
                },
                /check constraint "chk_latency_non_negative"|violates check constraint/i,
                'PostgreSQL must reject negative latency'
            );

            await assert.rejects(
                async () => {
                    await pool.query(
                        'INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up) VALUES ($1, $2, $3, $4, $5)',
                        ['AP-01', '2026-11-15 12:00:00', 25.0, 105.0, true]
                    );
                },
                /check constraint "chk_packet_loss_range"|violates check constraint/i,
                'PostgreSQL must reject packet loss > 100%'
            );
        });
    });

    // ==========================================
    // 2. BACKEND & SECURITY TESTS
    // ==========================================
    await t.test('2. Backend APIs, Error Resilience & Security Hardening', async (tSub) => {
        // 2a. Secure HTTP Headers
        await tSub.test('Security HTTP Headers are present on responses', async () => {
            const res = await fetch(`${baseUrl}/api/health`);
            assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
            assert.equal(res.headers.get('x-frame-options'), 'DENY');
            assert.equal(res.headers.get('x-xss-protection'), '1; mode=block');
            assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
            assert.ok(res.headers.get('content-security-policy'), 'CSP header must be present');
        });

        // 2b. Malformed JSON handling
        await tSub.test('Malformed JSON payload returns 400 Bad Request without crashing', async () => {
            const res = await fetch(`${baseUrl}/api/readings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"access_point_id": "AP-01", "latency_ms": ', // Syntax error
            });
            assert.equal(res.status, 400);
            const body = await res.json();
            assert.equal(body.status, 'error');
            assert.match(body.message, /JSON/i);
        });

        // 2c. Request Size Limit Enforcement (100kb limit)
        await tSub.test('Oversized payload exceeding 100kb limit returns 413 Payload Too Large', async () => {
            const largeString = 'X'.repeat(1024 * 120); // 120 KB
            const res = await fetch(`${baseUrl}/api/readings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_point_id: 'AP-01', description: largeString }),
            });
            assert.equal(res.status, 413);
            const body = await res.json();
            assert.equal(body.status, 'error');
            assert.match(body.message, /Payload Too Large/i);
        });

        // 2d. SQL Injection Immunity across Query Parameters
        await tSub.test('Parameterized queries neutralize SQL injection attempts', async () => {
            const sqliPayloads = [
                "' OR '1'='1",
                "AP-01'; DROP TABLE access_points; --",
                "1; SELECT * FROM pg_user; --",
                "' UNION SELECT NULL, NULL, NULL --",
            ];

            for (const payload of sqliPayloads) {
                // Test in overview building filter
                const res1 = await fetch(`${baseUrl}/api/overview?building=${encodeURIComponent(payload)}`);
                assert.equal(res1.status, 200, 'Overview should handle payload safely as literal');
                const data1 = await res1.json();
                assert.equal(data1.data.summary.total_access_points, 0);

                // Test in access-points search filter
                const res2 = await fetch(`${baseUrl}/api/access-points?search=${encodeURIComponent(payload)}`);
                assert.equal(res2.status, 200, 'Access points should handle search payload safely');
                const data2 = await res2.json();
                assert.equal(data2.data.length, 0);

                // Test in incidents status filter
                const res3 = await fetch(`${baseUrl}/api/incidents?status=${encodeURIComponent(payload)}`);
                assert.equal(res3.status, 200, 'Incidents should handle status payload safely');
                const data3 = await res3.json();
                assert.equal(data3.data.length, 0);

                // Test in readings access_point_id filter
                const res4 = await fetch(`${baseUrl}/api/readings?access_point_id=${encodeURIComponent(payload)}`);
                assert.equal(res4.status, 200, 'Readings should handle AP filter safely');
                const data4 = await res4.json();
                assert.equal(data4.data.length, 0);
            }

            // Verify database table access_points is completely intact
            const checkRes = await pool.query('SELECT COUNT(*)::int AS count FROM access_points');
            assert.equal(checkRes.rows[0].count, 12, 'Table access_points must remain completely intact');
        });

        // 2e. Invalid ID Handling across Endpoints
        await tSub.test('Non-existent IDs return 404 with structured error JSON', async () => {
            const apRes = await fetch(`${baseUrl}/api/access-points/NONEXISTENT-99`);
            assert.equal(apRes.status, 404);
            const apBody = await apRes.json();
            assert.equal(apBody.status, 'error');

            const incRes = await fetch(`${baseUrl}/api/incidents/INC-NONEXISTENT-99`);
            assert.equal(incRes.status, 404);
            const incBody = await incRes.json();
            assert.equal(incBody.status, 'error');
        });

        // 2f. Admin Authentication & Session Management Lifecycle
        await tSub.test('Admin Authentication and Server-Side Session Lifecycle', async () => {
            // Check unauthenticated session
            const anonSessionRes = await fetch(`${baseUrl}/api/auth/session`);
            assert.equal(anonSessionRes.status, 200);
            const anonSession = await anonSessionRes.json();
            assert.equal(anonSession.authenticated, false);

            // Invalid login
            const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'WrongPassword!99' }),
            });
            assert.equal(badLoginRes.status, 401);

            // Valid login
            const validLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'CampusAdmin@2026' }),
            });
            assert.equal(validLoginRes.status, 200);
            const loginBody = await validLoginRes.json();
            assert.equal(loginBody.status, 'success');
            assert.ok(loginBody.data.sessionId, 'Session ID must be generated');

            const sessionId = loginBody.data.sessionId;

            // Session check with Bearer header
            const checkSessionRes = await fetch(`${baseUrl}/api/auth/session`, {
                headers: { Authorization: `Bearer ${sessionId}` },
            });
            assert.equal(checkSessionRes.status, 200);
            const activeSession = await checkSessionRes.json();
            assert.equal(activeSession.authenticated, true);
            assert.equal(activeSession.user.username, 'admin');

            // Logout
            const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionId}` },
            });
            assert.equal(logoutRes.status, 200);

            // Session check after logout
            const postLogoutRes = await fetch(`${baseUrl}/api/auth/session`, {
                headers: { Authorization: `Bearer ${sessionId}` },
            });
            const postLogoutSession = await postLogoutRes.json();
            assert.equal(postLogoutSession.authenticated, false, 'Session must be invalidated after logout');
        });
    });

    // ==========================================
    // 3. FRONTEND TESTS
    // ==========================================
    await t.test('3. Frontend Structural, Navigation, Filters and Responsive Layout', async (tSub) => {
        const pages = [
            { path: '/index.html', title: 'Network Overview' },
            { path: '/access-points.html', title: 'Access Point Directory' },
            { path: '/performance.html', title: 'Network Performance' },
            { path: '/incidents.html', title: 'Incident Management' },
            { path: '/investigation.html', title: 'Incident Investigation' },
            { path: '/analytics.html', title: 'Network Analytics' },
            { path: '/admin.html', title: 'System Administration' },
        ];

        for (const page of pages) {
            await tSub.test(`Page ${page.path} has correct navigation links and responsive layout`, async () => {
                const res = await fetch(`${baseUrl}${page.path}`);
                assert.equal(res.status, 200);
                const html = await res.text();

                // Brand
                assert.ok(html.includes('CAMPUS'), 'Must include brand CAMPUS');
                assert.ok(html.includes('WI-FI'), 'Must include brand WI-FI');

                // Seven navigation links
                assert.ok(html.includes('href="/index.html"'), 'Must link to Overview');
                assert.ok(html.includes('href="/access-points.html"'), 'Must link to Access Points');
                assert.ok(html.includes('href="/performance.html"'), 'Must link to Performance');
                assert.ok(html.includes('href="/incidents.html"'), 'Must link to Incidents');
                assert.ok(html.includes('href="/investigation.html"'), 'Must link to Investigation');
                assert.ok(html.includes('href="/analytics.html"'), 'Must link to Analytics');
                assert.ok(html.includes('href="/admin.html"'), 'Must link to Admin');

                // Responsive Bootstrap Navbar classes
                assert.ok(html.includes('navbar-toggler'), 'Must contain responsive navbar toggler');
                assert.ok(html.includes('collapse navbar-collapse'), 'Must contain collapsible navbar');

                // Simulated network data indicator
                assert.ok(html.includes('SIMULATED NETWORK DATA'), 'Must have simulated data indicator');
            });
        }
    });

    // ==========================================
    // 4. END-TO-END (E2E) WORKFLOW TEST
    // ==========================================
    await t.test('4. End-to-End Workflow: Add Reading -> Incident -> Investigate -> Update -> Resolve -> Persistence', async () => {
        let createdReadingId;
        let createdIncidentId;

        try {
            // Step 1: Add simulated degraded reading
            const readingRes = await fetch(`${baseUrl}/api/readings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_point_id: 'AP-04',
                    timestamp: '2026-11-02 03:15:00', // Use past date within Nov 1-14 window to preserve latest status view
                    latency_ms: 125.4,
                    packet_loss_pct: 7.8,
                    is_up: true,
                }),
            });
            assert.equal(readingRes.status, 201, 'Step 1: Reading must be created');
            const readingBody = await readingRes.json();
            createdReadingId = readingBody.data.reading_id;
            assert.ok(createdReadingId, 'Reading ID must be generated');

            // Step 2: Register incident
            const incidentRes = await fetch(`${baseUrl}/api/incidents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_point_id: 'AP-04',
                    start_time: '2026-11-02 03:15:00',
                    status: 'Open',
                    suspected_cause: 'Buffer queue overflow on switch port GigabitEthernet1/0/4',
                }),
            });
            assert.equal(incidentRes.status, 201, 'Step 2: Incident must be registered');
            const incidentBody = await incidentRes.json();
            createdIncidentId = incidentBody.data.incident_id;
            assert.ok(createdIncidentId, 'Incident ID must be assigned');
            assert.equal(incidentBody.data.status, 'Open');

            // Step 3: Open investigation & correlate related readings
            const invRes = await fetch(`${baseUrl}/api/incidents/${createdIncidentId}`);
            assert.equal(invRes.status, 200, 'Step 3: Investigation endpoint returns incident details');
            const invBody = await invRes.json();
            assert.equal(invBody.data.incident_id, createdIncidentId);
            assert.equal(invBody.data.access_point_id, 'AP-04');
            assert.ok(Array.isArray(invBody.data.related_readings), 'Must return correlated readings array');

            // Step 4: Update incident (Open -> Investigating)
            const updateRes = await fetch(`${baseUrl}/api/incidents/${createdIncidentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Investigating',
                    suspected_cause: 'Switch port buffer overrun caused by multicast flood on VLAN 20',
                }),
            });
            assert.equal(updateRes.status, 200, 'Step 4: Status transitioned to Investigating');
            const updateBody = await updateRes.json();
            assert.equal(updateBody.data.status, 'Investigating');

            // Step 5: Resolve incident (Investigating -> Resolved)
            const resolveRes = await fetch(`${baseUrl}/api/incidents/${createdIncidentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Resolved',
                    end_time: '2026-11-02 04:30:00',
                    resolution: 'Applied IGMP snooping policy on distribution switch; cleared egress queues.',
                }),
            });
            assert.equal(resolveRes.status, 200, 'Step 5: Incident resolved successfully');
            const resolveBody = await resolveRes.json();
            assert.equal(resolveBody.data.status, 'Resolved');
            assert.ok(resolveBody.data.end_time, 'End time must be persisted');
            assert.ok(resolveBody.data.resolution, 'Resolution notes must be persisted');

            // Step 6: Verify data persistence from PostgreSQL and fresh API fetch
            const persistRes = await fetch(`${baseUrl}/api/incidents/${createdIncidentId}`);
            assert.equal(persistRes.status, 200);
            const persistBody = await persistRes.json();
            assert.equal(persistBody.data.status, 'Resolved');
            assert.equal(
                persistBody.data.resolution,
                'Applied IGMP snooping policy on distribution switch; cleared egress queues.'
            );
        } finally {
            // Step 7: Clean up ephemeral E2E records so target counts are preserved
            if (createdIncidentId) {
                await pool.query('DELETE FROM incidents WHERE incident_id = $1', [createdIncidentId]);
            }
            if (createdReadingId) {
                await pool.query('DELETE FROM network_readings WHERE reading_id = $1', [createdReadingId]);
            }
        }
    });

    await t.test('Teardown test server', () => {
        return new Promise((resolve) => {
            server.close(() => resolve());
        });
    });
});
