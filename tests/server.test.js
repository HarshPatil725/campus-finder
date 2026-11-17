const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Pool } = require('pg');
const app = require('../backend/server');

test('Server and Health Check Suite', async (t) => {
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

    await t.test('GET /api/health returns 200 and database connected with valid credentials', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'ok');
        assert.equal(data.database, 'connected');
    });

    await t.test('GET /api/nonexistent returns 404 JSON', async () => {
        const res = await fetch(`${baseUrl}/api/nonexistent`);
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.equal(data.status, 'error');
    });

    await t.test('Simulate invalid database credential and verify graceful error handling', async () => {
        // Create an isolated bad pool to test failure behavior
        const badPool = new Pool({
            host: 'localhost',
            port: 5432,
            database: 'campus_wifi_db',
            user: 'invalid_user',
            password: 'wrong_password',
            connectionTimeoutMillis: 1000,
        });

        let caughtErr = null;
        try {
            await badPool.query('SELECT 1');
        } catch (err) {
            caughtErr = err;
        } finally {
            await badPool.end();
        }

        assert.ok(caughtErr, 'Invalid credentials should throw an authentication error');
        assert.ok(caughtErr.message.includes('password authentication failed') || caughtErr.message.includes('role "invalid_user" does not exist') || caughtErr.code === '28P01');
    });

    await t.test('Teardown test server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
