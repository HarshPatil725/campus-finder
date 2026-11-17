const crypto = require('crypto');

// In-memory server-side session registry
// Map<sessionId, { username, role, createdAt, expiresAt }>
const activeSessions = new Map();

// Session TTL: 2 hours (in milliseconds)
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// Configuration from environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CampusAdmin@2026';

// Generate salt and PBKDF2/scrypt hash for administrator
const ADMIN_SALT = process.env.ADMIN_SALT || crypto.randomBytes(16).toString('hex');
const ADMIN_PASSWORD_HASH = crypto.scryptSync(ADMIN_PASSWORD, ADMIN_SALT, 64).toString('hex');

/**
 * Hash password with scrypt and salt
 */
function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Timing-safe password verification
 */
function verifyPassword(inputPassword, storedHash, salt) {
    try {
        const inputHash = crypto.scryptSync(inputPassword, salt, 64).toString('hex');
        const bufA = Buffer.from(inputHash, 'hex');
        const bufB = Buffer.from(storedHash, 'hex');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

/**
 * Authenticate credentials and establish a secure session
 */
function login(username, password) {
    if (!username || !password) {
        return { success: false, message: 'Username and password are required' };
    }

    if (username !== ADMIN_USERNAME) {
        return { success: false, message: 'Invalid administrative credentials' };
    }

    const isValid = verifyPassword(password, ADMIN_PASSWORD_HASH, ADMIN_SALT);
    if (!isValid) {
        return { success: false, message: 'Invalid administrative credentials' };
    }

    // Generate cryptographically strong random session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const sessionData = {
        username: ADMIN_USERNAME,
        role: 'administrator',
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
    };

    activeSessions.set(sessionId, sessionData);

    return {
        success: true,
        sessionId,
        user: { username: ADMIN_USERNAME, role: 'administrator' },
        expiresAt: sessionData.expiresAt,
    };
}

/**
 * Validate active session ID
 */
function validateSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') return null;

    const session = activeSessions.get(sessionId);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        activeSessions.delete(sessionId);
        return null;
    }

    return session;
}

/**
 * Invalidate / destroy an active session
 */
function logout(sessionId) {
    if (sessionId && activeSessions.has(sessionId)) {
        activeSessions.delete(sessionId);
        return true;
    }
    return false;
}

/**
 * Cleanup expired sessions periodically
 */
function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, data] of activeSessions.entries()) {
        if (now > data.expiresAt) {
            activeSessions.delete(id);
        }
    }
}

// Sweep expired sessions every 15 minutes
const cleanupTimer = setInterval(cleanupExpiredSessions, 15 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
    login,
    validateSession,
    logout,
    hashPassword,
    verifyPassword,
    activeSessions,
};
