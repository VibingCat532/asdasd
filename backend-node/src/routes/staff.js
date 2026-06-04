/**
 * Staff/Admin routes for recruitment management
 */
const express = require('express');
const crypto = require('crypto');
const { query } = require('../db');
const { requireAuth, getUserIdFromRequest } = require('../utils/auth');
const { resolveUserCapabilities, checkRecruitmentAccess, GUILD_ID } = require('../utils/roles');
const { addGuildMember, addGuildMemberRole, sendDiscordDirectMessage } = require('../utils/discord');
const logger = require('../utils/logger');

const router = express.Router();

const RECRUITMENT_STATUSES = ['active', 'inactive'];
const RECRUITMENT_CATEGORIES = ['general', 'factions'];

function normalizeRecruitmentStatus(status) {
  if (status === undefined) {
    return undefined;
  }
  if (status === 'closed') {
    return 'inactive';
  }
  return status;
}

function isValidRecruitmentStatus(status) {
  return RECRUITMENT_STATUSES.includes(status);
}

function normalizeRecruitmentCategory(category) {
  if (category === undefined || category === null || category === '') {
    return 'general';
  }
  return category;
}

function isValidRecruitmentCategory(category) {
  return RECRUITMENT_CATEGORIES.includes(category);
}

// ────────── Helpers ──────────

