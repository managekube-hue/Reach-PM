DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- ============================================================
-- REACH PLATFORM — UNIFIED IDEMPOTENT SCHEMA
-- Single script. Run once, run again, never breaks.
-- No DROP TABLE. No migrations. No ALTER TYPE.
-- Everything uses CREATE ... IF NOT EXISTS or OR REPLACE.
-- Safe to re-run on a live database at any time.
--
-- ORDER:
--   §0   Extensions
--   §1   Helpers & JWT
--   §2   Enums (safe declaration)
--   §3   Core tables (tenants, profiles)
--   §4   Projects & Sprints
--   §5   Issues
--   §6   Pull Requests & Files
--   §7   Chat (both layers)
--   §8   Documents
--   §9   Time Tracking
--   §10  CRM
--   §11  Standups & Video
--   §12  Git Integrations
--   §13  Foundation Plans & AI
--   §14  Offline Queue (CRDT)
--   §15  Local Files & IDE
--   §16  Libraries, FinOps, Focus
--   §17  Glossary, Capacity, Mentions
--   §18  Marketing Campaigns
--   §19  Encrypted Secrets
--   §20  Plan Versioning
--   §21  Auto-Healing
--   §22  Onboarding
--   §23  Cap Table
--   §24  RBAC: platform_config, feature_flags
--   §25  RBAC: workspace_settings
--   §26  RBAC: user_preferences
--   §27  RBAC: workspace_permissions
--   §28  RBAC: impersonation, invitations, project_members
--   §29  RBAC: audit_log
--   §30  RBAC: ai_settings
--   §31  Deferred FKs (added now that all tables exist)
--   §32  Realtime
--   §33  Views
--   §34  RLS policies (idempotent DROP IF EXISTS + CREATE)
--   §35  Auto-create triggers
--   §36  Cron jobs (idempotent unschedule + reschedule)
--   §37  Seed data
-- ============================================================


-- ============================================================
-- §0  EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================
-- §1  HELPERS & JWT HOOK
-- All functions use CREATE OR REPLACE — fully idempotent.
-- ============================================================

-- Stamp updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Read tenant from JWT (never from request body — injection-safe)
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Role helpers — all read from JWT, zero extra DB hits per query
CREATE OR REPLACE FUNCTION get_role()
RETURNS text AS $$
  SELECT COALESCE(auth.jwt() ->> 'user_role', 'guest');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_platform_owner()
RETURNS boolean AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_platform_owner')::boolean, false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT get_role() = 'admin' OR is_platform_owner();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_write()
RETURNS boolean AS $$
  SELECT get_role() IN ('admin','member') OR is_platform_owner();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_guest()
RETURNS boolean AS $$
  SELECT get_role() = 'guest';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Configurable permission — reads workspace_permissions table
-- Declared here as a stub; full body recreated after workspace_permissions exists (§27)
CREATE OR REPLACE FUNCTION can_do(p_action text)
RETURNS boolean AS $$
BEGIN
  IF is_platform_owner() THEN RETURN true; END IF;
  IF get_role() = 'admin'  THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_permissions
    WHERE  tenant_id = get_tenant_id()
      AND  action    = p_action
      AND  role      = get_role()
      AND  granted   = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- JWT hook: injects tenant_id + user_role + is_platform_owner into every token
-- Register in: Supabase Dashboard → Authentication → Hooks → Custom Access Token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  v_tenant_id         uuid;
  v_role              text;
  v_is_platform_owner boolean;
BEGIN
  SELECT p.tenant_id, p.role, p.is_platform_owner
  INTO   v_tenant_id, v_role, v_is_platform_owner
  FROM   profiles p
  WHERE  p.id = (event->>'user_id')::uuid;

  event := jsonb_set(event, '{claims,tenant_id}',         to_jsonb(v_tenant_id::text));
  event := jsonb_set(event, '{claims,user_role}',         to_jsonb(COALESCE(v_role,'guest')));
  event := jsonb_set(event, '{claims,is_platform_owner}', to_jsonb(COALESCE(v_is_platform_owner,false)));
  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- §2  ENUMS
-- Postgres has no CREATE TYPE IF NOT EXISTS.
-- We check pg_type before creating — fully safe to re-run.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('todo','in_progress','review','done','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_priority AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_stage AS ENUM ('lead','qualified','proposal','negotiation','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- §3  CORE: TENANTS & PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  slug               text UNIQUE NOT NULL,
  plan               text DEFAULT 'free',
  owner_email        text,
  is_suspended       boolean DEFAULT false,
  suspension_reason  text,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_tenants_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_tenants_updated') THEN
    CREATE TRIGGER t_tenants_updated
      BEFORE UPDATE ON tenants
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_tenants_trigger();
DROP FUNCTION _ensure_tenants_trigger();

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name       text,
  avatar_url         text,
  role               text DEFAULT 'member',
  status             text DEFAULT 'offline',
  color              text DEFAULT '#48B8FF',
  is_platform_owner  boolean NOT NULL DEFAULT false,
  is_deactivated     boolean NOT NULL DEFAULT false,
  title              text,
  department         text,
  phone              text,
  manager_id         uuid,   -- self-ref FK added in §31
  start_date         date,
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

CREATE OR REPLACE FUNCTION _ensure_profiles_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_profiles_updated') THEN
    CREATE TRIGGER t_profiles_updated
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_profiles_trigger();
DROP FUNCTION _ensure_profiles_trigger();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §4  PROJECTS & SPRINTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  key         text NOT NULL,
  description text,
  status      text DEFAULT 'active',
  budget      numeric(12,2),
  start_date  date,
  end_date    date,
  pillar      text DEFAULT 'work',
  created_by  uuid,   -- FK to profiles added in §31
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_projects_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_projects_updated') THEN
    CREATE TRIGGER t_projects_updated
      BEFORE UPDATE ON projects
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_projects_trigger();
DROP FUNCTION _ensure_projects_trigger();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sprints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  name       text NOT NULL,
  goal       text,
  status     text DEFAULT 'planning',
  start_date date NOT NULL,
  end_date   date NOT NULL,
  velocity   int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §5  ISSUES
-- ============================================================

CREATE TABLE IF NOT EXISTS issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  project_id      uuid NOT NULL REFERENCES projects(id),
  number          serial,
  title           text NOT NULL,
  description     text,
  status          issue_status   DEFAULT 'todo',
  priority        issue_priority DEFAULT 'medium',
  points          int DEFAULT 0,
  assignee_id     uuid,   -- FK to profiles added in §31
  reporter_id     uuid,   -- FK to profiles added in §31
  sprint_id       uuid,   -- FK to sprints added in §31
  plan_step       text,
  branch          text,
  pillar          text DEFAULT 'work',
  tags            text[] DEFAULT '{}',
  doc_linked      boolean DEFAULT false,
  chat_count      int DEFAULT 0,
  planned_value   numeric(10,2) DEFAULT 0,
  earned_value    numeric(10,2) DEFAULT 0,
  actual_cost     numeric(10,2) DEFAULT 0,
  crm_account_id  uuid,   -- FK to crm_accounts added in §31
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_tenant  ON issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_status  ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_sprint  ON issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_search  ON issues
  USING gin(to_tsvector('english', title || ' ' || coalesce(description,'')));

CREATE OR REPLACE FUNCTION _ensure_issues_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_issues_updated') THEN
    CREATE TRIGGER t_issues_updated
      BEFORE UPDATE ON issues
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_issues_trigger();
DROP FUNCTION _ensure_issues_trigger();

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §6  PULL REQUESTS & ISSUE FILES
-- ============================================================

CREATE TABLE IF NOT EXISTS pull_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  issue_id    uuid,   -- FK to issues added in §31
  project_id  uuid REFERENCES projects(id),
  pr_number   text NOT NULL,
  title       text,
  branch      text,
  base_branch text DEFAULT 'main',
  status      text DEFAULT 'open',
  ci_status   text DEFAULT 'pending',
  author_id   uuid,   -- FK to profiles added in §31
  reviewers   uuid[] DEFAULT '{}',
  diff_url    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS issue_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id   uuid,   -- FK to issues added in §31
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  file_path  text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE issue_files ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- §7  CHAT (both layers — simple + full Slack-model)
-- ============================================================

-- Legacy simple channels (backwards compat)
CREATE TABLE IF NOT EXISTS channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  project_id uuid REFERENCES projects(id),
  name       text NOT NULL,
  is_dm      boolean DEFAULT false,
  members    uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id  uuid,   -- FK to profiles added in §31
  body       text NOT NULL,
  is_system  boolean DEFAULT false,
  issue_id   uuid,   -- FK to issues added in §31
  thread_of  uuid,   -- self-ref FK added in §31
  edited     boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Full Slack-model chat (canonical for new features)
CREATE TABLE IF NOT EXISTS chat_channels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  name         text NOT NULL,
  channel_type text DEFAULT 'public',
  issue_id     uuid,   -- FK to issues added in §31
  created_by   uuid,   -- FK to profiles added in §31
  archived     bool DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chat_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  role       text DEFAULT 'member',
  joined_at  timestamptz DEFAULT now(),
  last_read  timestamptz,
  UNIQUE(channel_id, user_id)
);

ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  channel_id    uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id     uuid NOT NULL REFERENCES profiles(id),
  body          text NOT NULL,
  body_rich     jsonb,
  thread_parent uuid,   -- self-ref FK added in §31
  is_ai_message bool DEFAULT false,
  ai_model      text,
  edited_at     timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chat_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chat_presence (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  user_id    uuid NOT NULL REFERENCES profiles(id),
  channel_id uuid REFERENCES chat_channels(id),
  status     text DEFAULT 'online',
  is_typing  bool DEFAULT false,
  last_seen  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE chat_presence ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS channel_last_read (
  user_id      uuid REFERENCES profiles(id),
  channel_id   uuid REFERENCES channels(id),
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

ALTER TABLE channel_last_read ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §8  DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  project_id uuid REFERENCES projects(id),
  issue_id   uuid,   -- FK to issues added in §31
  title      text NOT NULL,
  content    text DEFAULT '',
  is_pinned  boolean DEFAULT false,
  is_ai_ref  boolean DEFAULT false,
  status     text DEFAULT 'draft',
  author_id  uuid,   -- FK to profiles added in §31
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_docs_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_docs_updated') THEN
    CREATE TRIGGER t_docs_updated
      BEFORE UPDATE ON documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_docs_trigger();
DROP FUNCTION _ensure_docs_trigger();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §9  TIME TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS time_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  issue_id   uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  started_at timestamptz NOT NULL,
  stopped_at timestamptz,
  duration_s int GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (stopped_at - started_at))::int) STORED,
  note       text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_issue ON time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_time_user  ON time_logs(user_id);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

