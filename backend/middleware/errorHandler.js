/**
 * Centralized Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Internal Server Error';

    // Handle malformed JSON body from express.json()
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        statusCode = 400;
        message = 'Malformed JSON syntax in request body';
    }

    // Handle payload too large
    if (err.type === 'entity.too.large') {
        statusCode = 413;
        message = 'Payload Too Large: Request body exceeds maximum allowed size';
    }

    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (statusCode >= 500) {
        console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err.message);
    }

    res.status(statusCode).json({
        status: 'error',
        message,
        ...(isDevelopment && statusCode >= 500 && { details: err.message }),
    });
}

module.exports = errorHandler;
