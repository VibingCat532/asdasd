/**
 * Public recruitment routes
 */
const express = require('express');
const { query } = require('../db');
const applicationRoutes = require('./applications');
const { getUserIdFromRequest, requireAuth } = require('../utils/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/:recruitmentId/apply', requireAuth, applicationRoutes.submitApplication);

/**
 * GET /api/recruitments
 * List all recruitments
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.name, r.slug, r.description, r.status, r.theme_color, r.created_at,
              COUNT(rq.id) as question_count
       FROM recruitments r
       LEFT JOIN recruitment_questions rq ON rq.recruitment_id = r.id
       GROUP BY r.id
       ORDER BY r.status ASC, r.created_at DESC`
    );

    const recruitments = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      status: r.status,
      theme_color: r.theme_color,
      question_count: parseInt(r.question_count, 10),
      created_at: r.created_at.toISOString(),
    }));

    res.json(recruitments);
  } catch (err) {
    logger.error('Failed to list recruitments', err);
    res.status(500).json({ error: 'Nie udało się pobrać rekrutacji' });
  }
});

/**
 * GET /api/recruitments/:recruitmentId
 * Get recruitment details with questions and user status
 */
router.get('/:recruitmentId', async (req, res) => {
  const { recruitmentId } = req.params;

  try {
    // Fetch recruitment
    const recResult = await query(
      `SELECT id, name, slug, description, status, theme_color, created_at
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

    const questions = questionsResult.rows.map(q => ({
      id: q.id,
      label: q.label,
      field_type: q.field_type,
      options: q.options,
      required: q.required,
      sort_order: q.sort_order,
    }));

    // Check user application status if logged in
    let userCanApply = null;
    let userApplicationStatus = null;

    const userId = getUserIdFromRequest(req);
    if (userId) {
      const appResult = await query(
        `SELECT status FROM applications
         WHERE user_id = $1 AND recruitment_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [userId, recruitmentId]
      );

      if (appResult.rows.length > 0) {
        userApplicationStatus = appResult.rows[0].status;
        userCanApply = appResult.rows[0].status === 'odrzucone';
      } else {
        userCanApply = true;
      }
    }

    // Can only apply if recruitment is active
    if (recruitment.status !== 'active') {
      userCanApply = false;
    }

    res.json({
      id: recruitment.id,
      name: recruitment.name,
      slug: recruitment.slug,
      description: recruitment.description,
      status: recruitment.status,
      theme_color: recruitment.theme_color,
      questions,
      created_at: recruitment.created_at.toISOString(),
      user_can_apply: userCanApply,
      user_application_status: userApplicationStatus,
    });
  } catch (err) {
    logger.error('Failed to get recruitment details', err);
    res.status(500).json({ error: 'Nie udało się pobrać szczegółów rekrutacji' });
  }
});

module.exports = router;