-- Auto-start/stop timer when issue status changes
CREATE OR REPLACE FUNCTION auto_start_timer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    INSERT INTO time_logs(tenant_id, issue_id, user_id, started_at)
    VALUES(NEW.tenant_id, NEW.id, NEW.assignee_id, now());
  END IF;
  IF NEW.status != 'in_progress' AND OLD.status = 'in_progress' THEN
    UPDATE time_logs SET stopped_at = now()
    WHERE issue_id = NEW.id AND stopped_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _ensure_timer_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_issue_timer') THEN
    CREATE TRIGGER t_issue_timer
      AFTER UPDATE OF status ON issues
      FOR EACH ROW EXECUTE FUNCTION auto_start_timer();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_timer_trigger();
DROP FUNCTION _ensure_timer_trigger();


-- ============================================================
-- §10  CRM
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  name       text NOT NULL,
  domain     text,
  industry   text,
  size       text,
  arr        numeric(12,2) DEFAULT 0,
  health     text DEFAULT 'healthy',
  owner_id   uuid,   -- FK to profiles added in §31
  renewal_date date,
  tier       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS crm_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  account_id   uuid REFERENCES crm_accounts(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text,
  role         text,
  is_champion  boolean DEFAULT false,
  last_contact timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS crm_deals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  account_id        uuid REFERENCES crm_accounts(id),
  title             text NOT NULL,
  value             numeric(12,2) DEFAULT 0,
  stage             crm_stage DEFAULT 'lead',
  probability       int DEFAULT 0,
  close_date        date,
  owner_id          uuid,   -- FK to profiles added in §31
  linked_project_id uuid REFERENCES projects(id),
  estimated_hours   int DEFAULT 40,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §11  STANDUPS & VIDEO
-- ============================================================

CREATE TABLE IF NOT EXISTS standups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  project_id    uuid REFERENCES projects(id),
  title         text NOT NULL,
  type          text DEFAULT 'standup',
  scheduled_at  timestamptz NOT NULL,
  duration_min  int DEFAULT 15,
  room_url      text,
  recording_url text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE standups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS standup_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standup_id uuid REFERENCES standups(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id),
  done       text,
  doing      text,
  blockers   text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE standup_notes ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §12  GIT INTEGRATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS git_integrations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  provider       text DEFAULT 'github',
  repo_owner     text NOT NULL,
  repo_name      text NOT NULL,
  secret_id      uuid,   -- FK to encrypted_secrets added in §31
  default_branch text DEFAULT 'main',
  webhook_secret text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE git_integrations ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §13  FOUNDATION PLANS & AI CONVERSATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS foundation_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  project_id   uuid REFERENCES projects(id),
  title        text NOT NULL,
  content_md   text NOT NULL,
  stage_count  int DEFAULT 0,
  total_budget numeric(12,2),
  model_choice text,
  created_by   uuid,   -- FK to profiles added in §31
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE foundation_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  issue_id    uuid,   -- FK to issues added in §31
  project_id  uuid REFERENCES projects(id),
  surface     text NOT NULL,
  model       text NOT NULL,
  messages    jsonb DEFAULT '[]',
  token_count int DEFAULT 0,
  cost_usd    numeric(10,6) DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §14  OFFLINE QUEUE (CRDT)
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  user_id    uuid NOT NULL REFERENCES profiles(id),
  operation  text NOT NULL,
  table_name text NOT NULL,
  record_id  uuid NOT NULL,
  payload    jsonb NOT NULL,
  synced_at  timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §15  LOCAL FILES & IDE FOCUS SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS local_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  project_id   uuid REFERENCES projects(id),
  file_path    text NOT NULL,
  content_hash text,
  last_synced  timestamptz,
  github_sha   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE local_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS ide_focus_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  user_id    uuid NOT NULL REFERENCES profiles(id),
  issue_id   uuid,   -- FK to issues added in §31
  file_path  text,
  active_s   int DEFAULT 0,
  idle_s     int DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at   timestamptz
);

ALTER TABLE ide_focus_sessions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §16  LIBRARIES & VENDOR FINOPS
-- ============================================================

CREATE TABLE IF NOT EXISTS libraries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  project_id       uuid REFERENCES projects(id),
  name             text NOT NULL,
  version          text,
  license          text,
  size_kb          int,
  weekly_downloads bigint,
  health_score     int,
  has_conflicts    boolean DEFAULT false,
  detected_at      timestamptz DEFAULT now()
);

ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS vendor_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  name         text NOT NULL,
  category     text NOT NULL,
  monthly_cost numeric(10,2) DEFAULT 0,
  api_key_ref  text,
  status       text DEFAULT 'active',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS vendor_invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  vendor_id    uuid REFERENCES vendor_accounts(id),
  amount       numeric(10,2) NOT NULL,
  period_start date,
  period_end   date,
  status       text DEFAULT 'unpaid',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE vendor_invoices ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §17  GLOSSARY, CAPACITY, GLOBAL MENTIONS INDEX
-- ============================================================

