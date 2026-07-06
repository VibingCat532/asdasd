/**
 * Application submission and management routes
 */
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../utils/auth');
const logger = require('../utils/logger');

const router = express.Router();
const CODE_ANSWER_MAX_BYTES = 512 * 1024;
const CODE_ANSWER_MAX_FILES = 10;
const CODE_ANSWER_MAX_TOTAL_BYTES = 5 * 1024 * 1024;

function byteLength(value) {
  return Buffer.byteLength(value || '', 'utf8');
}

function normalizeCodeFile(value) {
  if (!value) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const content = typeof value.content === 'string' ? value.content : '';
  if (!content.trim()) {
    return null;
  }

  const filename = String(value.filename || value.file_name || 'code.txt').trim().slice(0, 255) || 'code.txt';
  const language = String(value.language || '').trim().slice(0, 40);

  return {
    filename,
    language,
    size: byteLength(content),
    content,
  };
}

function normalizeCodeAnswer(value) {
  if (!value) {
    return [];
  }

  const rawFiles = Array.isArray(value) ? value : [value];
  return rawFiles
    .map(normalizeCodeFile)
    .filter(Boolean)
    .slice(0, CODE_ANSWER_MAX_FILES);
}

/**
 * POST /api/applications/:recruitmentId
 * Submit a new application
 */