function slugify(text) {
  // Normalize Unicode
  let slug = text.normalize('NFKD').toLowerCase().trim();
  // Remove special characters
  slug = slug.replace(/[^\w\s-]/g, '');
  // Replace spaces and hyphens
  slug = slug.replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '');
  // Add random suffix
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${slug || 'recruitment'}-${suffix}`;
}

async function getStaffUser(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return null;
  }

  try {
    const userResult = await query(
      'SELECT id, discord_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    return {
      userId,
      discordId: userResult.rows[0].discord_id,
    };
  } catch (err) {
    logger.error('Failed to get staff user', err);
    return null;
  }
}

async function getRecruitmentPermission(staffUser, recruitmentId) {
  const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);

  if (capabilities.is_management) {
    return {
      hasAccess: true,
      canEditRecruitment: true,
      canEditQuestions: true,
      canReviewApplications: true,
      canManageAccess: true,
      permissionLevel: 'full',
      capabilities,
    };
  }

  const recResult = await query(
    'SELECT creator_id, scope FROM recruitments WHERE id = $1',
    [recruitmentId]
  );

  if (recResult.rows.length === 0) {
    return { hasAccess: false, notFound: true, capabilities };
  }

  const recruitment = recResult.rows[0];
  if (recruitment.creator_id && recruitment.creator_id === staffUser.userId) {
    return {
      hasAccess: true,
      canEditRecruitment: true,
      canEditQuestions: true,
      canReviewApplications: true,
      canManageAccess: true,
      permissionLevel: 'full',
      capabilities,
    };
  }

  const accessResult = await query(
    `SELECT can_edit_questions, can_review_applications
     FROM recruitment_access
     WHERE recruitment_id = $1 AND user_id = $2`,
    [recruitmentId, staffUser.userId]
  );

  if (accessResult.rows.length > 0) {
    const access = accessResult.rows[0];
    return {
      hasAccess: access.can_edit_questions || access.can_review_applications,
      canEditRecruitment: false,
      canEditQuestions: access.can_edit_questions,
      canReviewApplications: access.can_review_applications,
      canManageAccess: false,
      permissionLevel: access.can_edit_questions ? 'editor' : 'reviewer',
      capabilities,
    };
  }

  return { hasAccess: false, capabilities };
}

async function requireManagementStaff(req, res) {
  const staffUser = await getStaffUser(req);
  if (!staffUser) {
    res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    return null;
  }

  const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);
  if (!capabilities.is_management) {
    res.status(403).json({ error: 'Dostep tylko dla managementu' });
    return null;
  }

  return { ...staffUser, capabilities };
}

async function applyAcceptedDiscordRole(recruitmentId, applicationId) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return { attempted: false, success: false, reason: 'missing_bot_token' };
  }

  const result = await query(
    `SELECT r.accepted_discord_role_id, u.discord_id, dot.access_token
     FROM applications a
     JOIN recruitments r ON r.id = a.recruitment_id
     JOIN users u ON u.id = a.user_id
     LEFT JOIN discord_oauth_tokens dot ON dot.user_id = u.id
     WHERE a.id = $1 AND a.recruitment_id = $2`,
    [applicationId, recruitmentId]
  );

  const row = result.rows[0];
  if (!row?.accepted_discord_role_id) {
    return { attempted: false, success: false, reason: 'missing_role_id' };
  }
  const joined = row.access_token
    ? await addGuildMember(GUILD_ID, row.discord_id, row.access_token, botToken)
    : null;
  const roleAdded = await addGuildMemberRole(GUILD_ID, row.discord_id, row.accepted_discord_role_id, botToken);

  return {
    attempted: true,
    success: roleAdded && (joined !== false),
    joined,
    role_added: roleAdded,
    reason: row.access_token ? null : 'missing_user_oauth_token_role_only',
  };
}

function buildApplicationStatusMessage(status, recruitmentName) {
  const safeRecruitmentName = recruitmentName || 'rekrutacji';

  if (status === 'zaakceptowane') {
    return `Czesc! Twoje podanie do "${safeRecruitmentName}" zostalo zaakceptowane. Gratulacje!`;
  }

  if (status === 'odrzucone') {
    return `Czesc! Twoje podanie do "${safeRecruitmentName}" zostalo odrzucone. Dziekujemy za poswiecony czas.`;
  }

  return null;
}

async function notifyApplicantApplicationStatus(recruitmentId, applicationId, status) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return { attempted: false, success: false, reason: 'missing_bot_token' };
  }

  const result = await query(
    `SELECT r.name as recruitment_name, u.discord_id
     FROM applications a
     JOIN recruitments r ON r.id = a.recruitment_id
     JOIN users u ON u.id = a.user_id
     WHERE a.id = $1 AND a.recruitment_id = $2`,
    [applicationId, recruitmentId]
  );

  const row = result.rows[0];
  if (!row) {
    return { attempted: false, success: false, reason: 'application_not_found' };
  }
  if (!row.discord_id) {
    return { attempted: false, success: false, reason: 'missing_discord_id' };
  }

  const message = buildApplicationStatusMessage(status, row.recruitment_name);
  if (!message) {
    return { attempted: false, success: false, reason: 'status_not_notifiable' };
  }

  const sent = await sendDiscordDirectMessage(row.discord_id, message, botToken);

  return {
    attempted: true,
    success: sent,
    reason: sent ? null : 'discord_dm_failed',
  };
}

// ────────── Public Staff Routes ──────────

/**
 * GET /api/staff/me
 * Get current user's staff capabilities
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);
    const accessResult = await query(
      'SELECT COUNT(*) as count FROM recruitment_access WHERE user_id = $1',
      [staffUser.userId]
    );
    const explicitAccessCount = parseInt(accessResult.rows[0]?.count || 0, 10);

    if (explicitAccessCount > 0) {
      capabilities.is_staff = true;
      capabilities.has_explicit_recruitment_access = true;
      capabilities.explicit_recruitment_access_count = explicitAccessCount;
    }

    res.json(capabilities);
  } catch (err) {
    logger.error('Failed to get staff capabilities', err);
    res.status(500).json({ error: 'Nie udało się pobrać uprawnień' });
  }
});

/**
 * GET /api/staff/recruitments
 * List recruitments accessible to the current staff member
 */
router.get('/recruitments', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);

    const explicitAccessResult = await query(
      'SELECT COUNT(*) as count FROM recruitment_access WHERE user_id = $1',
      [staffUser.userId]
    );
    const explicitAccessCount = parseInt(explicitAccessResult.rows[0]?.count || 0, 10);

    if (!capabilities.is_staff && explicitAccessCount === 0) {
      return res.status(403).json({ error: 'Brak uprawnien do panelu staff' });
    }

    let result;
    if (capabilities.is_management) {
      result = await query(
        `SELECT r.id, r.name, r.slug, r.status, r.theme_color, r.category, r.scope, r.creator_id, r.created_at,
                COUNT(DISTINCT a.id) as app_count,
                COUNT(DISTINCT CASE WHEN a.status = 'nowe' THEN a.id END) as pending_count
         FROM recruitments r
         LEFT JOIN applications a ON a.recruitment_id = r.id
         GROUP BY r.id
         ORDER BY r.created_at DESC`
      );
    } else {
      result = await query(
        `SELECT r.id, r.name, r.slug, r.status, r.theme_color, r.category, r.scope, r.creator_id, r.created_at,
                ra.can_edit_questions, ra.can_review_applications,
                COUNT(DISTINCT a.id) as app_count,
                COUNT(DISTINCT CASE WHEN a.status = 'nowe' THEN a.id END) as pending_count
         FROM recruitments r
         LEFT JOIN applications a ON a.recruitment_id = r.id
         LEFT JOIN recruitment_access ra ON ra.recruitment_id = r.id AND ra.user_id = $1
         WHERE r.creator_id = $1
            OR r.id IN (SELECT recruitment_id FROM recruitment_access WHERE user_id = $1)
         GROUP BY r.id, ra.can_edit_questions, ra.can_review_applications
         ORDER BY r.created_at DESC`,
        [staffUser.userId]
      );
    }

    const recruitments = result.rows.map(r => {
      let permissionLevel = 'viewer';
      if (capabilities.is_management) {
        permissionLevel = 'full';
      } else if (r.creator_id && r.creator_id === staffUser.userId) {
        permissionLevel = 'full';
      } else if (r.can_edit_questions) {
        permissionLevel = 'editor';
      } else {
        permissionLevel = 'reviewer';
      }

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        theme_color: r.theme_color,
        category: r.category || 'general',
        scope: r.scope,
        permission_level: permissionLevel,
        can_update_status: permissionLevel === 'full',
        can_edit_questions: permissionLevel === 'full' || !!r.can_edit_questions,
        can_review_applications: permissionLevel === 'full' || !!r.can_review_applications || permissionLevel === 'reviewer',
        app_count: parseInt(r.app_count, 10),
        pending_count: parseInt(r.pending_count, 10),
        created_at: r.created_at.toISOString(),
        can_delete_recruitment: capabilities.is_management,
      };
    });

    res.json(recruitments);
  } catch (err) {
    logger.error('Failed to list staff recruitments', err);
    res.status(500).json({ error: 'Nie udało się pobrać rekrutacji' });
  }
});

/**
 * POST /api/staff/recruitments
 * Create a new recruitment
 */
router.post('/recruitments', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);

    if (!capabilities.is_management && !capabilities.is_opiekun) {
      return res.status(403).json({
        error: capabilities.is_opiekun_administracji
          ? 'Opiekun administracji nie moze tworzyc rekrutacji'
          : 'Brak uprawnien do tworzenia rekrutacji',
      });
    }

    if (!capabilities.is_management) {
      const createdResult = await query(
        'SELECT COUNT(*) as count FROM recruitments WHERE creator_id = $1',
        [staffUser.userId]
      );
      const createdCount = parseInt(createdResult.rows[0]?.count || 0, 10);
      if (createdCount >= 1) {
        return res.status(403).json({
          error: 'Osiagnieto limit rekrutacji (max 1 na osobe z ranga opiekun)',
        });
      }
    }

    const { name, description, status = 'active', theme_color = '#00E5FF', category = 'general', scope = null, accepted_discord_role_id = null, questions = [] } = req.body;
    const normalizedStatus = normalizeRecruitmentStatus(status);
    const normalizedCategory = normalizeRecruitmentCategory(category);

    if (!name || !name.trim()) {
      return res.status(422).json({ error: 'Nazwa jest wymagana' });
    }

    if (!description || !description.trim()) {
      return res.status(422).json({ error: 'Opis jest wymagany' });
    }

    if (!isValidRecruitmentStatus(normalizedStatus)) {
      return res.status(422).json({ error: 'Status musi byc active albo inactive' });
    }

    if (!isValidRecruitmentCategory(normalizedCategory)) {
      return res.status(422).json({ error: 'Kategoria musi byc general albo factions' });
    }

    const slug = slugify(name);

    // Create recruitment
    const recResult = await query(
      `INSERT INTO recruitments (name, slug, description, status, theme_color, category, creator_id, scope, accepted_discord_role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [name, slug, description, normalizedStatus, theme_color, normalizedCategory, staffUser.userId, scope, accepted_discord_role_id]
    );

    const recruitmentId = recResult.rows[0].id;

    // Insert questions if provided
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await query(
        `INSERT INTO recruitment_questions (recruitment_id, sort_order, section_title, label, field_type, options, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          recruitmentId,
          q.sort_order || i,
          String(q.section_title || '').trim() || null,
          q.label,
          q.field_type,
          q.options ? JSON.stringify(q.options) : null,
          q.required !== false,
        ]
      );
    }

    res.status(201).json({
      id: recruitmentId,
      name,
      slug,
      description,
      status: normalizedStatus,
      theme_color,
      category: normalizedCategory,
      scope,
      accepted_discord_role_id,
      created_at: recResult.rows[0].created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to create recruitment', err);
    res.status(500).json({ error: 'Nie udało się utworzyć rekrutacji' });
  }
});

router.get('/application-history/users', requireAuth, async (req, res) => {
  try {
    const staffUser = await requireManagementStaff(req, res);
    if (!staffUser) return;

    const q = String(req.query.q || '').trim();
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE u.discord_username ILIKE $1
                  OR u.discord_global_name ILIKE $1
                  OR u.discord_id ILIKE $1`;
    }

    const result = await query(
      `SELECT u.id, u.discord_id, u.discord_username, u.discord_avatar, u.discord_global_name,
              COUNT(a.id) as application_count,
              MAX(a.created_at) as last_application_at
       FROM users u
       LEFT JOIN applications a ON a.user_id = u.id
       ${where}
       GROUP BY u.id
       HAVING COUNT(a.id) > 0 OR $${params.length + 1}::boolean = true
       ORDER BY MAX(a.created_at) DESC NULLS LAST, u.discord_username ASC
       LIMIT 50`,
      [...params, !!q]
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      discord_id: r.discord_id,
      discord_username: r.discord_username,
      discord_avatar: r.discord_avatar,
      discord_global_name: r.discord_global_name,
      application_count: parseInt(r.application_count, 10),
      last_application_at: r.last_application_at ? r.last_application_at.toISOString() : null,
    })));
  } catch (err) {
    logger.error('Failed to search application history users', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac historii uzytkownikow' });
  }
});

