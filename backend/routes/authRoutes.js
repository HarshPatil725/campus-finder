const express = require('express');
const router = express.Router();
const { login, logout, validateSession } = require('../services/authService');
const { extractSessionId } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({
            status: 'error',
            message: 'Username and password are required',
        });
    }

    const authResult = login(username, password);
    if (!authResult.success) {
        return res.status(401).json({
            status: 'error',
            message: authResult.message,
        });
    }

    // Set secure HttpOnly session cookie
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = [
        `session_id=${encodeURIComponent(authResult.sessionId)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${2 * 60 * 60}`, // 2 hours in seconds
        ...(isProd ? ['Secure'] : []),
    ].join('; ');

    res.setHeader('Set-Cookie', cookieOptions);

    return res.status(200).json({
        status: 'success',
        message: 'Administrator authentication successful',
        data: {
            sessionId: authResult.sessionId,
            user: authResult.user,
            expiresAt: new Date(authResult.expiresAt).toISOString(),
        },
    });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    const sessionId = extractSessionId(req);
    if (sessionId) {
        logout(sessionId);
    }

    // Expire cookie
    res.setHeader('Set-Cookie', 'session_id=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');

    return res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
    });
});

/**
 * GET /api/auth/session
 * Check current authentication state
 */
router.get('/session', (req, res) => {
    const sessionId = extractSessionId(req);
    const session = sessionId ? validateSession(sessionId) : null;

    if (!session) {
        return res.status(200).json({
            status: 'success',
            authenticated: false,
            user: null,
        });
    }

    return res.status(200).json({
        status: 'success',
        authenticated: true,
        user: {
            username: session.username,
            role: session.role,
            expiresAt: new Date(session.expiresAt).toISOString(),
        },
    });
});

module.exports = router;
