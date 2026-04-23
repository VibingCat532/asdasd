# HoodStories Rekrutacje — PRD

## Original Problem Statement
Build a full-stack web application for "HoodStories Rekrutacje" (Phase 0-2). The system is a recruitment portal leveraging real Discord OAuth and Discord Guild Roles for RBAC. It requires a FastAPI backend, React frontend (dark cyberpunk theme), and Neon Postgres for persistence. Core features include public recruitment browsing, candidate application submissions, and a comprehensive role-gated Staff Dashboard for application review and recruitment creation.

## Architecture
- **Backend**: FastAPI + asyncpg (Neon Postgres)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: Discord OAuth2 + JWT httpOnly cookies
- **RBAC**: Real Discord guild roles via Bot API + explicit recruitment_access table
- **DB**: Neon Postgres (DATABASE_URL)

## UI Language
All UI text is in **Polish**. Conversational responses in English.

## Completed Phases

### Phase 0 — Foundations (DONE)
- Discord OAuth2 login/logout
- JWT httpOnly cookie sessions
- Neon Postgres schema, migrations, connection pool
- User table with Discord metadata

### Phase 1 — Public & Candidate (DONE)
- Public recruitment list (landing page)
- Recruitment detail page with question forms
- Candidate application submission
- Duplicate submission blocking
- My Applications page with status tracking

### Phase 2 — Staff Dashboard & RBAC (DONE)
- Staff dashboard with recruitment cards
- Real Discord role resolution (management, opiekun, opiekun_administracji)
- Recruitment CRUD (create, edit settings, edit questions)
- Application review panel (view answers, change status)
- Access management UI (add/remove users per recruitment)
- Permission levels: full (management/creator) vs reviewer (explicit access/opiekun_adm)

### Phase 2 — P0 Bug Fix (DONE - Apr 20, 2026)
- **Root cause**: `resolve_user_capabilities()` only checked Discord guild roles for `is_staff`, ignoring `recruitment_access` table
- **Fix**: Added query to check if user exists in `recruitment_access` table; if yes, `has_explicit_access=True` included in `is_staff` calculation
- **Result**: Explicitly added users (no Discord staff roles) can now enter /staff, see assigned recruitments, edit questions, review applications — but CANNOT create recruitments, edit core settings, or manage access lists
- **Testing**: 16/16 backend tests passed (iteration_4)

### Regression Fix — Missing Closed Recruitment (DONE - Apr 20, 2026)
- **Root cause**: Seed-data loss — "Moderacja Chatu" (closed) was deleted from DB during prior testing; seed function skipped all seeding when count > 0
- **Fix**: Made `seed_data()` idempotent (per-slug check instead of global count). Missing record auto-re-inserted on restart.
- **Result**: Public homepage shows both active (2) and closed (1) recruitments. Candidate submission still blocked for closed. Explicit-access fix unaffected.
- **Testing**: API verified, UI screenshot confirmed

## Upcoming Tasks (P1)

### Phase 3 — Discord Guild Automation
- Discord guild join automation upon application acceptance
- Discord role assignment upon application acceptance

## Key Files
- `/app/backend/role_mapping.py` — RBAC engine (Discord roles + explicit access)
- `/app/backend/staff_routes.py` — 13 staff API endpoints
- `/app/backend/db.py` — Schema, migrations, seed
- `/app/backend/auth_utils.py` — JWT + cookie helpers
- `/app/frontend/src/hooks/useAuth.js` — Auth context
- `/app/frontend/src/components/Navbar.jsx` — Navigation with RBAC
- `/app/frontend/src/pages/StaffDashboard.jsx` — Staff landing
- `/app/frontend/src/pages/StaffRecruitmentForm.jsx` — Recruitment editor (tabs gated by permission)