router.get('/application-history/users/:userId', requireAuth, async (req, res) => {
  try {
    const staffUser = await requireManagementStaff(req, res);
    if (!staffUser) return;

    const { userId } = req.params;
    const userResult = await query(
      `SELECT id, discord_id, discord_username, discord_avatar, discord_global_name
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const appsResult = await query(
      `SELECT a.id, a.recruitment_id, a.status, a.recruitment_snapshot, a.questions_snapshot,
              a.created_at, a.updated_at,
              r.id as live_recruitment_id,
              r.name as live_recruitment_name,
              r.slug as live_recruitment_slug,
              r.description as live_recruitment_description,
              r.category as live_recruitment_category,
              r.status as live_recruitment_status,
              r.theme_color as live_recruitment_theme_color
       FROM applications a
       LEFT JOIN recruitments r ON r.id = a.recruitment_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );

    const applicationIds = appsResult.rows.map(app => app.id);
    let answersByApplication = new Map();
    if (applicationIds.length > 0) {
      const answersResult = await query(
        `SELECT application_id, question_id, question_label, question_type, answer_value, created_at
         FROM application_answers
         WHERE application_id = ANY($1::uuid[])
         ORDER BY created_at ASC`,
        [applicationIds]
      );

      answersByApplication = answersResult.rows.reduce((map, answer) => {
        if (!map.has(answer.application_id)) {
          map.set(answer.application_id, []);
        }
        map.get(answer.application_id).push({
          question_id: answer.question_id,
          question_label: answer.question_label,
          question_type: answer.question_type,
          answer_value: answer.answer_value,
        });
        return map;
      }, new Map());
    }

    const applications = appsResult.rows.map(app => {
      const snapshot = app.recruitment_snapshot || {};
      const recruitment = app.live_recruitment_id
        ? {
            id: app.live_recruitment_id,
            name: app.live_recruitment_name,
            slug: app.live_recruitment_slug,
            description: app.live_recruitment_description,
            category: app.live_recruitment_category || 'general',
            status: app.live_recruitment_status,
            theme_color: app.live_recruitment_theme_color,
            deleted: false,
          }
        : {
            id: snapshot.id || app.recruitment_id,
            name: snapshot.name || 'Usunieta rekrutacja',
            slug: snapshot.slug || null,
            description: snapshot.description || '',
            category: snapshot.category || 'general',
            status: snapshot.status || null,
            theme_color: snapshot.theme_color || '#00E5FF',
            deleted: true,
          };

      return {
        id: app.id,
        status: app.status,
        recruitment_id: app.recruitment_id,
        recruitment,
        recruitment_snapshot: snapshot,
        questions_snapshot: app.questions_snapshot || [],
        answers: answersByApplication.get(app.id) || [],
        created_at: app.created_at.toISOString(),
        updated_at: app.updated_at ? app.updated_at.toISOString() : app.created_at.toISOString(),
      };
    });

    const user = userResult.rows[0];
    res.json({
      user: {
        id: user.id,
        discord_id: user.discord_id,
        discord_username: user.discord_username,
        discord_avatar: user.discord_avatar,
        discord_global_name: user.discord_global_name,
      },
      applications,
    });
  } catch (err) {
    logger.error('Failed to get user application history', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac historii podan' });
  }
});

router.get('/users', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);
    if (!capabilities.is_staff) {
      return res.status(403).json({ error: 'Brak uprawnien' });
    }

    const q = String(req.query.q || '').trim();
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE discord_username ILIKE $1 OR discord_global_name ILIKE $1 OR discord_id ILIKE $1`;
    }

    const result = await query(
      `SELECT id, discord_id, discord_username, discord_avatar, discord_global_name
       FROM users
       ${where}
       ORDER BY updated_at DESC
       LIMIT 25`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list users', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac uzytkownikow' });
  }
});

router.get('/recruitments/:recruitmentId/access', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania dostepem' });
    }

    const result = await query(
      `SELECT u.id, u.discord_id, u.discord_username, u.discord_avatar, u.discord_global_name,
              ra.can_edit_questions, ra.can_review_applications
       FROM recruitment_access ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.recruitment_id = $1
       ORDER BY u.discord_username ASC`,
      [recruitmentId]
    );

    res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list recruitment access', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac dostepow' });
  }
});

router.post('/recruitments/:recruitmentId/access', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { user_id, can_edit_questions = false, can_review_applications = true } = req.body;
    const canEditQuestions = !!can_edit_questions;
    const canReviewApplications = !!can_review_applications;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania dostepem' });
    }
    if (!canEditQuestions && !canReviewApplications) {
      return res.status(422).json({ error: 'Wybierz przynajmniej jedna permisje' });
    }

    await query(
      `INSERT INTO recruitment_access (recruitment_id, user_id, can_edit_questions, can_review_applications)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (recruitment_id, user_id) DO UPDATE SET
         can_edit_questions = EXCLUDED.can_edit_questions,
         can_review_applications = EXCLUDED.can_review_applications`,
      [recruitmentId, user_id, canEditQuestions, canReviewApplications]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('Failed to add recruitment access', err);
    res.status(500).json({ error: 'Nie udalo sie dodac dostepu' });
  }
});

router.patch('/recruitments/:recruitmentId/access/:userId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId, userId } = req.params;
    const { can_edit_questions = false, can_review_applications = true } = req.body;
    const canEditQuestions = !!can_edit_questions;
    const canReviewApplications = !!can_review_applications;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania dostepem' });
    }
    if (!canEditQuestions && !canReviewApplications) {
      return res.status(422).json({ error: 'Wybierz przynajmniej jedna permisje' });
    }

    await query(
      `UPDATE recruitment_access
       SET can_edit_questions = $1, can_review_applications = $2
       WHERE recruitment_id = $3 AND user_id = $4`,
      [canEditQuestions, canReviewApplications, recruitmentId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to update recruitment access', err);
    res.status(500).json({ error: 'Nie udalo sie zaktualizowac dostepu' });
  }
});

router.delete('/recruitments/:recruitmentId/access/:userId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId, userId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania dostepem' });
    }

    await query(
      'DELETE FROM recruitment_access WHERE recruitment_id = $1 AND user_id = $2',
      [recruitmentId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to remove recruitment access', err);
    res.status(500).json({ error: 'Nie udalo sie usunac dostepu' });
  }
});

router.get('/recruitments/:recruitmentId/blacklist', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (permission.notFound) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania blacklista' });
    }

    const result = await query(
      `SELECT u.id, u.discord_id, u.discord_username, u.discord_avatar, u.discord_global_name,
              rb.created_at, cu.discord_username as created_by_username
       FROM recruitment_blacklist rb
       JOIN users u ON u.id = rb.user_id
       LEFT JOIN users cu ON cu.id = rb.created_by
       WHERE rb.recruitment_id = $1
       ORDER BY rb.created_at DESC`,
      [recruitmentId]
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      discord_id: r.discord_id,
      discord_username: r.discord_username,
      discord_avatar: r.discord_avatar,
      discord_global_name: r.discord_global_name,
      created_by_username: r.created_by_username,
      created_at: r.created_at.toISOString(),
    })));
  } catch (err) {
    logger.error('Failed to list recruitment blacklist', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac blacklisty' });
  }
});

router.post('/recruitments/:recruitmentId/blacklist', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(422).json({ error: 'Wybierz uzytkownika' });
    }

    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (permission.notFound) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania blacklista' });
    }

    const userResult = await query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Uzytkownik nie znaleziony' });
    }

    await query(
      `INSERT INTO recruitment_blacklist (recruitment_id, user_id, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (recruitment_id, user_id) DO UPDATE SET created_by = EXCLUDED.created_by`,
      [recruitmentId, user_id, staffUser.userId]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('Failed to add recruitment blacklist entry', err);
    res.status(500).json({ error: 'Nie udalo sie dodac uzytkownika do blacklisty' });
  }
});

router.delete('/recruitments/:recruitmentId/blacklist/:userId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId, userId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (permission.notFound) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }
    if (!permission.canManageAccess) {
      return res.status(403).json({ error: 'Brak uprawnien do zarzadzania blacklista' });
    }

    await query(
      'DELETE FROM recruitment_blacklist WHERE recruitment_id = $1 AND user_id = $2',
      [recruitmentId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to remove recruitment blacklist entry', err);
    res.status(500).json({ error: 'Nie udalo sie usunac uzytkownika z blacklisty' });
  }
});

router.get('/recruitments/:recruitmentId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (permission.notFound) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }
    if (!permission.hasAccess) {
      return res.status(403).json({ error: 'Brak dostepu do tej rekrutacji' });
    }

    const recResult = await query(
      `SELECT id, name, slug, description, status, theme_color, category, scope, accepted_discord_role_id, creator_id, created_at
       FROM recruitments WHERE id = $1`,
      [recruitmentId]
    );

    const recruitment = recResult.rows[0];
    const questionsResult = await query(
      `SELECT id, label, field_type, options, required, sort_order, section_title
       FROM recruitment_questions WHERE recruitment_id = $1
       ORDER BY sort_order ASC`,
      [recruitmentId]
    );

    res.json({
      id: recruitment.id,
      name: recruitment.name,
      slug: recruitment.slug,
      description: recruitment.description,
      status: recruitment.status,
      theme_color: recruitment.theme_color,
      category: recruitment.category || 'general',
      scope: recruitment.scope,
      accepted_discord_role_id: recruitment.accepted_discord_role_id,
      creator_id: recruitment.creator_id,
      permission_level: permission.permissionLevel,
      can_edit_recruitment: permission.canEditRecruitment,
      can_edit_questions: permission.canEditQuestions,
      can_review_applications: permission.canReviewApplications,
      can_manage_access: permission.canManageAccess,
      can_delete_recruitment: permission.capabilities?.is_management === true,
      questions: questionsResult.rows.map(q => ({
        id: q.id,
        label: q.label,
        field_type: q.field_type,
        options: q.options,
        required: q.required,
        sort_order: q.sort_order,
        section_title: q.section_title || '',
      })),
      created_at: recruitment.created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get recruitment details', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac szczegolow rekrutacji' });
  }
});

/**
 * GET /api/staff/recruitments/:recruitmentId
 * Get recruitment details for staff
 */
router.get('/recruitments/:recruitmentId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;

    // Check access
    const hasAccess = await checkRecruitmentAccess(staffUser.userId, recruitmentId);
    if (!hasAccess) {
      const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);
      if (!capabilities.is_management) {
        return res.status(403).json({ error: 'Brak dostępu do tej rekrutacji' });
      }
    }

    // Fetch recruitment
    const recResult = await query(
      `SELECT id, name, slug, description, status, theme_color, category, scope, accepted_discord_role_id, creator_id, created_at
       FROM recruitments WHERE id = $1`,
      [recruitmentId]
    );

    if (recResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    const recruitment = recResult.rows[0];

    // Fetch questions
    const questionsResult = await query(
      `SELECT id, label, field_type, options, required, sort_order, section_title
       FROM recruitment_questions WHERE recruitment_id = $1
       ORDER BY sort_order ASC`,
      [recruitmentId]
    );

    res.json({
      id: recruitment.id,
      name: recruitment.name,
      slug: recruitment.slug,
      description: recruitment.description,
      status: recruitment.status,
      theme_color: recruitment.theme_color,
      category: recruitment.category || 'general',
      scope: recruitment.scope,
      accepted_discord_role_id: recruitment.accepted_discord_role_id,
      creator_id: recruitment.creator_id,
      questions: questionsResult.rows.map(q => ({
        id: q.id,
        label: q.label,
        field_type: q.field_type,
        options: q.options,
        required: q.required,
        sort_order: q.sort_order,
        section_title: q.section_title || '',
      })),
      created_at: recruitment.created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get recruitment details', err);
    res.status(500).json({ error: 'Nie udało się pobrać szczegółów rekrutacji' });
  }
});

/**
 * PATCH /api/staff/recruitments/:recruitmentId
 * Update recruitment
 */
async function updateRecruitmentSettings(req, res) {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { name, description, status, theme_color, category, scope, accepted_discord_role_id } = req.body;
    const normalizedStatus = normalizeRecruitmentStatus(status);
    const normalizedCategory = category !== undefined ? normalizeRecruitmentCategory(category) : undefined;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canEditRecruitment) {
      return res.status(403).json({ error: 'Brak uprawnien do edycji ustawien rekrutacji' });
    }

    if (normalizedStatus !== undefined && !isValidRecruitmentStatus(normalizedStatus)) {
      return res.status(422).json({ error: 'Status musi byc active albo inactive' });
    }

    if (normalizedCategory !== undefined && !isValidRecruitmentCategory(normalizedCategory)) {
      return res.status(422).json({ error: 'Kategoria musi byc general albo factions' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (normalizedStatus !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(normalizedStatus);
    }
    if (theme_color !== undefined) {
      updates.push(`theme_color = $${paramCount++}`);
      values.push(theme_color);
    }
    if (normalizedCategory !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(normalizedCategory);
    }
    if (scope !== undefined) {
      updates.push(`scope = $${paramCount++}`);
      values.push(scope);
    }
    if (accepted_discord_role_id !== undefined) {
      updates.push(`accepted_discord_role_id = $${paramCount++}`);
      values.push(accepted_discord_role_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Brak pol do aktualizacji' });
    }

    updates.push('updated_at = NOW()');
    values.push(recruitmentId);

    const sql = `UPDATE recruitments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await query(sql, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    const rec = result.rows[0];
    res.json({
      id: rec.id,
      name: rec.name,
      description: rec.description,
      status: rec.status,
      theme_color: rec.theme_color,
      category: rec.category || 'general',
      scope: rec.scope,
      accepted_discord_role_id: rec.accepted_discord_role_id,
      updated_at: rec.updated_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to update recruitment', err);
    res.status(500).json({ error: 'Nie udalo sie zaktualizowac rekrutacji' });
  }
}

router.patch('/recruitments/:recruitmentId', requireAuth, updateRecruitmentSettings);
router.put('/recruitments/:recruitmentId', requireAuth, updateRecruitmentSettings);

router.patch('/recruitments/:recruitmentId/status', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const status = normalizeRecruitmentStatus(req.body?.status);
    if (!isValidRecruitmentStatus(status)) {
      return res.status(422).json({ error: 'Status musi byc active albo inactive' });
    }

    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (permission.notFound) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }
    if (!permission.canEditRecruitment) {
      return res.status(403).json({ error: 'Brak uprawnien do zmiany statusu rekrutacji' });
    }

    const result = await query(
      `UPDATE recruitments
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, updated_at`,
      [status, recruitmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    const rec = result.rows[0];
    res.json({
      id: rec.id,
      status: rec.status,
      updated_at: rec.updated_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to update recruitment status', err);
    res.status(500).json({ error: 'Nie udalo sie zmienic statusu rekrutacji' });
  }
});

router.patch('/recruitments/:recruitmentId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { name, description, status, theme_color, category, scope, accepted_discord_role_id } = req.body;
    const normalizedCategory = category !== undefined ? normalizeRecruitmentCategory(category) : undefined;

    // Check access
    const hasAccess = await checkRecruitmentAccess(staffUser.userId, recruitmentId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Brak dostępu do tej rekrutacji' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (theme_color !== undefined) {
      updates.push(`theme_color = $${paramCount++}`);
      values.push(theme_color);
    }
    if (normalizedCategory !== undefined) {
      if (!isValidRecruitmentCategory(normalizedCategory)) {
        return res.status(422).json({ error: 'Kategoria musi byc general albo factions' });
      }
      updates.push(`category = $${paramCount++}`);
      values.push(normalizedCategory);
    }
    if (scope !== undefined) {
      updates.push(`scope = $${paramCount++}`);
      values.push(scope);
    }
    if (accepted_discord_role_id !== undefined) {
      updates.push(`accepted_discord_role_id = $${paramCount++}`);
      values.push(accepted_discord_role_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Brak pól do aktualizacji' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(recruitmentId);

    const sql = `UPDATE recruitments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    const rec = result.rows[0];
    res.json({
      id: rec.id,
      name: rec.name,
      description: rec.description,
      status: rec.status,
      theme_color: rec.theme_color,
      category: rec.category || 'general',
      scope: rec.scope,
      accepted_discord_role_id: rec.accepted_discord_role_id,
      updated_at: rec.updated_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to update recruitment', err);
    res.status(500).json({ error: 'Nie udało się zaktualizować rekrutacji' });
  }
});

/**
 * DELETE /api/staff/recruitments/:recruitmentId
 * Delete recruitment
 */
router.delete('/recruitments/:recruitmentId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);
    if (!capabilities.is_management) {
      return res.status(403).json({ error: 'Brak uprawnień do usuwania rekrutacji' });
    }

    const { recruitmentId } = req.params;

    const result = await query('DELETE FROM recruitments WHERE id = $1 RETURNING id', [recruitmentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    res.json({ success: true, message: 'Rekrutacja usunieta' });
  } catch (err) {
    logger.error('Failed to delete recruitment', err);
    res.status(500).json({ error: 'Nie udało się usunąć rekrutacji' });
  }
});

/**
 * POST /api/staff/recruitments/:recruitmentId/questions
 * Update recruitment questions
 */
async function updateRecruitmentQuestions(req, res) {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { questions } = req.body;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canEditQuestions) {
      return res.status(403).json({ error: 'Brak uprawnien do edycji pytan' });
    }

    await query('DELETE FROM recruitment_questions WHERE recruitment_id = $1', [recruitmentId]);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await query(
        `INSERT INTO recruitment_questions (recruitment_id, sort_order, section_title, label, field_type, options, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          recruitmentId,
          q.sort_order || i,
          String(q.section_title || '').trim() || null,
          q.label,
          q.field_type,
          q.options ? JSON.stringify(q.options) : null,
          q.required !== false,
        ]
      );
    }

    res.json({ success: true, message: 'Pytania zaktualizowane', count: questions.length });
  } catch (err) {
    logger.error('Failed to update questions', err);
    res.status(500).json({ error: 'Nie udalo sie zaktualizowac pytan' });
  }
}

router.post('/recruitments/:recruitmentId/questions', requireAuth, updateRecruitmentQuestions);
router.put('/recruitments/:recruitmentId/questions', requireAuth, updateRecruitmentQuestions);

router.post('/recruitments/:recruitmentId/questions', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { questions } = req.body;

    // Check access
    const hasAccess = await checkRecruitmentAccess(staffUser.userId, recruitmentId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Brak dostępu do tej rekrutacji' });
    }

    // Delete existing questions
    await query('DELETE FROM recruitment_questions WHERE recruitment_id = $1', [recruitmentId]);

    // Insert new questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await query(
        `INSERT INTO recruitment_questions (recruitment_id, sort_order, section_title, label, field_type, options, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          recruitmentId,
          q.sort_order || i,
          String(q.section_title || '').trim() || null,
          q.label,
          q.field_type,
          q.options ? JSON.stringify(q.options) : null,
          q.required !== false,
        ]
      );
    }

    res.json({ success: true, message: 'Pytania zaktualizowane', count: questions.length });
  } catch (err) {
    logger.error('Failed to update questions', err);
    res.status(500).json({ error: 'Nie udało się zaktualizować pytań' });
  }
});

/**
 * GET /api/staff/recruitments/:recruitmentId/applications
 * List applications for a recruitment
 */
router.get('/recruitments/:recruitmentId/applications', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canReviewApplications) {
      return res.status(403).json({ error: 'Brak uprawnien do sprawdzania aplikacji' });
    }

    const result = await query(
      `SELECT a.id, a.user_id, a.status, a.created_at,
              u.discord_id as applicant_discord_id,
              u.discord_username as applicant_username,
              u.discord_avatar as applicant_avatar,
              u.discord_global_name as applicant_global_name
       FROM applications a
       JOIN users u ON u.id = a.user_id
       WHERE a.recruitment_id = $1
       ORDER BY a.created_at DESC`,
      [recruitmentId]
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      applicant_discord_id: r.applicant_discord_id,
      applicant_username: r.applicant_username,
      applicant_avatar: r.applicant_avatar,
      applicant_global_name: r.applicant_global_name,
      status: r.status,
      created_at: r.created_at.toISOString(),
    })));
  } catch (err) {
    logger.error('Failed to list applications', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac aplikacji' });
  }
});

router.get('/recruitments/:recruitmentId/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId, applicationId } = req.params;
    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canReviewApplications) {
      return res.status(403).json({ error: 'Brak uprawnien do sprawdzania aplikacji' });
    }

    const appResult = await query(
      `SELECT a.id, a.user_id, a.status, a.questions_snapshot, a.created_at,
              r.name as recruitment_name,
              u.discord_id as applicant_discord_id,
              u.discord_username as applicant_username,
              u.discord_avatar as applicant_avatar,
              u.discord_global_name as applicant_global_name
       FROM applications a
       JOIN recruitments r ON r.id = a.recruitment_id
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND a.recruitment_id = $2`,
      [applicationId, recruitmentId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aplikacja nie znaleziona' });
    }

    const application = appResult.rows[0];
    const answersResult = await query(
      `SELECT question_id, question_label, question_type, answer_value
       FROM application_answers WHERE application_id = $1`,
      [applicationId]
    );

    res.json({
      id: application.id,
      user_id: application.user_id,
      recruitment_name: application.recruitment_name,
      applicant_discord_id: application.applicant_discord_id,
      applicant_username: application.applicant_username,
      applicant_avatar: application.applicant_avatar,
      applicant_global_name: application.applicant_global_name,
      status: application.status,
      questions_snapshot: application.questions_snapshot,
      answers: answersResult.rows.map(a => ({
        question_id: a.question_id,
        question_label: a.question_label,
        question_type: a.question_type,
        answer_value: a.answer_value,
      })),
      can_delete_application: permission.capabilities?.is_management === true,
      created_at: application.created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get application details', err);
    res.status(500).json({ error: 'Nie udalo sie pobrac szczegolow aplikacji' });
  }
});

router.delete('/recruitments/:recruitmentId/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const capabilities = await resolveUserCapabilities(staffUser.discordId, staffUser.userId);
    if (!capabilities.is_management) {
      return res.status(403).json({ error: 'Brak uprawnien do usuniecia podania' });
    }

    const { recruitmentId, applicationId } = req.params;
    const result = await query(
      `DELETE FROM applications
       WHERE id = $1 AND recruitment_id = $2
       RETURNING id`,
      [applicationId, recruitmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Podanie nie znalezione' });
    }

    res.json({ success: true, message: 'Podanie usuniete' });
  } catch (err) {
    logger.error('Failed to delete application', err);
    res.status(500).json({ error: 'Nie udalo sie usunac podania' });
  }
});

router.patch('/recruitments/:recruitmentId/applications/:applicationId/status', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Uzytkownik nie znaleziony' });
    }

    const { recruitmentId, applicationId } = req.params;
    const { status } = req.body;
    const validStatuses = ['nowe', 'zaakceptowane', 'odrzucone'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status musi byc jednym z: ${validStatuses.join(', ')}` });
    }

    const permission = await getRecruitmentPermission(staffUser, recruitmentId);
    if (!permission.canReviewApplications) {
      return res.status(403).json({ error: 'Brak uprawnien do zmiany statusu aplikacji' });
    }

    const result = await query(
      `WITH previous AS (
         SELECT id, status
         FROM applications
         WHERE id = $2 AND recruitment_id = $3
       ),
       updated AS (
         UPDATE applications SET status = $1, updated_at = NOW()
         WHERE id = (SELECT id FROM previous)
         RETURNING id, status, updated_at
       )
       SELECT updated.id, updated.status, updated.updated_at, previous.status as previous_status
       FROM updated, previous`,
      [status, applicationId, recruitmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aplikacja nie znaleziona' });
    }

    const app = result.rows[0];
    let discord_role_result = null;
    if (status === 'zaakceptowane') {
      discord_role_result = await applyAcceptedDiscordRole(recruitmentId, applicationId);
    }

    let discord_dm_result = null;
    if (app.previous_status !== status && ['zaakceptowane', 'odrzucone'].includes(status)) {
      try {
        discord_dm_result = await notifyApplicantApplicationStatus(recruitmentId, applicationId, status);
      } catch (notifyErr) {
        logger.error('Failed to notify applicant about application status', notifyErr);
        discord_dm_result = { attempted: true, success: false, reason: 'notification_error' };
      }
    }

    res.json({
      id: app.id,
      status: app.status,
      updated_at: app.updated_at.toISOString(),
      discord_role_result,
      discord_dm_result,
    });
  } catch (err) {
    logger.error('Failed to update application status', err);
    res.status(500).json({ error: 'Nie udalo sie zaktualizowac statusu' });
  }
});