async function submitApplication(req, res) {
  const { recruitmentId } = req.params;
  const { answers } = req.body;
  const userId = req.userId;

  try {
    // Check recruitment exists and is active
    const recResult = await query(
      `SELECT id, name, slug, description, status, category, theme_color, created_at
       FROM recruitments WHERE id = $1`,
      [recruitmentId]
    );

    if (recResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rekrutacja nie znaleziona' });
    }

    const recruitment = recResult.rows[0];

    if (recruitment.status !== 'active') {
      return res.status(400).json({ error: 'Ta rekrutacja nie jest aktywna' });
    }

    const blacklistResult = await query(
      `SELECT 1 FROM recruitment_blacklist
       WHERE user_id = $1 AND recruitment_id = $2
       LIMIT 1`,
      [userId, recruitmentId]
    );

    if (blacklistResult.rows.length > 0) {
      return res.status(403).json({
        error: 'Nie mozesz zlozyc podania w tej rekrutacji',
      });
    }

    // Check for existing applications
    const existingResult = await query(
      `SELECT id, status FROM applications
       WHERE user_id = $1 AND recruitment_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, recruitmentId]
    );

    if (existingResult.rows.length > 0) {
      const existingStatus = existingResult.rows[0].status;
      if (existingStatus === 'nowe') {
        return res.status(409).json({
          error: 'Masz już aktywną aplikację w tej rekrutacji',
        });
      }
      if (existingStatus === 'zaakceptowane') {
        return res.status(409).json({
          error: 'Twoja aplikacja w tej rekrutacji została już zaakceptowana',
        });
      }
    }

    // Fetch questions for validation
    const questionsResult = await query(
      `SELECT id, label, field_type, options, required, sort_order, section_title
       FROM recruitment_questions WHERE recruitment_id = $1
       ORDER BY sort_order ASC`,
      [recruitmentId]
    );

    const questions = questionsResult.rows;

    // Validate answers
    const errors = [];
    for (const q of questions) {
      const qid = q.id;
      const value = answers?.[qid];
      const codeFiles = q.field_type === 'code' ? normalizeCodeAnswer(value) : [];
      const codeTotalSize = codeFiles.reduce((sum, file) => sum + file.size, 0);

      if (q.required) {
        if (q.field_type === 'code') {
          if (codeFiles.length === 0) {
            errors.push(`Pole "${q.label}" jest wymagane`);
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0) {
            errors.push(`Pole "${q.label}" jest wymagane`);
          }
        } else if (!value || String(value).trim() === '') {
          errors.push(`Pole "${q.label}" jest wymagane`);
        }
      }

      if (q.field_type === 'code') {
        if (Array.isArray(value) && value.length > CODE_ANSWER_MAX_FILES) {
          errors.push(`W polu "${q.label}" mozna zalaczyc maksymalnie ${CODE_ANSWER_MAX_FILES} plikow`);
        }

        if (codeFiles.some(file => file.size > CODE_ANSWER_MAX_BYTES)) {
          errors.push(`Plik w polu "${q.label}" jest za duzy (maksymalnie 512 KB na plik)`);
        }

        if (codeTotalSize > CODE_ANSWER_MAX_TOTAL_BYTES) {
          errors.push(`Pliki w polu "${q.label}" sa za duze lacznie (maksymalnie 5 MB)`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(422).json({
        error: 'Walidacja nie powiodła się',
        errors,
      });
    }

    // Create snapshot of questions
    const questionsSnapshot = questions.map(q => ({
      id: q.id,
      label: q.label,
      field_type: q.field_type,
      options: q.options,
      required: q.required,
      sort_order: q.sort_order,
      section_title: q.section_title || '',
    }));
    const recruitmentSnapshot = {
      id: recruitment.id,
      name: recruitment.name,
      slug: recruitment.slug,
      description: recruitment.description,
      category: recruitment.category || 'general',
      status: recruitment.status,
      theme_color: recruitment.theme_color,
      created_at: recruitment.created_at?.toISOString?.() || recruitment.created_at,
    };

    // Insert application
    const appResult = await query(
      `INSERT INTO applications (recruitment_id, user_id, status, recruitment_snapshot, questions_snapshot)
       VALUES ($1, $2, 'nowe', $3, $4)
       RETURNING id, created_at`,
      [recruitmentId, userId, JSON.stringify(recruitmentSnapshot), JSON.stringify(questionsSnapshot)]
    );

    const applicationId = appResult.rows[0].id;
    const createdAt = appResult.rows[0].created_at;

    // Insert answers
    for (const q of questions) {
      const qid = q.id;
      const value = answers?.[qid] || '';
      let answerStr;
      if (q.field_type === 'code') {
        const codeFiles = normalizeCodeAnswer(value);
        answerStr = codeFiles.length > 0 ? JSON.stringify(codeFiles) : '';
      } else {
        answerStr = Array.isArray(value) ? JSON.stringify(value) : String(value);
      }

      await query(
        `INSERT INTO application_answers (application_id, question_id, question_label, question_type, answer_value)
         VALUES ($1, $2, $3, $4, $5)`,
        [applicationId, qid, q.label, q.field_type, answerStr]
      );
    }

    res.status(201).json({
      id: applicationId,
      status: 'nowe',
      created_at: createdAt.toISOString(),
    });
  } catch (err) {
    logger.error('Failed to submit application', err);
    res.status(500).json({ error: 'Nie udało się przesłać aplikacji' });
  }
}

router.post('/:recruitmentId', requireAuth, submitApplication);

/**
 * GET /api/applications
 * List current user's applications
 */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.userId;

  try {
    const result = await query(
      `SELECT a.id, a.status, a.created_at, a.recruitment_id, a.recruitment_snapshot,
              COALESCE(r.name, a.recruitment_snapshot->>'name', 'Usunieta rekrutacja') as recruitment_name
       FROM applications a
       LEFT JOIN recruitments r ON r.id = a.recruitment_id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );

    const applications = result.rows.map(r => ({
      id: r.id,
      recruitment_name: r.recruitment_name,
      recruitment_id: r.recruitment_id,
      recruitment_deleted: !r.recruitment_id,
      recruitment_snapshot: r.recruitment_snapshot,
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
 * GET /api/applications/:applicationId
 * Get application details with answers
 */
router.get('/:applicationId', requireAuth, async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.userId;

  try {
    // Fetch application (must belong to current user)
    const appResult = await query(
      `SELECT a.id, a.status, a.questions_snapshot, a.created_at, a.recruitment_id, a.recruitment_snapshot,
              COALESCE(r.name, a.recruitment_snapshot->>'name', 'Usunieta rekrutacja') as recruitment_name,
              COALESCE(reviewer.discord_global_name, reviewer.discord_username) as reviewer_name
       FROM applications a
       LEFT JOIN recruitments r ON r.id = a.recruitment_id
       LEFT JOIN users reviewer ON reviewer.id = a.reviewed_by_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [applicationId, userId]
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

    const answers = answersResult.rows.map(a => ({
      question_id: a.question_id,
      question_label: a.question_label,
      question_type: a.question_type,
      answer_value: a.answer_value,
    }));

    res.json({
      id: application.id,
      recruitment_name: application.recruitment_name,
      recruitment_id: application.recruitment_id,
      recruitment_deleted: !application.recruitment_id,
      recruitment_snapshot: application.recruitment_snapshot,
      status: application.status,
      questions_snapshot: application.questions_snapshot,
      answers,
      created_at: application.created_at.toISOString(),
      reviewer_name: application.reviewer_name || null,
    });
  } catch (err) {
    logger.error('Failed to get application details', err);
    res.status(500).json({ error: 'Nie udało się pobrać szczegółów aplikacji' });
  }
});

module.exports = router;
module.exports.submitApplication = submitApplication;
