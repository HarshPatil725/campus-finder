const { validateSession } = require('../services/authService');

/**
 * Extract session token from Cookie or Authorization header
 */
function extractSessionId(req) {
    // 1. Check Authorization header: Bearer <sessionId>
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }

    // 2. Check Cookie header: session_id=<sessionId>
    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        for (const cookie of cookies) {
            if (cookie.startsWith('session_id=')) {
                return decodeURIComponent(cookie.substring(11));
            }
        }
    }

    // 3. Check custom header
    if (req.headers['x-session-id']) {
        return req.headers['x-session-id'].trim();
    }

    return null;
}

/**
 * Middleware: Populate req.user if a valid session exists
 */
function sessionContext(req, res, next) {
    const sessionId = extractSessionId(req);
    if (sessionId) {
        const session = validateSession(sessionId);
        if (session) {
            req.session = session;
            req.sessionId = sessionId;
            req.user = {
                username: session.username,
                role: session.role,
            };
        }
    }
    next();
}

/**
 * Middleware: Restrict access to authorized administrators
 * Enforced unconditionally if REQUIRE_AUTH=true, or can be attached to protected routes.
 */
function requireAdmin(req, res, next) {
    const isAuthRequired = process.env.REQUIRE_AUTH === 'true';

    // If sessionContext didn't run, check session here
    if (!req.user) {
        const sessionId = extractSessionId(req);
        if (sessionId) {
            const session = validateSession(sessionId);
            if (session) {
                req.session = session;
                req.sessionId = sessionId;
                req.user = {
                    username: session.username,
                    role: session.role,
                };
            }
        }
    }

    if (req.user && req.user.role === 'administrator') {
        return next();
    }

    // If auth requirement is explicitly enforced
    if (isAuthRequired) {
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized: Administrative authentication required',
        });
    }

    // In local development mode without REQUIRE_AUTH=true, allow transparent pass-through
    next();
}

module.exports = {
    extractSessionId,
    sessionContext,
    requireAdmin,
};
