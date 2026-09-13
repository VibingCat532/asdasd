const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const express = require('express');

let db, server, base;
let owner, reviewer, analyst, applicant, recruitment, complaint;
let discordCalls = 0;

function stub(modulePath, exports) {
  require.cache[require.resolve(modulePath)] = { id: require.resolve(modulePath), filename: require.resolve(modulePath), loaded: true, exports };
}

async function request(route, { user = owner, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function addApplication(panel, status = 'nowe', checkedBy = null) {
  const result = await db.query(`INSERT INTO applications (recruitment_id, user_id, status, reviewed_by_id, questions_snapshot, created_at, updated_at)
    VALUES ($1, $2, $3, $4, '[]', NOW() - INTERVAL '2 hours', NOW()) RETURNING id`, [panel, applicant, status, checkedBy]);
  return result.rows[0].id;
}

before(async () => {
  db = new PGlite();
  const schema = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  await db.exec(schema);
  await db.exec(schema); // Migration remains safe on existing databases.
  const ids = [];
  for (const name of ['owner', 'reviewer', 'analyst', 'applicant']) {
    const { rows } = await db.query('INSERT INTO users (discord_id, discord_username) VALUES ($1, $1) RETURNING id', [name]);
    ids.push(rows[0].id);
  }
  [owner, reviewer, analyst, applicant] = ids;
  stub('../src/db', { query: (sql, values) => db.query(sql, values) });
  stub('../src/utils/auth', {
    requireAuth(req, res, next) { req.userId = req.get('x-test-user'); return req.userId ? next() : res.status(401).json({ error: 'Login required' }); },
    getUserIdFromRequest: req => req.get('x-test-user'),
  });
  stub('../src/utils/roles', {
    GUILD_ID: 'test-guild',
    resolveUserCapabilities: async discordId => ({ is_management: false, is_opiekun: discordId === 'owner', is_staff: discordId === 'owner' }),
  });
  const sideEffect = async () => { discordCalls++; return true; };
  stub('../src/utils/discord', { addGuildMember: sideEffect, addGuildMemberRole: sideEffect, sendDiscordDirectMessage: sideEffect });
  // A fake token ensures the tests exercise the complaint guard, not the missing-token guard.
  process.env.DISCORD_BOT_TOKEN = 'test-only';
  const app = express();
  app.use(express.json());
  app.use('/staff', require('../src/routes/staff'));
  app.use('/recruitments', require('../src/routes/recruitments'));
  app.use('/applications', require('../src/routes/applications'));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const created = await request('/staff/recruitments', { method: 'POST', body: { name: 'Police complaints', description: 'Report an incident', category: 'complaints', accepted_discord_role_id: 'must-be-cleared', questions: [{ label: 'Incident', field_type: 'long_text', required: true }] } });
  assert.equal(created.status, 201);
  assert.equal(created.data.accepted_discord_role_id, null);
  complaint = created.data.id;
  const { rows } = await db.query(`INSERT INTO recruitments (name, slug, description, creator_id) VALUES ('Recruitment', 'recruitment', 'Join us', $1) RETURNING id`, [owner]);
  recruitment = rows[0].id;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.close();
});

test('all eight combinations keep editing, reviewing and statistics independent', async () => {
  const application = await addApplication(recruitment);
  for (let mask = 0; mask < 8; mask++) {
    const permissions = { can_edit_questions: !!(mask & 1), can_review_applications: !!(mask & 2), can_view_statistics: !!(mask & 4) };
    await db.query('DELETE FROM recruitment_access WHERE user_id = $1', [analyst]);
    const grant = await request(`/staff/recruitments/${recruitment}/access`, { method: 'POST', body: { user_id: analyst, ...permissions } });
    assert.equal(grant.status, mask ? 201 : 422);
    const options = { user: analyst };
    const stats = await request(`/staff/recruitments/${recruitment}/statistics`, options);
    assert.equal(stats.status, mask & 4 ? 200 : 403, `statistics mask ${mask}`);
    for (const suffix of ['applications', `applications/${application}`]) {
      assert.equal((await request(`/staff/recruitments/${recruitment}/${suffix}`, options)).status, mask & 2 ? 200 : 403, `${suffix} mask ${mask}`);
    }
    assert.equal((await request(`/staff/recruitments/${recruitment}/applications/${application}/status`, { ...options, method: 'PATCH', body: { status: 'nowe' } })).status, mask & 2 ? 200 : 403);
    assert.equal((await request(`/staff/recruitments/${recruitment}/questions`, { ...options, method: 'PUT', body: { questions: [] } })).status, mask & 1 ? 200 : 403);
    assert.equal((await request(`/staff/recruitments/${recruitment}`, { ...options, method: 'PATCH', body: { name: 'Unauthorized edit' } })).status, 403);
    assert.equal((await request(`/staff/recruitments/${recruitment}/access`, options)).status, 403);
    if (mask) {
      const dashboard = await request('/staff/recruitments', options);
      const panel = dashboard.data.find(r => r.id === recruitment);
      for (const [key, value] of Object.entries(permissions)) assert.equal(panel[key], value, `dashboard ${key} mask ${mask}`);
    }
  }
  await db.query('DELETE FROM applications WHERE id = $1', [application]);
});

test('a grant can be changed to statistics only and revoked', async () => {
  const route = `/staff/recruitments/${recruitment}/access/${analyst}`;
  assert.equal((await request(route, { method: 'PATCH', body: { can_edit_questions: false, can_review_applications: false, can_view_statistics: true } })).status, 200);
  const access = await request(`/staff/recruitments/${recruitment}/access`);
  assert.equal(access.data.find(u => u.id === analyst).can_view_statistics, true);
  assert.equal((await request('/staff/me', { user: analyst })).data.is_staff, true);
  assert.equal((await request(route, { method: 'DELETE' })).status, 200);
  assert.equal((await request(`/staff/recruitments/${recruitment}/statistics`, { user: analyst })).status, 403);
});

test('statistics handle empty panels, unknown reviewers, totals and daily chart', async () => {
  let result = await request(`/staff/recruitments/${recruitment}/statistics`);
  assert.equal(result.status, 200);
  assert.equal(result.data.summary.total, 0);
  assert.equal(result.data.summary.average_review_hours, null);
  assert.deepEqual(result.data.reviewers, []);
  assert.equal(result.data.daily.length, 14);
  assert.ok(result.data.daily.every(day => day.count === 0));
  await addApplication(recruitment, 'zaakceptowane', reviewer);
  await addApplication(recruitment, 'odrzucone', reviewer);
  await addApplication(recruitment, 'zaakceptowane');
  await addApplication(recruitment);
  // Another panel must never affect this panel's totals.
  await addApplication(complaint, 'odrzucone', reviewer);
  result = await request(`/staff/recruitments/${recruitment}/statistics`);
  assert.deepEqual(result.data.summary, { total: 4, pending: 1, accepted: 2, rejected: 1, reviewed: 3, average_review_hours: 2 });
  assert.equal(result.data.reviewers.find(u => u.user_id === reviewer).reviewed, 2);
  assert.equal(result.data.reviewers.find(u => u.user_id === null).accepted, 1);
  assert.equal(result.data.daily.reduce((sum, day) => sum + day.count, 0), 4);
});

test('same decision preserves reviewer/time; changes and reopening update statistics', async () => {
  const application = await addApplication(recruitment, 'zaakceptowane', reviewer);
  const previous = (await db.query('SELECT reviewed_by_id, updated_at FROM applications WHERE id = $1', [application])).rows[0];
  const route = `/staff/recruitments/${recruitment}/applications/${application}/status`;
  assert.equal((await request(route, { method: 'PATCH', body: { status: 'zaakceptowane' } })).status, 200);
  const unchanged = (await db.query('SELECT reviewed_by_id, updated_at FROM applications WHERE id = $1', [application])).rows[0];
  assert.deepEqual(unchanged, previous);
  await request(route, { method: 'PATCH', body: { status: 'odrzucone' } });
  assert.equal((await db.query('SELECT reviewed_by_id FROM applications WHERE id = $1', [application])).rows[0].reviewed_by_id, owner);
  await request(route, { method: 'PATCH', body: { status: 'nowe' } });
  assert.equal((await db.query('SELECT reviewed_by_id FROM applications WHERE id = $1', [application])).rows[0].reviewed_by_id, null);
  const stats = (await request(`/staff/recruitments/${recruitment}/statistics`)).data;
  assert.equal(stats.summary.reviewed, 3);
  assert.equal(stats.summary.pending, 2);
});

test('complaints can be submitted repeatedly with required answers and no Discord effects', async () => {
  const panel = await request(`/recruitments/${complaint}`, { user: applicant });
  assert.equal(panel.data.category, 'complaints');
  const questionId = panel.data.questions[0].id;
  const invalid = await request(`/recruitments/${complaint}/apply`, { user: applicant, method: 'POST', body: { answers: {} } });
  assert.equal(invalid.status, 422);
  const body = { answers: { [questionId]: 'Incident details' } };
  const first = await request(`/recruitments/${complaint}/apply`, { user: applicant, method: 'POST', body });
  assert.equal(first.status, 201);
  assert.equal((await request(`/recruitments/${complaint}/apply`, { user: applicant, method: 'POST', body })).status, 201);
  // Even a stale role ID must never lead to Discord activity for complaints.
  await db.query('UPDATE recruitments SET accepted_discord_role_id = $1 WHERE id = $2', ['stale-role', complaint]);
  discordCalls = 0;
  for (const status of ['zaakceptowane', 'odrzucone']) {
    const changed = await request(`/staff/recruitments/${complaint}/applications/${first.data.id}/status`, { method: 'PATCH', body: { status } });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.discord_dm_result.attempted, false);
  }
  assert.equal(discordCalls, 0);
  await request(`/staff/recruitments/${complaint}/applications/${first.data.id}/status`, { method: 'PATCH', body: { status: 'zaakceptowane' } });
  assert.equal((await request(`/recruitments/${complaint}`, { user: applicant })).data.user_can_apply, true);
  assert.equal((await request(`/recruitments/${complaint}/apply`, { user: applicant, method: 'POST', body })).status, 201);
  assert.equal(discordCalls, 0);
  assert.equal((await request(`/applications/${first.data.id}`, { user: analyst })).status, 404);
});

test('closed and blacklisted complaint panels reject submissions; recruitment duplicate rule remains', async () => {
  await db.query("UPDATE recruitments SET status = 'inactive' WHERE id = $1", [complaint]);
  assert.equal((await request(`/recruitments/${complaint}/apply`, { user: applicant, method: 'POST', body: { answers: {} } })).status, 400);
  assert.equal((await request(`/recruitments/${complaint}`, { user: applicant })).data.user_can_apply, false);
  await db.query("UPDATE recruitments SET status = 'active' WHERE id = $1", [complaint]);
  await db.query('INSERT INTO recruitment_blacklist (recruitment_id, user_id) VALUES ($1, $2)', [complaint, applicant]);
  assert.equal((await request(`/recruitments/${complaint}/apply`, { user: applicant, method: 'POST', body: { answers: {} } })).status, 403);
  assert.equal((await request(`/recruitments/${complaint}`, { user: applicant })).data.user_can_apply, false);
  assert.equal((await request(`/recruitments/${recruitment}/apply`, { user: applicant, method: 'POST', body: { answers: {} } })).status, 409);
  assert.equal((await request(`/staff/recruitments/${recruitment}/statistics`, { user: null })).status, 401);
});
