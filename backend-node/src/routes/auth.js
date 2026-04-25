/**
 * Authentication routes - Discord OAuth, JWT management
 */
const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const {
  getDiscordOAuthUrl,
  exchangeCodeForTokens,
  getDiscordUser,
} = require('../utils/discord');
const {
  createJWT,
  setJWTCookie,
  clearJWTCookie,
  requireAuth,
  getUserIdFromRequest,
} = require('../utils/auth');
const logger = require('../utils/logger');

const router = express.Router();

function getFrontendUrl(req) {
  if (process.env.NODE_ENV !== 'production' && process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) {
    return `${protocol}://${host}`;
  }

  return (process.env.FRONTEND_URL || '/').replace(/\/$/, '');
}

// ────────── Public Endpoints ──────────

/**
 * GET /api/auth/config-status
 * Check if all required environment variables are set
 */
router.get('/config-status', (req, res) => {
  const redirectUri = process.env.DISCORD_REDIRECT_URI || '';
  const configStatus = {
    discord_client_id: !!process.env.DISCORD_CLIENT_ID,
    discord_client_secret: !!process.env.DISCORD_CLIENT_SECRET,
    discord_redirect_uri: !!process.env.DISCORD_REDIRECT_URI,
    discord_bot_token: !!process.env.DISCORD_BOT_TOKEN,
    database_url: !!process.env.DATABASE_URL,
    jwt_secret: !!process.env.JWT_SECRET,
    redirect_uri_value: redirectUri || null,
    all_required_set: !!(
      process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_REDIRECT_URI &&
      process.env.DATABASE_URL &&
      process.env.JWT_SECRET
    ),
  };

  res.json(configStatus);
});

/**
 * GET /api/auth/discord/start
 * Initiate Discord OAuth flow
 */
router.get('/discord/start', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  const missing = [];
  if (!clientId) missing.push('DISCORD_CLIENT_ID');
  if (!clientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!redirectUri) missing.push('DISCORD_REDIRECT_URI');

  if (missing.length > 0) {
    return res.status(503).json({
      error: `Discord OAuth not configured. Missing: ${missing.join(', ')}`,
    });
  }

  // Generate state token
  const state = crypto.randomBytes(32).toString('hex');

  // Set state cookie
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000, // 5 minutes
  });

  // Redirect to Discord OAuth URL
  const oauthUrl = getDiscordOAuthUrl(state);
  res.redirect(oauthUrl);
});

/**
 * GET /api/auth/discord/callback
 * Discord OAuth callback handler
 */
router.get('/discord/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = getFrontendUrl(req);

  // Handle OAuth errors
  if (error) {
    const message = error_description || error;
    return res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(message)}`);
  }

  // Validate code and state
  if (!code || !state) {
    return res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent('missing_params')}`);
  }

  const storedState = req.cookies.oauth_state;
  if (!storedState || storedState !== state) {
    return res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent('invalid_state')}`);
  }

  try {
    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent('no_access_token')}`);
    }

    // Fetch Discord user profile
    const discordUser = await getDiscordUser(accessToken);

    // Upsert user in database
    const result = await query(
      `INSERT INTO users (discord_id, discord_username, discord_discriminator, discord_avatar, discord_global_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (discord_id) DO UPDATE SET
         discord_username = EXCLUDED.discord_username,
         discord_discriminator = EXCLUDED.discord_discriminator,
         discord_avatar = EXCLUDED.discord_avatar,
         discord_global_name = EXCLUDED.discord_global_name,
         updated_at = NOW()
       RETURNING id`,
      [
        discordUser.id,
        discordUser.username || '',
        discordUser.discriminator || '0',
        discordUser.avatar,
        discordUser.global_name,
      ]
    );

    const userId = result.rows[0].id;

    // Store OAuth tokens
    await query(
      `INSERT INTO discord_oauth_tokens (user_id, access_token, refresh_token, token_type, expires_in, scope, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_type = EXCLUDED.token_type,
         expires_in = EXCLUDED.expires_in,
         scope = EXCLUDED.scope,
         updated_at = NOW()`,
      [
        userId,
        accessToken,
        tokenData.refresh_token || '',
        tokenData.token_type || 'Bearer',
        tokenData.expires_in || 604800,
        tokenData.scope || '',
      ]
    );

    // Create JWT token
    const sessionToken = createJWT(userId);

    // Set JWT cookie
    setJWTCookie(res, sessionToken);

    // Clear state cookie
    res.clearCookie('oauth_state');

    // Redirect to frontend with success
    res.redirect(`${frontendUrl}?auth=success`);
  } catch (err) {
    logger.error('Discord OAuth callback error', err);
    res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent('callback_failed')}`);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, discord_id, discord_username, discord_avatar, discord_global_name, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      discord_id: user.discord_id,
      discord_username: user.discord_username,
      discord_avatar: user.discord_avatar,
      discord_global_name: user.discord_global_name,
      created_at: user.created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get user info', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Logout the current user
 */
router.post('/logout', (req, res) => {
  clearJWTCookie(res);
  res.json({ message: 'Wylogowano' });
});

/**
 * GET /api/auth/roles-info
 * Get guild and role information
 */
router.get('/roles-info', (req, res) => {
  const { GUILD_ID, ROLE_MAP } = require('../utils/roles');
  res.json({
    guild_id: GUILD_ID,
    role_map: ROLE_MAP,
    note: 'Use /api/staff/me for resolved capabilities.',
  });
});

module.exports = router;
