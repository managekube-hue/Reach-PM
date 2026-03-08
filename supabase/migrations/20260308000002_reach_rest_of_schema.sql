-- ============================================================
-- SECTION 2: PROJECTS
-- ============================================================

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  key         text NOT NULL,        -- e.g. 'RC' -> issues become RC-001
  description text,
  status      text DEFAULT 'active',
  budget      numeric(12,2),
  start_date  date,
  end_date    date,
  pillar      text DEFAULT 'work',  -- work | insights | structure
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TRIGGER t_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_read ON projects FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY projects_write ON projects FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND is_admin());
CREATE POLICY projects_update ON projects FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (is_admin());
CREATE POLICY projects_delete ON projects FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

-- ============================================================
-- SECTION 3: ISSUES
-- ============================================================

CREATE TYPE issue_status   AS ENUM ('todo','in_progress','review','done','archived');
CREATE TYPE issue_priority AS ENUM ('low','medium','high','critical');

CREATE TABLE issues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  project_id    uuid NOT NULL REFERENCES projects(id),
  number        serial,             -- per-project counter RC-001, RC-002...
  title         text NOT NULL,
  description   text,
  status        issue_status  DEFAULT 'todo',
  priority      issue_priority DEFAULT 'medium',
  points        int DEFAULT 0,
  assignee_id   uuid REFERENCES profiles(id),
  reporter_id   uuid REFERENCES profiles(id),
  sprint_id     uuid,               -- FK added later
  plan_step     text,               -- e.g. '3c'
  branch        text,
  pillar        text DEFAULT 'work',
  tags          text[] DEFAULT '{}',
  doc_linked    boolean DEFAULT false,
  chat_count    int DEFAULT 0,
  planned_value numeric(10,2) DEFAULT 0,
  earned_value  numeric(10,2) DEFAULT 0,
  actual_cost   numeric(10,2) DEFAULT 0,
  crm_account_id uuid,              -- FK added later
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_issues_tenant  ON issues(tenant_id);
CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_status  ON issues(status);
CREATE INDEX idx_issues_search  ON issues USING gin(to_tsvector('english', title || ' ' || coalesce(description,'')));

CREATE TRIGGER t_issues_updated BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY issues_read ON issues FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY issues_write ON issues FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY issues_update ON issues FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (can_write());
CREATE POLICY issues_delete ON issues FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

-- ============================================================
-- SECTION 4: SPRINTS
-- ============================================================

CREATE TABLE sprints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  name       text NOT NULL,
  goal       text,
  status     text DEFAULT 'planning',  -- planning | active | completed
  start_date date NOT NULL,
  end_date   date NOT NULL,
  velocity   int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE issues ADD CONSTRAINT fk_issue_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY sprints_read ON sprints FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY sprints_write ON sprints FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY sprints_update ON sprints FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (can_write());
CREATE POLICY sprints_delete ON sprints FOR DELETE USING (tenant_id = get_tenant_id() AND is_admin());

-- ============================================================
-- SECTION 5: PULL REQUESTS & FILES
-- ============================================================

CREATE TABLE pull_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  issue_id    uuid REFERENCES issues(id) ON DELETE SET NULL,
  project_id  uuid REFERENCES projects(id),
  pr_number   text NOT NULL,
  title       text,
  branch      text,
  base_branch text DEFAULT 'main',
  status      text DEFAULT 'open',     
  ci_status   text DEFAULT 'pending',  
  author_id   uuid REFERENCES profiles(id),
  reviewers   uuid[] DEFAULT '{}',
  diff_url    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE issue_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id   uuid REFERENCES issues(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  file_path  text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE issue_files ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 6: CHAT 
-- ============================================================

CREATE TABLE chat_channels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  name         text NOT NULL,
  channel_type text DEFAULT 'public',  -- public | private | dm | ai_thread
  issue_id     uuid REFERENCES issues(id),
  created_by   uuid REFERENCES profiles(id),
  archived     bool DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON chat_channels USING (tenant_id = get_tenant_id());

CREATE TABLE chat_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  channel_id uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  role       text DEFAULT 'member',  -- owner | member
  joined_at  timestamptz DEFAULT now(),
  last_read  timestamptz,
  UNIQUE(channel_id, user_id)
);
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_iso ON chat_members USING (tenant_id = get_tenant_id());

CREATE TABLE chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  channel_id    uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id     uuid NOT NULL REFERENCES profiles(id),
  body          text NOT NULL,
  body_rich     jsonb,
  thread_parent uuid REFERENCES chat_messages(id),
  is_ai_message bool DEFAULT false,
  ai_model      text,
  edited_at     timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_read ON chat_messages FOR SELECT USING (
  tenant_id = get_tenant_id() AND EXISTS (
    SELECT 1 FROM chat_channels c
    LEFT JOIN chat_members m ON m.channel_id = c.id AND m.user_id = auth.uid()
    WHERE c.id = channel_id AND (c.channel_type = 'public' OR m.user_id IS NOT NULL)
  )
);
CREATE POLICY chat_messages_write ON chat_messages FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND can_write());
CREATE POLICY chat_messages_delete ON chat_messages FOR UPDATE USING (tenant_id = get_tenant_id() AND (sender_id = auth.uid() OR is_admin()));

CREATE TABLE chat_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE chat_presence (
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

-- ============================================================
-- AI SETTINGS & RBAC OVERRIDES
-- ============================================================
CREATE TABLE encrypted_secrets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  owner_id    uuid NOT NULL REFERENCES profiles(id),
  secret_type text NOT NULL,   -- 'github_pat' | 'openai' | 'sendgrid' | 'mailgun' | 'ses'
  ciphertext  text NOT NULL,   -- base64(AES-256-GCM encrypted blob)
  iv          text NOT NULL,   -- base64(12-byte random IV)
  salt        text NOT NULL,   -- base64(16-byte PBKDF2 salt)
  key_hint    text,            -- last 4 chars for UI display only
  created_at  timestamptz DEFAULT now(),
  rotated_at  timestamptz
);
ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON encrypted_secrets USING (owner_id = auth.uid());

CREATE TABLE ai_settings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid UNIQUE NOT NULL REFERENCES tenants(id),
  provider          text DEFAULT 'openrouter',
  secret_id         uuid REFERENCES encrypted_secrets(id),
  default_model     text DEFAULT 'anthropic/claude-3-5-sonnet',
  monthly_budget    numeric(10,2),
  spend_this_month  numeric(10,2) DEFAULT 0,
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_settings_read ON ai_settings FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY ai_settings_write ON ai_settings FOR ALL USING (tenant_id = get_tenant_id()) WITH CHECK (is_admin());

-- Auto-create on tenant creation
CREATE OR REPLACE FUNCTION create_default_ai_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ai_settings (tenant_id) VALUES (NEW.id) ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER t_tenant_ai_settings AFTER INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION create_default_ai_settings();

-- ============================================================
-- OFFLINE QUEUE (CRDT)
-- ============================================================
CREATE TABLE sync_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES profiles(id),
  operation   text NOT NULL,     -- 'insert' | 'update' | 'delete'
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  payload     jsonb NOT NULL,
  synced_at   timestamptz,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON sync_queue USING (user_id = auth.uid());

CREATE TABLE local_files (
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

-- ============================================================
-- REALTIME
-- ============================================================
ALTER TABLE issues        REPLICA IDENTITY FULL;
ALTER TABLE profiles      REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE chat_presence REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE issues;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