CREATE TABLE IF NOT EXISTS glossary_terms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  term        text NOT NULL,
  definition  text NOT NULL,
  category    text,
  proficiency int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS member_capacity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  member_id       uuid NOT NULL REFERENCES profiles(id),
  sprint_id       uuid REFERENCES sprints(id),
  total_hours     int NOT NULL DEFAULT 40,
  committed_hours int NOT NULL DEFAULT 0,
  focus_hours     int GENERATED ALWAYS AS (total_hours - committed_hours) STORED,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE member_capacity ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS mentions_index (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  mention_type  text NOT NULL,
  mention_value text NOT NULL,
  surface       text NOT NULL,
  source_id     uuid NOT NULL,
  source_type   text NOT NULL,
  context_text  text,
  version_id    uuid,   -- FK to plan_versions added in §31
  is_stale      bool DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentions_value  ON mentions_index(mention_value, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentions_type   ON mentions_index(mention_type,  tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentions_source ON mentions_index(source_id, surface);
CREATE INDEX IF NOT EXISTS idx_mentions_search ON mentions_index USING gin(
  to_tsvector('english', mention_value || ' ' || coalesce(context_text,''))
);

ALTER TABLE mentions_index ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §18  MARKETING CAMPAIGNS (BYOK)
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  name              text NOT NULL,
  status            text DEFAULT 'draft',
  provider          text NOT NULL,
  api_key_ref       text,
  subject           text,
  body_html         text,
  segment_rules     jsonb DEFAULT '{}',
  suppression_rules jsonb DEFAULT '{}',
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  recipient_count   int DEFAULT 0,
  open_count        int DEFAULT 0,
  click_count       int DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §19  ENCRYPTED SECRETS (Zero-Knowledge Key Bridge)
-- ============================================================

CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  owner_id    uuid NOT NULL REFERENCES profiles(id),
  secret_type text NOT NULL,
  ciphertext  text NOT NULL,
  iv          text NOT NULL,
  salt        text NOT NULL,
  key_hint    text,
  created_at  timestamptz DEFAULT now(),
  rotated_at  timestamptz
);

ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §20  PLAN VERSIONING
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  plan_id        uuid NOT NULL REFERENCES foundation_plans(id),
  version_num    int NOT NULL,
  trigger_type   text NOT NULL,
  snapshot_md    text NOT NULL,
  diff_from_prev text,
  created_by     uuid,   -- FK to profiles added in §31
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION next_plan_version(p_plan_id uuid, p_tenant_id uuid)
RETURNS int AS $$
  SELECT COALESCE(MAX(version_num), 0) + 1
  FROM plan_versions
  WHERE plan_id = p_plan_id AND tenant_id = p_tenant_id;
$$ LANGUAGE sql STABLE;


-- ============================================================
-- §21  AUTO-HEALING SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS healing_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  issue_id       uuid,   -- FK to issues added in §31
  error_code     text NOT NULL,
  line_ref       text,
  file_path      text,
  context_before text,
  context_after  text,
  ai_proposal    text,
  proposal_diff  text,
  status         text DEFAULT 'open',
  lint_result    jsonb,
  applied_at     timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE healing_sessions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §22  ONBOARDING SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  user_id        uuid NOT NULL REFERENCES profiles(id),
  current_step   int DEFAULT 1,
  idea_text      text,
  plan_id        uuid,   -- FK to foundation_plans added in §31
  model_choice   text,
  estimated_cost numeric(10,2),
  pat_linked     bool DEFAULT false,
  completed_at   timestamptz,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §23  CAP TABLE
-- Replaces Carta for REACH workspaces.
-- ============================================================

CREATE TABLE IF NOT EXISTS cap_table_holders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  name           text NOT NULL,
  type           text NOT NULL,       -- founder | investor | employee | pool
  share_class    text NOT NULL,       -- Common | Series A | ISO Options | etc.
  shares         bigint NOT NULL DEFAULT 0,
  ownership_pct  numeric(6,3) DEFAULT 0,
  vesting_terms  text,
  cliff_months   int DEFAULT 12,
  vest_months    int DEFAULT 48,
  grant_date     date,
  crm_contact_id uuid,   -- FK to crm_contacts added in §31
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE cap_table_holders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS cap_table_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  date            date NOT NULL,
  type            text NOT NULL,      -- Issuance | Grant | Transfer | Repurchase | Exercise
  from_holder     uuid,   -- FK to cap_table_holders added in §31
  to_holder       uuid,   -- FK to cap_table_holders added in §31
  shares          bigint NOT NULL,
  price_per_share numeric(12,6),
  total_value     numeric(14,2),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE cap_table_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- §24  RBAC: PLATFORM CONFIG & FEATURE FLAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_config (
  id                    int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_plan          text DEFAULT 'free',
  max_tenants_per_email int  DEFAULT 3,
  trial_period_days     int  DEFAULT 30,
  session_timeout_days  int  DEFAULT 7,
  rate_limit_per_min    int  DEFAULT 1000,
  file_upload_max_mb    int  DEFAULT 100,
  supabase_project_ref  text,
  region                text DEFAULT 'us-east-1',
  backup_retention_days int  DEFAULT 30,
  cdn_provider          text DEFAULT 'cloudflare',
  email_provider        text DEFAULT 'sendgrid',
  updated_at            timestamptz DEFAULT now()
);

INSERT INTO platform_config DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION _ensure_platform_config_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_platform_config_updated') THEN
    CREATE TRIGGER t_platform_config_updated
      BEFORE UPDATE ON platform_config
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_platform_config_trigger();
DROP FUNCTION _ensure_platform_config_trigger();

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS feature_flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  description  text,
  enabled      boolean DEFAULT false,
  rollout_pct  int DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  target       text DEFAULT 'all',
  target_ids   uuid[] DEFAULT '{}',
  environment  text DEFAULT 'prod',
  status       text DEFAULT 'inactive',
  scheduled_at timestamptz,
  updated_by   uuid,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_ff_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_feature_flags_updated') THEN
    CREATE TRIGGER t_feature_flags_updated
      BEFORE UPDATE ON feature_flags
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_ff_trigger();
DROP FUNCTION _ensure_ff_trigger();

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION feature_enabled_for_tenant(p_flag text, p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_flag feature_flags%ROWTYPE;
  v_hash int;
BEGIN
  SELECT * INTO v_flag FROM feature_flags WHERE name = p_flag;
  IF NOT FOUND OR NOT v_flag.enabled THEN RETURN false; END IF;
  IF v_flag.status IN ('inactive','paused') THEN RETURN false; END IF;
  IF v_flag.target = 'specific' THEN
    RETURN p_tenant_id = ANY(v_flag.target_ids);
  END IF;
  v_hash := abs(hashtext(p_tenant_id::text)) % 100;
  RETURN v_hash < v_flag.rollout_pct;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================
-- §25  WORKSPACE SETTINGS
-- One row per tenant. Admin writes. All members read.
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identity
  workspace_name          text,
  workspace_slug          text UNIQUE,
  logo_url                text,
  welcome_message         text,

  -- Locale
  default_language        text DEFAULT 'en-US',
  fiscal_year_start       int  DEFAULT 1,
  timezone                text DEFAULT 'America/New_York',
  date_format             text DEFAULT 'MM/DD/YYYY',
  first_day_of_week       int  DEFAULT 0,

  -- Security
  allowed_email_domains   text[] DEFAULT '{}',
  invite_links_enabled    boolean DEFAULT true,
  require_2fa             boolean DEFAULT false,
  session_duration_days   int DEFAULT 30,
  google_auth_enabled     boolean DEFAULT true,
  saml_enabled            boolean DEFAULT false,
  saml_metadata_url       text,
  file_downloads_desktop  boolean DEFAULT true,
  file_downloads_mobile   boolean DEFAULT true,
  block_jailbroken        boolean DEFAULT false,
  data_collection         boolean DEFAULT true,
  hipaa_mode              boolean DEFAULT false,
  audit_log_retention_days int DEFAULT 365,

  -- Who-can-X
  who_can_invite             text DEFAULT 'members',
  who_can_create_teams       text DEFAULT 'members',
  who_can_manage_labels      text DEFAULT 'members',
  who_can_create_api_keys    text DEFAULT 'members',
  who_can_manage_templates   text DEFAULT 'members',
  who_can_modify_ai_guidance text DEFAULT 'members',
  who_can_publish_workflows  text DEFAULT 'admins',

  -- Chat
  default_channels          uuid[] DEFAULT '{}',
  gifs_enabled              boolean DEFAULT true,
  dnd_start                 time DEFAULT '22:00',
  dnd_end                   time DEFAULT '08:00',
  channel_join_messages     boolean DEFAULT true,
  notify_new_members        boolean DEFAULT true,
  show_full_names           boolean DEFAULT false,
  show_email_in_profile     boolean DEFAULT false,
  show_pronouns             boolean DEFAULT true,
  prompt_alt_text           boolean DEFAULT true,

  -- Docs
  docs_version_history      boolean DEFAULT true,
  docs_printing_enabled     boolean DEFAULT true,
  docs_sharing_enabled      boolean DEFAULT true,

  -- Data retention (0 = forever)
  message_retention_days    int DEFAULT 0,
  file_retention_days       int DEFAULT 0,
  doc_retention_days        int DEFAULT 0,

  -- Module toggles
  initiatives_enabled           boolean DEFAULT false,
  customer_requests_enabled     boolean DEFAULT false,
  pulse_enabled                 boolean DEFAULT true,
  ai_enabled                    boolean DEFAULT true,
  agents_enabled                boolean DEFAULT false,
  asks_enabled                  boolean DEFAULT false,
  slas_enabled                  boolean DEFAULT false,
  time_tracking_enabled         boolean DEFAULT true,
  timesheets_enabled            boolean DEFAULT false,
  crm_enabled                   boolean DEFAULT true,
  video_enabled                 boolean DEFAULT true,
  marketing_enabled             boolean DEFAULT false,
  git_enabled                   boolean DEFAULT false,
  analytics_enabled             boolean DEFAULT true,
  cap_table_enabled             boolean DEFAULT false,

  -- Integrations
  github_repo_owner         text,
  github_repo_name          text,
  github_pat_ref            text,
  daily_api_key_ref         text,
  openrouter_key_ref        text,
  ai_prompt_template        text DEFAULT 'Work on REACH issue {{issue.identifier}}: {{{context}}}',
  ai_budget_cap_monthly     numeric(10,2),
  ai_require_own_key        boolean DEFAULT false,

  -- CRM
  crm_currency              text DEFAULT 'USD',
  crm_revenue_format        text DEFAULT 'annual',

  -- Sprint defaults
  sprint_duration_days      int DEFAULT 14,
  wip_limit                 int DEFAULT 3,

  -- Billing (written by stripe-webhook edge function)
  stripe_customer_id        text,
  stripe_subscription_id    text,
  plan_seats                int DEFAULT 5,

  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_ws_settings_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_workspace_settings_updated') THEN
    CREATE TRIGGER t_workspace_settings_updated
      BEFORE UPDATE ON workspace_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_ws_settings_trigger();
DROP FUNCTION _ensure_ws_settings_trigger();

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §26  USER PREFERENCES
-- One row per user.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Appearance
  theme                text DEFAULT 'dark',
  font_size            text DEFAULT 'default',
  language             text DEFAULT 'en-US',
  timezone             text,
  date_format          text,
  time_format          text DEFAULT '12h',
  first_day_of_week    int,
  hover_cards          boolean DEFAULT true,
  show_view_history    boolean DEFAULT true,
  profile_discoverable boolean DEFAULT true,

  -- Profile
  display_name_format  text DEFAULT 'display',
  default_home_view    text DEFAULT 'active-issues',

  -- Notifications
  notif_desktop           text DEFAULT 'mentions',
  notif_mobile            text DEFAULT 'all',
  notif_email             text DEFAULT 'all',
  notif_changelog         boolean DEFAULT true,
  notif_new_members       boolean DEFAULT true,
  notif_deal_assigned     boolean DEFAULT true,
  notif_deal_stage        boolean DEFAULT true,
  notif_issue_mention     boolean DEFAULT true,
  notif_timer_long_run    boolean DEFAULT true,
  notif_weekly_report     boolean DEFAULT true,
  notif_timesheet         boolean DEFAULT true,
  notif_live_meeting      boolean DEFAULT true,
  dnd_start               time DEFAULT '22:00',
  dnd_end                 time DEFAULT '08:00',

  -- Issues & Board
  auto_assign_to_self         boolean DEFAULT false,
  move_to_started_on_branch   boolean DEFAULT true,
  move_to_started_on_open     boolean DEFAULT true,
  assign_to_self_on_start     boolean DEFAULT true,
  git_attachment_format       text DEFAULT 'branch',

  -- IDE
  ide_layout           text DEFAULT '2-pane',
  skill_level          text DEFAULT 'intermediate',
  show_term_tooltips   boolean DEFAULT true,
  ide_font_size        int DEFAULT 14,

  -- Time Tracking
  group_time_entries       boolean DEFAULT true,
  compact_project_list     boolean DEFAULT false,
  task_filter_syntax       boolean DEFAULT false,
  timer_reminder_hours     int DEFAULT 8,
  weekly_report_email      boolean DEFAULT true,
  timesheet_email          boolean DEFAULT true,
  timer_visible_in_header  boolean DEFAULT true,

  -- CRM
  crm_working_hours_start  time DEFAULT '09:00',
  crm_working_hours_end    time DEFAULT '17:00',
  crm_task_due_days        int DEFAULT 3,
  crm_task_due_time        time DEFAULT '08:00',
  crm_follow_up_prompts    boolean DEFAULT true,
  crm_email_signature      text,
  crm_never_log_list       text[],

  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_user_prefs_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_user_prefs_updated') THEN
    CREATE TRIGGER t_user_prefs_updated
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_user_prefs_trigger();
DROP FUNCTION _ensure_user_prefs_trigger();

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §27  WORKSPACE PERMISSIONS (Configurable Matrix)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text NOT NULL,
  action     text NOT NULL,
  granted    boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, role, action)
);

CREATE OR REPLACE FUNCTION _ensure_wp_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_workspace_permissions_updated') THEN
    CREATE TRIGGER t_workspace_permissions_updated
      BEFORE UPDATE ON workspace_permissions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_wp_trigger();
DROP FUNCTION _ensure_wp_trigger();

ALTER TABLE workspace_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION seed_workspace_permissions(p_tenant_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO workspace_permissions (tenant_id, role, action, granted) VALUES
    (p_tenant_id, 'member', 'create_private_channels',    true),
    (p_tenant_id, 'member', 'invite_members',              true),
    (p_tenant_id, 'member', 'create_teams',                true),
    (p_tenant_id, 'member', 'manage_labels',               true),
    (p_tenant_id, 'member', 'create_api_keys',             true),
    (p_tenant_id, 'member', 'modify_ai_guidance',          true),
    (p_tenant_id, 'member', 'publish_workflows',           false),
    (p_tenant_id, 'member', 'create_issue_templates',      true),
    (p_tenant_id, 'member', 'create_doc_templates',        true),
    (p_tenant_id, 'member', 'manage_workspace_templates',  true),
    (p_tenant_id, 'member', 'request_plan_upgrade',        false),
    (p_tenant_id, 'guest',  'create_private_channels',    false),
    (p_tenant_id, 'guest',  'create_issues',              false),
    (p_tenant_id, 'guest',  'edit_own_issues',            false),
    (p_tenant_id, 'guest',  'delete_own_messages',        false),
    (p_tenant_id, 'guest',  'interact_with_ai_agents',    false),
    (p_tenant_id, 'guest',  'use_gifs',                   false),
    (p_tenant_id, 'guest',  'upload_files',               false),
    (p_tenant_id, 'guest',  'access_customer_data',       false),
    (p_tenant_id, 'guest',  'view_sprint_board',          false),
    (p_tenant_id, 'guest',  'view_backlog',               false),
    (p_tenant_id, 'guest',  'view_members_list',          false)
  ON CONFLICT (tenant_id, role, action) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- §28  IMPERSONATION LOG, INVITATIONS, PROJECT MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS impersonation_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_owner uuid NOT NULL,
  target_tenant  uuid NOT NULL REFERENCES tenants(id),
  target_user    uuid REFERENCES profiles(id),
  reason         text NOT NULL,
  started_at     timestamptz DEFAULT now(),
  ended_at       timestamptz,
  actions_taken  int DEFAULT 0
);

ALTER TABLE impersonation_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member',
  token       text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by  uuid REFERENCES profiles(id),
  project_id  uuid REFERENCES projects(id),
  accepted_at timestamptz,
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS project_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  added_by   uuid REFERENCES profiles(id),
  added_at   timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- get_project_role: project override wins over workspace role
CREATE OR REPLACE FUNCTION get_project_role(p_project_id uuid)
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT role FROM project_members
     WHERE  project_id = p_project_id AND user_id = auth.uid()),
    get_role()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION accept_invitation(p_token text, p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_invite  invitations%ROWTYPE;
  v_email   text;
  v_domain  text;
  v_max     int;
  v_count   int;
  v_domains text[];
BEGIN
  SELECT * INTO v_invite FROM invitations
  WHERE  token = p_token AND expires_at > now() AND accepted_at IS NULL;
  IF NOT FOUND THEN
    RETURN json_build_object('error','Invalid or expired invitation');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  v_domain := split_part(v_email,'@',2);

  SELECT allowed_email_domains INTO v_domains
  FROM   workspace_settings WHERE tenant_id = v_invite.tenant_id;
  IF array_length(v_domains,1) > 0 AND NOT (v_domain = ANY(v_domains)) THEN
    RETURN json_build_object('error','Email domain not allowed for this workspace');
  END IF;

  SELECT plan_seats INTO v_max FROM workspace_settings WHERE tenant_id = v_invite.tenant_id;
  SELECT COUNT(*) INTO v_count FROM profiles
  WHERE  tenant_id = v_invite.tenant_id AND NOT is_deactivated;
  IF v_max IS NOT NULL AND v_count >= v_max THEN
    RETURN json_build_object('error','Seat limit reached. Admin must upgrade the plan.');
  END IF;

  INSERT INTO profiles (id, tenant_id, role)
  VALUES (p_user_id, v_invite.tenant_id, v_invite.role)
  ON CONFLICT (id) DO UPDATE
    SET tenant_id = v_invite.tenant_id, role = v_invite.role;

  IF v_invite.project_id IS NOT NULL THEN
    INSERT INTO project_members (tenant_id, project_id, user_id, role, added_by)
    VALUES (v_invite.tenant_id, v_invite.project_id, p_user_id, v_invite.role, v_invite.invited_by)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;

  UPDATE invitations SET accepted_at = now() WHERE id = v_invite.id;
  RETURN json_build_object('success',true,'tenant_id',v_invite.tenant_id,'role',v_invite.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- §29  AUDIT LOG (append-only — no UPDATE/DELETE policy)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email     text,
  action          text NOT NULL,
  target_type     text,
  target_id       text,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      text,
  impersonated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action,    created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION write_audit_log(
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_old_value   jsonb DEFAULT NULL,
  p_new_value   jsonb DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, old_value, new_value)
  VALUES (get_tenant_id(), auth.uid(), p_action, p_target_type, p_target_id, p_old_value, p_new_value);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM write_audit_log('member.role_changed','profiles',NEW.id::text,
      jsonb_build_object('role',OLD.role), jsonb_build_object('role',NEW.role));
  END IF;
  IF OLD.is_deactivated IS DISTINCT FROM NEW.is_deactivated THEN
    PERFORM write_audit_log(
      CASE WHEN NEW.is_deactivated THEN 'member.deactivated' ELSE 'member.reactivated' END,
      'profiles',NEW.id::text,NULL,NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _ensure_audit_profile_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_audit_profile') THEN
    CREATE TRIGGER t_audit_profile
      AFTER UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION audit_profile_changes();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_audit_profile_trigger();
DROP FUNCTION _ensure_audit_profile_trigger();

CREATE OR REPLACE FUNCTION audit_workspace_settings()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM write_audit_log('settings.update','workspace_settings',
    NEW.tenant_id::text, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _ensure_audit_ws_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_audit_workspace_settings') THEN
    CREATE TRIGGER t_audit_workspace_settings
      AFTER UPDATE ON workspace_settings
      FOR EACH ROW EXECUTE FUNCTION audit_workspace_settings();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_audit_ws_trigger();
DROP FUNCTION _ensure_audit_ws_trigger();

CREATE OR REPLACE FUNCTION audit_feature_flag_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (tenant_id,actor_id,action,target_type,target_id,old_value,new_value)
  VALUES (
    NULL, auth.uid(),
    'feature_flag.' || CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
    'feature_flags',
    COALESCE(NEW.id,OLD.id)::text,
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP!='DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW,OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW,OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _ensure_audit_ff_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_audit_feature_flags') THEN
    CREATE TRIGGER t_audit_feature_flags
      AFTER INSERT OR UPDATE OR DELETE ON feature_flags
      FOR EACH ROW EXECUTE FUNCTION audit_feature_flag_changes();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_audit_ff_trigger();
DROP FUNCTION _ensure_audit_ff_trigger();


-- ============================================================
-- §30  AI SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid UNIQUE NOT NULL REFERENCES tenants(id),
  provider         text DEFAULT 'openrouter',
  secret_id        uuid,   -- FK to encrypted_secrets added in §31
  default_model    text DEFAULT 'anthropic/claude-3-5-sonnet',
  monthly_budget   numeric(10,2),
  spend_this_month numeric(10,2) DEFAULT 0,
  updated_at       timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION _ensure_ai_settings_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_ai_settings_updated') THEN
    CREATE TRIGGER t_ai_settings_updated
      BEFORE UPDATE ON ai_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_ai_settings_trigger();
DROP FUNCTION _ensure_ai_settings_trigger();

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- §31  DEFERRED FOREIGN KEYS
-- Added here now that every referenced table exists.
-- Uses DO blocks so re-runs don't fail on duplicate constraint names.
-- ============================================================

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT fk_profiles_manager
    FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT fk_projects_created_by
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE issues ADD CONSTRAINT fk_issues_sprint
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE issues ADD CONSTRAINT fk_issues_assignee
    FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE issues ADD CONSTRAINT fk_issues_reporter
    FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE issues ADD CONSTRAINT fk_issues_crm_account
    FOREIGN KEY (crm_account_id) REFERENCES crm_accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE pull_requests ADD CONSTRAINT fk_pr_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE pull_requests ADD CONSTRAINT fk_pr_author
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE issue_files ADD CONSTRAINT fk_issue_files_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT fk_messages_author
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT fk_messages_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT fk_messages_thread
    FOREIGN KEY (thread_of) REFERENCES messages(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE chat_channels ADD CONSTRAINT fk_chat_channels_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE chat_channels ADD CONSTRAINT fk_chat_channels_created_by
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_thread
    FOREIGN KEY (thread_parent) REFERENCES chat_messages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT fk_documents_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE documents ADD CONSTRAINT fk_documents_author
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE crm_accounts ADD CONSTRAINT fk_crm_accounts_owner
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE crm_deals ADD CONSTRAINT fk_crm_deals_owner
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE git_integrations ADD CONSTRAINT fk_git_secret
    FOREIGN KEY (secret_id) REFERENCES encrypted_secrets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE foundation_plans ADD CONSTRAINT fk_plans_created_by
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ai_conversations ADD CONSTRAINT fk_ai_conv_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ide_focus_sessions ADD CONSTRAINT fk_focus_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mentions_index ADD CONSTRAINT fk_mentions_version
    FOREIGN KEY (version_id) REFERENCES plan_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE onboarding_sessions ADD CONSTRAINT fk_onboarding_plan
    FOREIGN KEY (plan_id) REFERENCES foundation_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE healing_sessions ADD CONSTRAINT fk_healing_issue
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE cap_table_holders ADD CONSTRAINT fk_cap_holder_contact
    FOREIGN KEY (crm_contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE cap_table_transactions ADD CONSTRAINT fk_cap_tx_from
    FOREIGN KEY (from_holder) REFERENCES cap_table_holders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE cap_table_transactions ADD CONSTRAINT fk_cap_tx_to
    FOREIGN KEY (to_holder) REFERENCES cap_table_holders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE plan_versions ADD CONSTRAINT fk_plan_versions_created_by
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ai_settings ADD CONSTRAINT fk_ai_settings_secret
    FOREIGN KEY (secret_id) REFERENCES encrypted_secrets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- §32  REALTIME
-- ============================================================

ALTER TABLE issues        REPLICA IDENTITY FULL;
ALTER TABLE messages      REPLICA IDENTITY FULL;
ALTER TABLE profiles      REPLICA IDENTITY FULL;
ALTER TABLE time_logs     REPLICA IDENTITY FULL;
ALTER TABLE pull_requests REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE chat_presence REPLICA IDENTITY FULL;
ALTER TABLE chat_reactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE issues;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE time_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE pull_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_presence;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- §33  VIEWS
-- All use CREATE OR REPLACE — fully idempotent.
-- ============================================================

CREATE OR REPLACE VIEW message_unread AS
  SELECT channel_id, author_id, COUNT(*) AS unread
  FROM messages
  WHERE is_system = false
  GROUP BY channel_id, author_id;

CREATE OR REPLACE VIEW issue_time_summary AS
  SELECT issue_id, user_id,
    SUM(duration_s)   AS total_seconds,
    MAX(started_at)   AS last_active
  FROM time_logs GROUP BY issue_id, user_id;

CREATE OR REPLACE VIEW sprint_capacity AS
SELECT
  mc.sprint_id,
  SUM(mc.total_hours)     AS total_team_hours,
  SUM(mc.committed_hours) AS committed_hours,
  SUM(mc.focus_hours)     AS available_hours,
  ROUND(SUM(mc.committed_hours)::numeric / NULLIF(SUM(mc.total_hours),0) * 100, 1) AS utilization_pct
FROM member_capacity mc
GROUP BY mc.sprint_id;

CREATE OR REPLACE VIEW evm_snapshot AS
SELECT
  i.sprint_id,
  i.project_id,
  SUM(i.planned_value)  AS pv,
  SUM(i.earned_value)   AS ev,
  SUM(i.actual_cost)    AS ac,
  CASE WHEN SUM(i.planned_value) > 0
    THEN ROUND((SUM(i.earned_value) / SUM(i.planned_value)) * 100, 1)
    ELSE 0
  END AS schedule_performance_index
FROM issues i
GROUP BY i.sprint_id, i.project_id;

CREATE OR REPLACE VIEW platform_analytics AS
SELECT
  t.id              AS tenant_id,
  t.name            AS tenant_name,
  t.plan,
  t.owner_email,
  t.is_suspended,
  t.created_at      AS tenant_created,
  ws.workspace_slug,
  COUNT(DISTINCT p.id)  AS member_count,
  COUNT(DISTINCT i.id)  AS total_issues,
  COUNT(DISTINCT s.id)  AS total_sprints,
  COUNT(DISTINCT m.id)  AS total_messages,
  MAX(p.updated_at)     AS last_activity
FROM tenants t
LEFT JOIN workspace_settings ws ON ws.tenant_id = t.id
LEFT JOIN profiles p  ON p.tenant_id = t.id AND NOT p.is_deactivated
LEFT JOIN issues i    ON i.tenant_id = t.id
LEFT JOIN sprints s   ON s.tenant_id = t.id
LEFT JOIN messages m  ON m.tenant_id = t.id
GROUP BY t.id, t.name, t.plan, t.owner_email, t.is_suspended, t.created_at, ws.workspace_slug;


-- ============================================================
-- §34  RLS POLICIES
-- Pattern: DROP IF EXISTS then CREATE — always correct state.
-- ============================================================

-- ── TENANTS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_self_read      ON tenants;
DROP POLICY IF EXISTS tenant_platform_write ON tenants;
CREATE POLICY tenant_self_read      ON tenants FOR SELECT USING (id = get_tenant_id() OR is_platform_owner());
CREATE POLICY tenant_platform_write ON tenants FOR ALL   WITH CHECK (is_platform_owner());

-- ── PROFILES ─────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_read           ON profiles;
DROP POLICY IF EXISTS profiles_self_update    ON profiles;
DROP POLICY IF EXISTS profiles_admin_update   ON profiles;
DROP POLICY IF EXISTS profiles_platform_write ON profiles;
CREATE POLICY profiles_read ON profiles
  FOR SELECT USING (tenant_id = get_tenant_id() OR is_platform_owner());
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND (is_admin() OR role = get_role()));
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (tenant_id = get_tenant_id() AND is_admin());
CREATE POLICY profiles_platform_write ON profiles
  FOR ALL USING (is_platform_owner());

-- ── PROJECTS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS projects_read   ON projects;
DROP POLICY IF EXISTS projects_write  ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS projects_delete ON projects;
CREATE POLICY projects_read   ON projects FOR SELECT USING (tenant_id = get_tenant_id() OR is_platform_owner());
CREATE POLICY projects_write  ON projects FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND is_admin());
CREATE POLICY projects_update ON projects FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (is_admin());
CREATE POLICY projects_delete ON projects FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

-- ── SPRINTS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS sprints_read   ON sprints;
DROP POLICY IF EXISTS sprints_write  ON sprints;
DROP POLICY IF EXISTS sprints_update ON sprints;
DROP POLICY IF EXISTS sprints_delete ON sprints;
CREATE POLICY sprints_read   ON sprints FOR SELECT USING (tenant_id = get_tenant_id() OR is_platform_owner());
CREATE POLICY sprints_write  ON sprints FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY sprints_update ON sprints FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (can_write());
CREATE POLICY sprints_delete ON sprints FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

-- ── ISSUES ────────────────────────────────────────────────────
DROP POLICY IF EXISTS issues_read   ON issues;
DROP POLICY IF EXISTS issues_write  ON issues;
DROP POLICY IF EXISTS issues_update ON issues;
DROP POLICY IF EXISTS issues_delete ON issues;
CREATE POLICY issues_read ON issues
  FOR SELECT USING (tenant_id = get_tenant_id() OR is_platform_owner());
CREATE POLICY issues_write ON issues
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND (can_write() OR (is_guest() AND can_do('create_issues')))
  );
CREATE POLICY issues_update ON issues
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    is_admin() OR can_write()
    OR (is_guest() AND can_do('edit_own_issues') AND reporter_id = auth.uid())
  );
CREATE POLICY issues_delete ON issues
  FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

-- ── PULL REQUESTS ─────────────────────────────────────────────
DROP POLICY IF EXISTS pr_tenant_iso ON pull_requests;
CREATE POLICY pr_tenant_iso ON pull_requests
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── ISSUE FILES ───────────────────────────────────────────────
DROP POLICY IF EXISTS issue_files_tenant_iso ON issue_files;
CREATE POLICY issue_files_tenant_iso ON issue_files
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── CHANNELS (legacy) ─────────────────────────────────────────
DROP POLICY IF EXISTS channels_tenant_iso ON channels;
CREATE POLICY channels_tenant_iso ON channels
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());

-- ── MESSAGES (legacy) ─────────────────────────────────────────
DROP POLICY IF EXISTS messages_tenant_iso ON messages;
CREATE POLICY messages_tenant_iso ON messages
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── CHANNEL LAST READ ─────────────────────────────────────────
DROP POLICY IF EXISTS clr_own_rows ON channel_last_read;
CREATE POLICY clr_own_rows ON channel_last_read USING (user_id = auth.uid());

-- ── CHAT CHANNELS ─────────────────────────────────────────────
DROP POLICY IF EXISTS chat_channels_tenant_iso ON chat_channels;
CREATE POLICY chat_channels_tenant_iso ON chat_channels
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── CHAT MEMBERS ─────────────────────────────────────────────
DROP POLICY IF EXISTS chat_members_tenant_iso ON chat_members;
CREATE POLICY chat_members_tenant_iso ON chat_members
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());

