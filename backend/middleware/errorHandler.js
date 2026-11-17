/**
 * Centralized Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
    const statusCode = err.statusCode || err.status || 500;
    const isDevelopment = process.env.NODE_ENV !== 'production';

    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
    if (isDevelopment && err.stack) {
        console.error(err.stack);
    }

    res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        ...(isDevelopment && { stack: err.stack }),
    });
}

module.exports = errorHandler;
