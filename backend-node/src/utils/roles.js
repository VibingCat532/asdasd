/**
 * Discord role resolution and RBAC utilities
 */
const { getGuildMemberRoles, getCurrentUserGuildMemberRoles } = require('./discord');
const { query } = require('../db');
const logger = require('./logger');

const GUILD_ID = '1495819570676760696';

const ROLE_MAP = {
  '1495819852097786098': 'management',
  '1495819597180567633': 'opiekun_administracji',
  '1495821859575304392': 'opiekun',
  '1495819785215414272': 'accepted_adm',
};

const CACHE_TTL = 300; // 5 minutes
const roleCache = new Map();

/**
 * Fetch and cache guild member roles
 */
async function getResolvableRoles(discordId, userId) {
  const now = Date.now();
  const cached = roleCache.get(discordId);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  let roles = [];
  let source = 'none';

  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (botToken) {
      roles = await getGuildMemberRoles(GUILD_ID, discordId, botToken);
      source = roles.length > 0 ? 'bot' : 'bot_empty';
    } else {
      logger.warn('DISCORD_BOT_TOKEN not set - role resolution unavailable');
    }
  } catch (err) {
    logger.error('Bot role resolution failed', err.message);
  }

  if (roles.length === 0 && userId) {
    try {
      const tokenResult = await query(
        'SELECT access_token FROM discord_oauth_tokens WHERE user_id = $1',
        [userId]
      );

      const accessToken = tokenResult.rows[0]?.access_token;
      if (accessToken) {
        roles = await getCurrentUserGuildMemberRoles(GUILD_ID, accessToken);
        source = roles.length > 0 ? 'oauth' : 'oauth_empty';
      } else if (source === 'none') {
        source = 'missing_oauth_token';
      }
    } catch (err) {
      logger.error('OAuth role resolution failed', err.message);
    }
  }

  const resolved = {
    roles,
    source,
    expiresAt: now + CACHE_TTL * 1000,
  };
  roleCache.set(discordId, resolved);

  return resolved;
}

/**
 * Resolve user capabilities from Discord roles
 */
async function resolveUserCapabilities(discordId, userId) {
  const roleResolution = await getResolvableRoles(discordId, userId);
  const roles = roleResolution.roles || [];
  const resolvedRoles = roles
    .map(roleId => ROLE_MAP[roleId])
    .filter(Boolean);

  const isManagement = resolvedRoles.includes('management');
  const isOpiekun = resolvedRoles.includes('opiekun');
  const isOpiekunAdministracji = resolvedRoles.includes('opiekun_administracji');

  // Check recruitment creation limits
  let recruitmentCount = 0;
  if (isOpiekun || isOpiekunAdministracji) {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM recruitments WHERE creator_id = $1',
        [userId]
      );
      recruitmentCount = parseInt(result.rows[0]?.count || 0, 10);
    } catch (err) {
      logger.error('Failed to fetch recruitment count', err.message);
    }
  }

  const canCreateRecruitment =
    isManagement ||
    (isOpiekun && recruitmentCount < 1) ||
    (isOpiekunAdministracji && recruitmentCount < 1);

  const creationLimitReached =
    (isOpiekun && recruitmentCount >= 1) ||
    (isOpiekunAdministracji && recruitmentCount >= 1);

  return {
    discord_id: discordId,
    roles: resolvedRoles,
    discord_role_count: roles.length,
    role_resolution_source: roleResolution.source,
    is_management: isManagement,
    is_opiekun: isOpiekun,
    is_opiekun_administracji: isOpiekunAdministracji,
    is_staff: isManagement || isOpiekun || isOpiekunAdministracji,
    can_create_recruitment: canCreateRecruitment,
    creation_limit_reached: creationLimitReached,
    recruitment_count: recruitmentCount,
  };
}

/**
 * Check if user has access to a recruitment
 */
async function checkRecruitmentAccess(userId, recruitmentId) {
  try {
    // Check if user is creator
    let result = await query(
      'SELECT 1 FROM recruitments WHERE id = $1 AND creator_id = $2',
      [recruitmentId, userId]
    );

    if (result.rows.length > 0) {
      return true;
    }

    // Check explicit access grant
    result = await query(
      'SELECT 1 FROM recruitment_access WHERE recruitment_id = $1 AND user_id = $2',
      [recruitmentId, userId]
    );

    if (result.rows.length > 0) {
      return true;
    }

    return false;
  } catch (err) {
    logger.error('Failed to check recruitment access', err.message);
    return false;
  }
}

module.exports = {
  GUILD_ID,
  ROLE_MAP,
  getResolvableRoles,
  resolveUserCapabilities,
  checkRecruitmentAccess,
};