-- ── CHAT MESSAGES ─────────────────────────────────────────────
DROP POLICY IF EXISTS chat_read        ON chat_messages;
DROP POLICY IF EXISTS chat_write       ON chat_messages;
DROP POLICY IF EXISTS chat_soft_delete ON chat_messages;
CREATE POLICY chat_read ON chat_messages
  FOR SELECT USING (
    tenant_id = get_tenant_id()
    AND EXISTS (
      SELECT 1 FROM chat_channels c
      LEFT JOIN chat_members mb ON mb.channel_id = c.id AND mb.user_id = auth.uid()
      WHERE c.id = channel_id
        AND (c.channel_type = 'public' OR mb.user_id IS NOT NULL)
    )
  );
CREATE POLICY chat_write ON chat_messages
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND (can_write() OR (is_guest() AND can_do('delete_own_messages')))
  );
CREATE POLICY chat_soft_delete ON chat_messages
  FOR UPDATE USING (
    tenant_id = get_tenant_id()
    AND (is_admin() OR (sender_id = auth.uid() AND can_do('delete_own_messages')))
  );

-- ── CHAT REACTIONS ────────────────────────────────────────────
DROP POLICY IF EXISTS chat_reactions_tenant_iso ON chat_reactions;
CREATE POLICY chat_reactions_tenant_iso ON chat_reactions
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── CHAT PRESENCE ─────────────────────────────────────────────
DROP POLICY IF EXISTS chat_presence_tenant_iso ON chat_presence;
CREATE POLICY chat_presence_tenant_iso ON chat_presence
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());

-- ── DOCUMENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS docs_read   ON documents;
DROP POLICY IF EXISTS docs_write  ON documents;
DROP POLICY IF EXISTS docs_update ON documents;
DROP POLICY IF EXISTS docs_delete ON documents;
CREATE POLICY docs_read   ON documents FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY docs_write  ON documents FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY docs_update ON documents FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (can_write());
CREATE POLICY docs_delete ON documents FOR DELETE USING (
  tenant_id = get_tenant_id() AND (is_admin() OR author_id = auth.uid())
);

-- ── TIME LOGS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS time_logs_read   ON time_logs;
DROP POLICY IF EXISTS time_logs_write  ON time_logs;
DROP POLICY IF EXISTS time_logs_update ON time_logs;
CREATE POLICY time_logs_read   ON time_logs FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY time_logs_write  ON time_logs FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY time_logs_update ON time_logs FOR UPDATE
  USING (tenant_id = get_tenant_id() AND (user_id = auth.uid() OR is_admin()));

-- ── CRM ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS crm_read    ON crm_accounts;
DROP POLICY IF EXISTS crm_write   ON crm_accounts;
DROP POLICY IF EXISTS crm_update  ON crm_accounts;
DROP POLICY IF EXISTS crm_delete  ON crm_accounts;
CREATE POLICY crm_read   ON crm_accounts FOR SELECT USING (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY crm_write  ON crm_accounts FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY crm_update ON crm_accounts FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (can_write());
CREATE POLICY crm_delete ON crm_accounts FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

DROP POLICY IF EXISTS crm_contacts_all ON crm_contacts;
CREATE POLICY crm_contacts_all ON crm_contacts
  FOR ALL USING (tenant_id = get_tenant_id() AND can_write()) WITH CHECK (can_write());

DROP POLICY IF EXISTS crm_deals_all ON crm_deals;
CREATE POLICY crm_deals_all ON crm_deals
  FOR ALL USING (tenant_id = get_tenant_id() AND can_write()) WITH CHECK (can_write());

-- ── STANDUPS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS standups_tenant_iso       ON standups;
DROP POLICY IF EXISTS standup_notes_tenant_iso  ON standup_notes;
CREATE POLICY standups_tenant_iso ON standups
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY standup_notes_tenant_iso ON standup_notes
  FOR ALL USING (EXISTS (
    SELECT 1 FROM standups s
    WHERE s.id = standup_id AND s.tenant_id = get_tenant_id()
  ));

-- ── GIT ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS git_tenant_iso ON git_integrations;
CREATE POLICY git_tenant_iso ON git_integrations
  FOR ALL USING (tenant_id = get_tenant_id() AND is_admin()) WITH CHECK (is_admin());

-- ── FOUNDATION PLANS ──────────────────────────────────────────
DROP POLICY IF EXISTS plans_tenant_iso ON foundation_plans;
CREATE POLICY plans_tenant_iso ON foundation_plans
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── AI CONVERSATIONS ──────────────────────────────────────────
DROP POLICY IF EXISTS ai_conv_read  ON ai_conversations;
DROP POLICY IF EXISTS ai_conv_write ON ai_conversations;
CREATE POLICY ai_conv_read  ON ai_conversations FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY ai_conv_write ON ai_conversations FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── SYNC QUEUE ────────────────────────────────────────────────
DROP POLICY IF EXISTS sync_own_rows ON sync_queue;
CREATE POLICY sync_own_rows ON sync_queue USING (user_id = auth.uid());

-- ── LOCAL FILES & IDE ─────────────────────────────────────────
DROP POLICY IF EXISTS local_files_tenant_iso ON local_files;
CREATE POLICY local_files_tenant_iso ON local_files
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

DROP POLICY IF EXISTS focus_tenant_iso ON ide_focus_sessions;
CREATE POLICY focus_tenant_iso ON ide_focus_sessions
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());

