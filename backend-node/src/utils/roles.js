/**
 * Discord role resolution and RBAC utilities
 */
const { getGuildMemberRoles } = require('./discord');
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
async function getResolvableRoles(discordId) {
  const now = Date.now();
  const cached = roleCache.get(discordId);

  if (cached && cached.expiresAt > now) {
    return cached.roles;
  }

  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      logger.warn('DISCORD_BOT_TOKEN not set - role resolution unavailable');
      return [];
    }

    const roles = await getGuildMemberRoles(GUILD_ID, discordId, botToken);
    roleCache.set(discordId, {
      roles,
      expiresAt: now + CACHE_TTL * 1000,
    });

    return roles;
  } catch (err) {
    logger.error('Role resolution failed', err.message);
    // Return cached data if available, even if expired
    if (cached) {
      return cached.roles;
    }
    return [];
  }
}

/**
 * Resolve user capabilities from Discord roles
 */
async function resolveUserCapabilities(discordId, userId) {
  const roles = await getResolvableRoles(discordId);
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
