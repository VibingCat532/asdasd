/**
 * Staff/Admin routes for recruitment management
 */
const express = require('express');
const crypto = require('crypto');
const { query } = require('../db');
const { requireAuth, getUserIdFromRequest } = require('../utils/auth');
const { resolveUserCapabilities, checkRecruitmentAccess } = require('../utils/roles');
const logger = require('../utils/logger');

const router = express.Router();

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

    if (!capabilities.is_staff) {
      return res.status(403).json({ error: 'Brak uprawnien do panelu staff' });
    }

    let result;
    if (capabilities.is_management) {
      result = await query(
        `SELECT r.id, r.name, r.slug, r.status, r.theme_color, r.scope, r.creator_id, r.created_at,
                COUNT(DISTINCT a.id) as app_count,
                COUNT(DISTINCT CASE WHEN a.status = 'nowe' THEN a.id END) as pending_count
         FROM recruitments r
         LEFT JOIN applications a ON a.recruitment_id = r.id
         GROUP BY r.id
         ORDER BY r.created_at DESC`
      );
    } else {
      result = await query(
        `SELECT r.id, r.name, r.slug, r.status, r.theme_color, r.scope, r.creator_id, r.created_at,
                COUNT(DISTINCT a.id) as app_count,
                COUNT(DISTINCT CASE WHEN a.status = 'nowe' THEN a.id END) as pending_count
         FROM recruitments r
         LEFT JOIN applications a ON a.recruitment_id = r.id
         WHERE r.creator_id = $1
            OR r.id IN (SELECT recruitment_id FROM recruitment_access WHERE user_id = $1)
            OR (r.scope = 'administracja' AND $2)
         GROUP BY r.id
         ORDER BY r.created_at DESC`,
        [staffUser.userId, capabilities.is_opiekun_administracji]
      );
    }

    const recruitments = result.rows.map(r => {
      let permissionLevel = 'viewer';
      if (capabilities.is_management) {
        permissionLevel = 'full';
      } else if (r.creator_id && r.creator_id === staffUser.userId) {
        permissionLevel = 'full';
      } else {
        permissionLevel = 'reviewer';
      }

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        theme_color: r.theme_color,
        scope: r.scope,
        permission_level: permissionLevel,
        app_count: parseInt(r.app_count, 10),
        pending_count: parseInt(r.pending_count, 10),
        created_at: r.created_at.toISOString(),
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

    if (!capabilities.can_create_recruitment) {
      if (capabilities.is_opiekun_administracji) {
        return res.status(403).json({
          error: 'Opiekun administracji nie może tworzyć rekrutacji',
        });
      }
      if (capabilities.creation_limit_reached) {
        return res.status(403).json({
          error: 'Osiągnięto limit rekrutacji (max 1 dla opiekuna)',
        });
      }
      return res.status(403).json({
        error: 'Brak uprawnień do tworzenia rekrutacji',
      });
    }

    const { name, description, status = 'active', theme_color = '#00E5FF', scope = null, accepted_discord_role_id = null, questions = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(422).json({ error: 'Nazwa jest wymagana' });
    }

    if (!description || !description.trim()) {
      return res.status(422).json({ error: 'Opis jest wymagany' });
    }

    const slug = slugify(name);

    // Create recruitment
    const recResult = await query(
      `INSERT INTO recruitments (name, slug, description, status, theme_color, creator_id, scope, accepted_discord_role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [name, slug, description, status, theme_color, staffUser.userId, scope, accepted_discord_role_id]
    );

    const recruitmentId = recResult.rows[0].id;

    // Insert questions if provided
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await query(
        `INSERT INTO recruitment_questions (recruitment_id, sort_order, label, field_type, options, required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          recruitmentId,
          q.sort_order || i,
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
      status,
      theme_color,
      scope,
      accepted_discord_role_id,
      created_at: recResult.rows[0].created_at.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to create recruitment', err);
    res.status(500).json({ error: 'Nie udało się utworzyć rekrutacji' });
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
      `SELECT id, name, slug, description, status, theme_color, scope, accepted_discord_role_id, creator_id, created_at
       FROM recruitments WHERE id = $1`,
      [recruitmentId]
    );

    if (recResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    const recruitment = recResult.rows[0];

    // Fetch questions
    const questionsResult = await query(
      `SELECT id, label, field_type, options, required, sort_order
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
router.patch('/recruitments/:recruitmentId', requireAuth, async (req, res) => {
  try {
    const staffUser = await getStaffUser(req);
    if (!staffUser) {
      return res.status(401).json({ error: 'Użytkownik nie znaleziony' });
    }

    const { recruitmentId } = req.params;
    const { name, description, status, theme_color, scope, accepted_discord_role_id } = req.body;

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

    await query('DELETE FROM recruitments WHERE id = $1', [recruitmentId]);

    res.json({ success: true, message: 'Rekrutacja usunięta' });
  } catch (err) {
    logger.error('Failed to delete recruitment', err);
    res.status(500).json({ error: 'Nie udało się usunąć rekrutacji' });
  }
});

/**
 * POST /api/staff/recruitments/:recruitmentId/questions
 * Update recruitment questions
 */
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
        `INSERT INTO recruitment_questions (recruitment_id, sort_order, label, field_type, options, required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          recruitmentId,
          q.sort_order || i,
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
