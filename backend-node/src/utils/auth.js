/**
 * JWT authentication utilities
 */
const jwt = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRY_HOURS = 24;
const COOKIE_NAME = 'hs_session';

if (!JWT_SECRET) {
  logger.warn('JWT_SECRET not set - authentication will fail');
}

/**
 * Create a JWT token
 */
function createJWT(userId) {
  const payload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_HOURS * 3600,
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM });
}

/**
 * Verify a JWT token
 */
function verifyJWT(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    return payload.sub;
  } catch (err) {
    return null;
  }
}

/**
 * Get user ID from request cookies
 */
function getUserIdFromRequest(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return null;
  }
  return verifyJWT(token);
}

/**
 * Express middleware to require authentication
 */
function requireAuth(req, res, next) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Nie zalogowano' });
  }
  req.userId = userId;
  next();
}

/**
 * Set JWT cookie on response
 */
function setJWTCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: JWT_EXPIRY_HOURS * 3600 * 1000,
    path: '/',
  });
}

/**
 * Clear JWT cookie on response
 */
function clearJWTCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  createJWT,
  verifyJWT,
  getUserIdFromRequest,
  requireAuth,
  setJWTCookie,
  clearJWTCookie,
  COOKIE_NAME,
  JWT_EXPIRY_HOURS,
};