router.get('/recruitments/:recruitmentId/applications', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;

    // Check access
    const hasAccess = await checkRecruitmentAccess(staffUser.userId, recruitmentId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Brak dostępu do tej rekrutacji' });
    }

    const result = await query(
      `SELECT a.id, a.user_id, a.status, a.created_at, u.discord_username
       FROM applications a
       JOIN users u ON u.id = a.user_id
       WHERE a.recruitment_id = $1
       ORDER BY a.created_at DESC`,
      [recruitmentId]
    );

    const applications = result.rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      discord_username: r.discord_username,
      status: r.status,
      created_at: r.created_at.toISOString(),
    }));

    res.json(applications);
  } catch (err) {
    logger.error('Failed to list applications', err);
    res.status(500).json({ error: 'Nie udało się pobrać aplikacji' });
  }
});

/**
 * GET /api/staff/recruitments/:recruitmentId/applications/:applicationId
 * Get application details for staff review
 */
router.get('/recruitments/:recruitmentId/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId, applicationId } = req.params;

    // Check access
    const hasAccess = await checkRecruitmentAccess(staffUser.userId, recruitmentId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Brak dostępu do tej rekrutacji' });
    }

    // Fetch application
    const appResult = await query(
      `SELECT a.id, a.user_id, a.status, a.questions_snapshot, a.created_at, u.discord_username, u.discord_avatar
       FROM applications a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND a.recruitment_id = $2`,
      [applicationId, recruitmentId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aplikacja nie znaleziona' });
    }

    const application = appResult.rows[0];

    // Fetch answers
    const answersResult = await query(
      `SELECT question_id, question_label, question_type, answer_value
       FROM application_answers WHERE application_id = $1`,
      [applicationId]
    );

    res.json({
      id: application.id,
      user_id: application.user_id,
      discord_username: application.discord_username,
      discord_avatar: application.discord_avatar,
      status: application.status,
      questions_snapshot: application.questions_snapshot,
      answers: answersResult.rows.map(a => ({
        question_id: a.question_id,
        question_label: a.question_label,
        question_type: a.question_type,
        answer_value: a.answer_value,
      })),
      created_at: application.created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to get application details', err);
    res.status(500).json({ error: 'Nie udało się pobrać szczegółów aplikacji' });
  }
});

/**
 * PATCH /api/staff/recruitments/:recruitmentId/applications/:applicationId/status
 * Update application status
 */
router.patch('/recruitments/:recruitmentId/applications/:applicationId/status', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId, applicationId } = req.params;
    const { status } = req.body;

    const validStatuses = ['nowe', 'zaakceptowane', 'odrzucone'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status musi być jednym z: ${validStatuses.join(', ')}`,
      });
    }

    // Check access
    const hasAccess = await checkRecruitmentAccess(staffUser.userId, recruitmentId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Brak dostępu do tej rekrutacji' });
    }

    // Update status
    const result = await query(
      `UPDATE applications SET status = $1, updated_at = NOW()
       WHERE id = $2 AND recruitment_id = $3
       RETURNING id, status, updated_at`,
      [status, applicationId, recruitmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aplikacja nie znaleziona' });
    }

    const app = result.rows[0];
    res.json({
      id: app.id,
      status: app.status,
      updated_at: app.updated_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to update application status', err);
    res.status(500).json({ error: 'Nie udało się zaktualizować statusu' });
  }
});

module.exports = router;