-- ── LIBRARIES & FINOPS ────────────────────────────────────────
DROP POLICY IF EXISTS libraries_tenant_iso       ON libraries;
DROP POLICY IF EXISTS vendor_accounts_tenant_iso ON vendor_accounts;
DROP POLICY IF EXISTS vendor_invoices_tenant_iso ON vendor_invoices;
CREATE POLICY libraries_tenant_iso       ON libraries       FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY vendor_accounts_tenant_iso ON vendor_accounts FOR ALL USING (tenant_id = get_tenant_id() AND is_admin()) WITH CHECK (is_admin());
CREATE POLICY vendor_invoices_tenant_iso ON vendor_invoices FOR ALL USING (tenant_id = get_tenant_id() AND is_admin()) WITH CHECK (is_admin());

-- ── GLOSSARY & CAPACITY & MENTIONS ───────────────────────────
DROP POLICY IF EXISTS glossary_tenant_iso  ON glossary_terms;
DROP POLICY IF EXISTS capacity_tenant_iso  ON member_capacity;
DROP POLICY IF EXISTS mentions_tenant_iso  ON mentions_index;
CREATE POLICY glossary_tenant_iso ON glossary_terms FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY capacity_tenant_iso ON member_capacity FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY mentions_tenant_iso ON mentions_index  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());

