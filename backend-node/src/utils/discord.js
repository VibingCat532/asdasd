/**
 * Discord OAuth2 utilities
 */
const axios = require('axios');
const { URLSearchParams } = require('url');
const logger = require('./logger');

const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_SCOPES = 'identify guilds.members.read';

/**
 * Build the Discord OAuth2 authorization URL
 */
function getDiscordOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || '',
    redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
    response_type: 'code',
    scope: DISCORD_SCOPES,
    state,
    prompt: 'consent',
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens
 */
async function exchangeCodeForTokens(code) {
  try {
    const response = await axios.post(
      `${DISCORD_API_URL}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI || '',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (err) {
    logger.error('Discord token exchange failed', err.message);
    throw err;
  }
}

/**
 * Fetch the authenticated Discord user's profile
 */
async function getDiscordUser(accessToken) {
  try {
    const response = await axios.get(`${DISCORD_API_URL}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10000,
    });

    return response.data;
  } catch (err) {
    logger.error('Discord user fetch failed', err.message);
    throw err;
  }
}

/**
 * Fetch guild member roles from Discord API
 */
async function getGuildMemberRoles(guildId, userId, botToken) {
  try {
    const response = await axios.get(
      `${DISCORD_API_URL}/guilds/${guildId}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        timeout: 10000,
      }
    );

    return response.data.roles || [];
  } catch (err) {
    logger.error('Guild member roles fetch failed', err.message);
    return [];
  }
}

/**
 * Fetch the authenticated user's guild member roles using their OAuth token.
 */
async function getCurrentUserGuildMemberRoles(guildId, accessToken) {
  try {
    const response = await axios.get(
      `${DISCORD_API_URL}/users/@me/guilds/${guildId}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10000,
      }
    );

    return response.data.roles || [];
  } catch (err) {
    logger.error('Current user guild member roles fetch failed', err.message);
    return [];
  }
}

module.exports = {
  getDiscordOAuthUrl,
  exchangeCodeForTokens,
  getDiscordUser,
  getGuildMemberRoles,
  getCurrentUserGuildMemberRoles,
};
