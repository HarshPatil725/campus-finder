const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../backend/server');

test('Phase 4: Frontend HTML Pages and Assets Suite', async (t) => {
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

    const pages = [
        { path: '/', titleSnippet: 'Campus Wi-Fi | Network Overview', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/index.html', titleSnippet: 'Campus Wi-Fi | Network Overview', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/access-points.html', titleSnippet: 'Access Point Directory', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/performance.html', titleSnippet: 'Network Performance', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/incidents.html', titleSnippet: 'Incident Management', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/investigation.html', titleSnippet: 'Incident Investigation', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/analytics.html', titleSnippet: 'Reports &amp; Analytics', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
        { path: '/admin.html', titleSnippet: 'System Administration', brandSnippet: 'CAMPUS <span>/</span> WI-FI' },
    ];

    for (const page of pages) {
        await t.test(`Verify Page: ${page.path}`, async () => {
            const res = await fetch(`${baseUrl}${page.path}`);
            assert.equal(res.status, 200, `Path ${page.path} should return HTTP 200`);
            const contentType = res.headers.get('content-type') || '';
            assert.ok(contentType.includes('text/html'), `Content-Type should be HTML for ${page.path}`);
            const html = await res.text();
            assert.ok(html.includes(page.titleSnippet), `HTML should contain title snippet "${page.titleSnippet}"`);
            assert.ok(html.includes(page.brandSnippet), `HTML should contain brand snippet "${page.brandSnippet}"`);
            assert.ok(html.includes('SIMULATED NETWORK DATA'), 'HTML should display simulated network data indicator');
            assert.ok(html.includes('/css/style.css'), 'HTML should link to /css/style.css');
        });
    }

    await t.test('Verify Static CSS Asset: /css/style.css', async () => {
        const res = await fetch(`${baseUrl}/css/style.css`);
        assert.equal(res.status, 200);
        const css = await res.text();
        assert.ok(css.includes('--bg: #F2EDDF'), 'CSS should contain ivory background token');
        assert.ok(css.includes('--accent: #FF3D0A'), 'CSS should contain orange accent token');
    });

    await t.test('Verify Static JS Asset: /js/layout.js', async () => {
        const res = await fetch(`${baseUrl}/js/layout.js`);
        assert.equal(res.status, 200);
        const js = await res.text();
        assert.ok(js.includes('nav-link-custom'), 'JS should handle nav-link-custom highlighting');
    });

    await t.test('Teardown test server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