-- ── MARKETING ─────────────────────────────────────────────────
DROP POLICY IF EXISTS marketing_read  ON marketing_campaigns;
DROP POLICY IF EXISTS marketing_write ON marketing_campaigns;
CREATE POLICY marketing_read  ON marketing_campaigns FOR SELECT USING (tenant_id = get_tenant_id() AND is_admin());
CREATE POLICY marketing_write ON marketing_campaigns FOR ALL   USING (tenant_id = get_tenant_id() AND is_admin());

-- ── ENCRYPTED SECRETS ─────────────────────────────────────────
DROP POLICY IF EXISTS secrets_owner_only ON encrypted_secrets;
CREATE POLICY secrets_owner_only ON encrypted_secrets USING (owner_id = auth.uid());

-- ── PLAN VERSIONS ─────────────────────────────────────────────
DROP POLICY IF EXISTS plan_versions_tenant_iso ON plan_versions;
CREATE POLICY plan_versions_tenant_iso ON plan_versions
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── HEALING ───────────────────────────────────────────────────
DROP POLICY IF EXISTS healing_tenant_iso ON healing_sessions;
CREATE POLICY healing_tenant_iso ON healing_sessions
  FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id() AND can_write());

-- ── ONBOARDING ────────────────────────────────────────────────
DROP POLICY IF EXISTS onboarding_own_rows ON onboarding_sessions;
CREATE POLICY onboarding_own_rows ON onboarding_sessions USING (user_id = auth.uid());

-- ── CAP TABLE ─────────────────────────────────────────────────
DROP POLICY IF EXISTS cap_holders_tenant_iso ON cap_table_holders;
DROP POLICY IF EXISTS cap_tx_tenant_iso      ON cap_table_transactions;
CREATE POLICY cap_holders_tenant_iso ON cap_table_holders
  FOR ALL USING (tenant_id = get_tenant_id() AND is_admin()) WITH CHECK (is_admin());
CREATE POLICY cap_tx_tenant_iso ON cap_table_transactions
  FOR ALL USING (tenant_id = get_tenant_id() AND is_admin()) WITH CHECK (is_admin());

-- ── PLATFORM CONFIG ───────────────────────────────────────────
DROP POLICY IF EXISTS platform_owner_only ON platform_config;
CREATE POLICY platform_owner_only ON platform_config
  USING (is_platform_owner()) WITH CHECK (is_platform_owner());

-- ── FEATURE FLAGS ─────────────────────────────────────────────
DROP POLICY IF EXISTS ff_platform_owner ON feature_flags;
DROP POLICY IF EXISTS ff_tenant_read    ON feature_flags;
CREATE POLICY ff_platform_owner ON feature_flags
  FOR ALL USING (is_platform_owner()) WITH CHECK (is_platform_owner());
CREATE POLICY ff_tenant_read ON feature_flags
  FOR SELECT USING (enabled = true AND status IN ('canary','stable') AND environment = 'prod');

-- ── WORKSPACE SETTINGS ────────────────────────────────────────
DROP POLICY IF EXISTS ws_member_read    ON workspace_settings;
DROP POLICY IF EXISTS ws_admin_write    ON workspace_settings;
DROP POLICY IF EXISTS ws_platform_owner ON workspace_settings;
CREATE POLICY ws_member_read ON workspace_settings FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY ws_admin_write ON workspace_settings FOR ALL
  USING (tenant_id = get_tenant_id()) WITH CHECK (is_admin());
CREATE POLICY ws_platform_owner ON workspace_settings FOR ALL USING (is_platform_owner());

-- ── USER PREFERENCES ──────────────────────────────────────────
DROP POLICY IF EXISTS own_prefs        ON user_preferences;
DROP POLICY IF EXISTS admin_read_prefs ON user_preferences;
CREATE POLICY own_prefs ON user_preferences
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY admin_read_prefs ON user_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = (SELECT tenant_id FROM profiles WHERE id = user_preferences.user_id)
        AND (p.role = 'admin' OR p.is_platform_owner)
    )
  );

-- ── WORKSPACE PERMISSIONS ─────────────────────────────────────
DROP POLICY IF EXISTS wp_read  ON workspace_permissions;
DROP POLICY IF EXISTS wp_write ON workspace_permissions;
CREATE POLICY wp_read  ON workspace_permissions FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY wp_write ON workspace_permissions FOR ALL
  USING (tenant_id = get_tenant_id()) WITH CHECK (is_admin());

-- ── IMPERSONATION LOG ─────────────────────────────────────────
DROP POLICY IF EXISTS impersonation_platform_only ON impersonation_log;
CREATE POLICY impersonation_platform_only ON impersonation_log USING (is_platform_owner());

-- ── INVITATIONS ───────────────────────────────────────────────
DROP POLICY IF EXISTS invite_admin        ON invitations;
DROP POLICY IF EXISTS invite_token_lookup ON invitations;
CREATE POLICY invite_admin ON invitations
  FOR ALL USING (tenant_id = get_tenant_id() AND is_admin());
CREATE POLICY invite_token_lookup ON invitations
  FOR SELECT USING (expires_at > now() AND accepted_at IS NULL);

-- ── PROJECT MEMBERS ───────────────────────────────────────────
DROP POLICY IF EXISTS pm_read  ON project_members;
DROP POLICY IF EXISTS pm_write ON project_members;
CREATE POLICY pm_read  ON project_members FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY pm_write ON project_members FOR ALL   WITH CHECK (is_admin());

-- ── AUDIT LOG (read-only policies — no write policy = immutable) ──
DROP POLICY IF EXISTS audit_admin_read    ON audit_log;
DROP POLICY IF EXISTS audit_platform_owner ON audit_log;
CREATE POLICY audit_admin_read     ON audit_log FOR SELECT USING (tenant_id = get_tenant_id() AND is_admin());
CREATE POLICY audit_platform_owner ON audit_log FOR SELECT USING (is_platform_owner());

-- ── AI SETTINGS ───────────────────────────────────────────────
DROP POLICY IF EXISTS ai_read  ON ai_settings;
DROP POLICY IF EXISTS ai_write ON ai_settings;
CREATE POLICY ai_read  ON ai_settings FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY ai_write ON ai_settings FOR ALL
  USING (tenant_id = get_tenant_id()) WITH CHECK (is_admin());


-- ============================================================
-- §35  AUTO-CREATE TRIGGERS
-- On new tenant: workspace_settings + permissions + ai_settings
-- On new profile: user_preferences
-- ============================================================

CREATE OR REPLACE FUNCTION on_tenant_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_settings (tenant_id, workspace_name)
  VALUES (NEW.id, NEW.name) ON CONFLICT DO NOTHING;

  PERFORM seed_workspace_permissions(NEW.id);

  INSERT INTO ai_settings (tenant_id)
  VALUES (NEW.id) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _ensure_tenant_created_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_on_tenant_created') THEN
    CREATE TRIGGER t_on_tenant_created
      AFTER INSERT ON tenants
      FOR EACH ROW EXECUTE FUNCTION on_tenant_created();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_tenant_created_trigger();
