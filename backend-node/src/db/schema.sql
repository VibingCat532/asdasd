-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT NOT NULL,
    discord_discriminator TEXT,
    discord_avatar TEXT,
    discord_global_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discord OAuth tokens
CREATE TABLE IF NOT EXISTS discord_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expires_in INTEGER,
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App configuration
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Recruitments
CREATE TABLE IF NOT EXISTS recruitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    theme_color TEXT DEFAULT '#00E5FF',
    category TEXT NOT NULL DEFAULT 'general',
    creator_id UUID REFERENCES users(id),
    scope TEXT,
    accepted_discord_role_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recruitments
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- Recruitment questions
CREATE TABLE IF NOT EXISTS recruitment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    options JSONB,
    required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'nowe',
    questions_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application answers
CREATE TABLE IF NOT EXISTS application_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    question_label TEXT NOT NULL,
    question_type TEXT NOT NULL,
    answer_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruitment access control
CREATE TABLE IF NOT EXISTS recruitment_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_edit_questions BOOLEAN NOT NULL DEFAULT false,
    can_review_applications BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recruitment_id, user_id)
);

ALTER TABLE recruitment_access
ADD COLUMN IF NOT EXISTS can_edit_questions BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE recruitment_access
ADD COLUMN IF NOT EXISTS can_review_applications BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'applications_recruitment_id_fkey'
          AND table_name = 'applications'
    ) THEN
        ALTER TABLE applications DROP CONSTRAINT applications_recruitment_id_fkey;
    END IF;

    ALTER TABLE applications
    ADD CONSTRAINT applications_recruitment_id_fkey
    FOREIGN KEY (recruitment_id) REFERENCES recruitments(id) ON DELETE CASCADE;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_recruitment ON applications(user_id, recruitment_id);
CREATE INDEX IF NOT EXISTS idx_application_answers_application ON application_answers(application_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_questions_recruitment ON recruitment_questions(recruitment_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_access_recruitment ON recruitment_access(recruitment_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_access_user ON recruitment_access(user_id);

-- Recruitment application blacklist
CREATE TABLE IF NOT EXISTS recruitment_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruitment_id UUID NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recruitment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_blacklist_recruitment ON recruitment_blacklist(recruitment_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_blacklist_user ON recruitment_blacklist(user_id);
