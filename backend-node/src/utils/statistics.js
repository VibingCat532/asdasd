// All counts use the current decision, attributed to its most recent reviewer.
// One statement keeps the totals, reviewer table and chart in the same snapshot.
const RECRUITMENT_STATISTICS_SQL = `
WITH entries AS (
  SELECT status, reviewed_by_id, created_at, updated_at
  FROM applications WHERE recruitment_id = $1
), summary AS (
  SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'nowe')::int AS pending,
    COUNT(*) FILTER (WHERE status = 'zaakceptowane')::int AS accepted,
    COUNT(*) FILTER (WHERE status = 'odrzucone')::int AS rejected,
    COUNT(*) FILTER (WHERE status IN ('zaakceptowane', 'odrzucone'))::int AS reviewed,
    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)
      FILTER (WHERE status IN ('zaakceptowane', 'odrzucone')), 1) AS average_review_hours
  FROM entries
), reviewers AS (
  SELECT e.reviewed_by_id AS user_id,
    COALESCE(u.discord_global_name, u.discord_username, 'Nieznany sprawdzający') AS name,
    u.discord_username AS username,
    COUNT(*)::int AS reviewed,
    COUNT(*) FILTER (WHERE e.status = 'zaakceptowane')::int AS accepted,
    COUNT(*) FILTER (WHERE e.status = 'odrzucone')::int AS rejected
  FROM entries e LEFT JOIN users u ON u.id = e.reviewed_by_id
  WHERE e.status IN ('zaakceptowane', 'odrzucone')
  GROUP BY e.reviewed_by_id, u.discord_global_name, u.discord_username
), days AS (
  SELECT generate_series(
    (NOW() AT TIME ZONE 'Europe/Warsaw')::date - 13,
    (NOW() AT TIME ZONE 'Europe/Warsaw')::date, INTERVAL '1 day')::date AS day
), daily AS (
  SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date, COUNT(e.created_at)::int AS count
  FROM days d LEFT JOIN entries e
    ON (e.created_at AT TIME ZONE 'Europe/Warsaw')::date = d.day
  GROUP BY d.day
)
SELECT row_to_json(summary) AS summary,
  COALESCE((SELECT json_agg(reviewers ORDER BY reviewed DESC, name, user_id) FROM reviewers), '[]'::json) AS reviewers,
  (SELECT json_agg(daily ORDER BY date) FROM daily) AS daily
FROM summary`;

module.exports = { RECRUITMENT_STATISTICS_SQL };