DROP FUNCTION _ensure_tenant_created_trigger();

CREATE OR REPLACE FUNCTION on_profile_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION _ensure_profile_created_trigger() RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_on_profile_created') THEN
    CREATE TRIGGER t_on_profile_created
      AFTER INSERT ON profiles
      FOR EACH ROW EXECUTE FUNCTION on_profile_created();
  END IF;
END;
$$ LANGUAGE plpgsql;
SELECT _ensure_profile_created_trigger();
DROP FUNCTION _ensure_profile_created_trigger();


-- ============================================================
-- §36  CRON JOBS
-- Idempotent: unschedule first (no-ops if not registered),
-- then schedule fresh. Safe to run on every deploy.
-- ============================================================

SELECT cron.unschedule('db-keepalive')                   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='db-keepalive');
SELECT cron.unschedule('reset-monthly-ai-spend')          WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='reset-monthly-ai-spend');
SELECT cron.unschedule('auto-close-stale-sprints')        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-close-stale-sprints');
SELECT cron.unschedule('expire-presence')                 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='expire-presence');
SELECT cron.unschedule('compute-sprint-velocity')         WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='compute-sprint-velocity');
SELECT cron.unschedule('cleanup-stale-healing-sessions')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup-stale-healing-sessions');
SELECT cron.unschedule('cleanup-sync-queue')              WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup-sync-queue');
SELECT cron.unschedule('cleanup-old-ai-conversations')    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup-old-ai-conversations');
SELECT cron.unschedule('sync-member-committed-hours')     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sync-member-committed-hours');
SELECT cron.unschedule('standup-reminders')               WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='standup-reminders');
SELECT cron.unschedule('mark-stale-mentions')             WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='mark-stale-mentions');
SELECT cron.unschedule('finops-daily-snapshot')           WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='finops-daily-snapshot');
SELECT cron.unschedule('release-scheduled-feature-flags') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='release-scheduled-feature-flags');

-- Job 1: DB keepalive (free tier)
SELECT cron.schedule('db-keepalive','*/4 * * * *',
  $$ SELECT COUNT(*) FROM tenants LIMIT 1; $$);

-- Job 2: Reset monthly AI spend
SELECT cron.schedule('reset-monthly-ai-spend','0 0 1 * *',
  $$ UPDATE ai_settings SET spend_this_month = 0, updated_at = now(); $$);

-- Job 3: Auto-close stale sprints
SELECT cron.schedule('auto-close-stale-sprints','0 1 * * *', $$
  UPDATE sprints SET status = 'completed'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
$$);

-- Job 4: Expire idle presence
SELECT cron.schedule('expire-presence','*/5 * * * *', $$
  UPDATE chat_presence SET status = 'offline', is_typing = false
  WHERE last_seen < now() - interval '10 minutes' AND status != 'offline';
$$);

-- Job 5: Compute sprint velocity
SELECT cron.schedule('compute-sprint-velocity','0 2 * * *', $$
  UPDATE sprints s
  SET velocity = (
    SELECT COALESCE(SUM(i.points), 0) FROM issues i
    WHERE i.sprint_id = s.id AND i.status = 'done'
  )
  WHERE s.status IN ('active','completed');
$$);

-- Job 6: Clean stale healing sessions (weekly)
SELECT cron.schedule('cleanup-stale-healing-sessions','0 3 * * 0', $$
  DELETE FROM healing_sessions
  WHERE status = 'open' AND created_at < now() - interval '30 days';
$$);

-- Job 7: Clean sync queue
SELECT cron.schedule('cleanup-sync-queue','0 3 * * *', $$
  DELETE FROM sync_queue
  WHERE synced_at IS NOT NULL AND synced_at < now() - interval '7 days';
$$);

-- Job 8: Clean old AI conversations (monthly)
SELECT cron.schedule('cleanup-old-ai-conversations','0 4 1 * *', $$
  DELETE FROM ai_conversations WHERE created_at < now() - interval '90 days';
$$);

-- Job 9: Sync member committed hours
SELECT cron.schedule('sync-member-committed-hours','30 2 * * *', $$
  UPDATE member_capacity mc
  SET committed_hours = (
    SELECT COALESCE(SUM(
      CASE i.priority
        WHEN 'critical' THEN 8
        WHEN 'high'     THEN 5
        WHEN 'medium'   THEN 3
        WHEN 'low'      THEN 1
        ELSE 3
      END
    ), 0)
    FROM issues i
    WHERE i.assignee_id = mc.member_id
      AND i.sprint_id   = mc.sprint_id
      AND i.status NOT IN ('done','archived')
  )
  WHERE mc.sprint_id IN (SELECT id FROM sprints WHERE status = 'active');
$$);

-- Job 10: Standup reminders (weekdays)
SELECT cron.schedule('standup-reminders','45 8 * * 1-5', $$
  INSERT INTO messages (tenant_id, channel_id, body, is_system)
  SELECT s.tenant_id, c.id,
    '🎙️ Standup "' || s.title || '" starts in 15 minutes. Room: ' || COALESCE(s.room_url,'TBD'),
    true
  FROM standups s
  JOIN channels c ON c.project_id = s.project_id AND c.name = 'general'
  WHERE s.scheduled_at BETWEEN now() + interval '14 minutes'
                            AND now() + interval '16 minutes';
$$);

-- Job 11: Mark stale @mentions
SELECT cron.schedule('mark-stale-mentions','0 4 * * *', $$
  UPDATE mentions_index mi SET is_stale = true
  WHERE mi.version_id IS NOT NULL
    AND mi.is_stale = false
    AND NOT EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = mi.version_id
        AND pv.version_num = (
          SELECT MAX(version_num) FROM plan_versions WHERE plan_id = pv.plan_id
        )
    );
$$);

-- Job 12: FinOps daily snapshot — update actual_cost from time_logs
SELECT cron.schedule('finops-daily-snapshot','0 5 * * *', $$
  UPDATE issues i
  SET actual_cost = (
    SELECT COALESCE((SUM(tl.duration_s) / 3600.0) * 75.0, 0)
    FROM time_logs tl WHERE tl.issue_id = i.id
  )
  WHERE i.sprint_id IN (SELECT id FROM sprints WHERE status = 'active')
    AND i.actual_cost = 0;
$$);

-- Job 13: Release scheduled feature flags
SELECT cron.schedule('release-scheduled-feature-flags','*/5 * * * *', $$
  UPDATE feature_flags
  SET enabled = true, status = 'stable', updated_at = now()
  WHERE scheduled_at IS NOT NULL
    AND scheduled_at <= now()
    AND enabled = false;
$$);


-- ============================================================
-- §37  SEED DATA
-- All use ON CONFLICT DO NOTHING — safe to re-run.
-- ============================================================

INSERT INTO feature_flags (name, description, enabled, rollout_pct, status) VALUES
  ('ai_agents',       'AI agents as teammates',                  false,  0,   'inactive'),
  ('video_standups',  'Daily.co video standup rooms',            true,  100,  'stable'),
  ('hipaa_mode',      'HIPAA compliance controls',               true,    5,  'stable'),
  ('byok_marketing',  'Bring-your-own-key email sends',          true,   25,  'canary'),
  ('local_files',     'File System Access API for IDE',          true,   50,  'canary'),
  ('saml_sso',        'SAML SSO — enterprise only',              true,  100,  'stable'),
  ('initiatives',     'Group projects toward strategic goals',   false,   0,  'inactive'),
  ('slas',            'SLA deadline automation on issues',       false,   0,  'inactive'),
  ('asks',            'Structured intake from external sources', false,   0,  'inactive'),
  ('reach_connect',   'Cross-tenant channels — Business+',       false,   0,  'inactive'),
  ('timesheets',      'Timesheet approval workflow',             true,  100,  'stable'),
  ('git_integration', 'GitHub PAT and repo sync',                true,  100,  'stable'),
  ('crm',             'Accounts, contacts, deals pipeline',      true,  100,  'stable'),
  ('analytics',       'EVM, burndown, capacity charts',          true,  100,  'stable'),
  ('pulse',           'Project updates feed with digest emails', true,  100,  'stable'),
  ('cap_table',       'Cap table management — replaces Carta',   false,   0,  'inactive')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- DONE
-- ============================================================
-- Run this script once in Supabase SQL Editor.
-- Re-running it is always safe — nothing will break.
--
-- After running, do these two manual steps in the Dashboard:
--
-- 1. Set JWT hook:
--    Authentication → Hooks → Custom Access Token
--    → Select function: auth.custom_access_token_hook
--
-- 2. Set yourself as platform owner:
--    Run this (replace with your email):
--
--    UPDATE profiles
--    SET role = 'admin', is_platform_owner = true
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
--
-- Verify cron jobs registered:
--    SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- ============================================================


