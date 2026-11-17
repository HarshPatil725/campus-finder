require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { query } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from public/ folder (same origin)
app.use(express.static(path.join(__dirname, '../public')));

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Verify database connectivity
        await query('SELECT 1 AS health_check');
        return res.status(200).json({
            status: 'ok',
            database: 'connected',
        });
    } catch (err) {
        console.error('[Health Check Failed] Database connection error:', err.message);
        return res.status(503).json({
            status: 'error',
            database: 'disconnected',
            error: err.message,
        });
    }
});

// API Routes
app.use('/api/overview', require('./routes/overviewRoutes'));
app.use('/api/access-points', require('./routes/accessPointRoutes'));
app.use('/api/readings', require('./routes/readingRoutes'));
app.use('/api/incidents', require('./routes/incidentRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// 404 Handler for undefined API routes
app.all('/api/*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `API endpoint '${req.originalUrl}' not found`,
    });
});

// Centralized Error Handler
app.use(errorHandler);

// Start server if executed directly
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`[Campus Wi-Fi Server] Running on http://localhost:${PORT}`);
        console.log(`[Campus Wi-Fi Server] Static frontend served from public/`);
    });

    // Graceful shutdown handling
    const shutdown = () => {
        console.log('[Campus Wi-Fi Server] Initiating graceful shutdown...');
        server.close(() => {
            console.log('[Campus Wi-Fi Server] HTTP server closed.');
            process.exit(0);
        });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

module.exports = app;
