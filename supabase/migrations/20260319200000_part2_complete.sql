-- PART 2 COMPLETE DATABASE SCHEMA
-- Prerequisite: issues table must exist.
-- Run entire block as one migration.

SET LOCAL search_path TO extensions, public, auth;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'issues') THEN
    RAISE EXCEPTION 'Prerequisite failed: issues table not found. Run the REACH schema first.';
  END IF;
END $$;

-- ─── 2.6 Notification indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notifications(tenant_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_own ON notifications;
CREATE POLICY notif_own ON notifications
  USING (user_id = auth.uid());

ALTER TABLE notifications REPLICA IDENTITY FULL;

-- ─── 2.7 meetings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  channel_id      uuid REFERENCES channels(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  room_code       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_secs   int,
  status          text DEFAULT 'scheduled',
  host_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recording_path  text,
  recording_url   text,
  external_emails text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_tenant  ON meetings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meetings_channel ON meetings(channel_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status  ON meetings(status);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meetings_tenant ON meetings;
CREATE POLICY meetings_tenant ON meetings
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE meetings REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS meeting_participants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email       text,
  joined_at   timestamptz,
  left_at     timestamptz,
  is_host     boolean DEFAULT false
);

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mp_tenant ON meeting_participants;
CREATE POLICY mp_tenant ON meeting_participants
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE
      tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));

-- ─── 2.8 webrtc_signals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   text NOT NULL,
  from_user   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user     uuid,
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_room ON webrtc_signals(room_code, created_at);

ALTER TABLE webrtc_signals REPLICA IDENTITY FULL;

-- ─── 2.9 integration_tokens ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  access_token    text,
  refresh_token   text,
  token_expiry    timestamptz,
  scopes          text[],
  provider_email  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, provider)
);

DROP TRIGGER IF EXISTS t_it_updated ON integration_tokens;
CREATE TRIGGER t_it_updated BEFORE UPDATE ON integration_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS it_own ON integration_tokens;
CREATE POLICY it_own ON integration_tokens
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 2.7 email_threads  ⚠ NEW (Gap Filled) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS email_threads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issue_id             uuid REFERENCES issues(id) ON DELETE SET NULL,
  channel_id           uuid REFERENCES channels(id) ON DELETE SET NULL,
  provider             text NOT NULL,
  thread_id            text NOT NULL,
  message_id           text,
  subject              text,
  from_name            text,
  from_email           text NOT NULL,
  to_emails            text[] DEFAULT '{}',
  cc_emails            text[] DEFAULT '{}',
  body_text            text,
  body_html            text,
  snippet              text,
  in_reply_to          text,
  labels               text[] DEFAULT '{}',
  is_read              boolean DEFAULT false,
  is_sent              boolean DEFAULT false,
  has_attachments      boolean DEFAULT false,
  provider_received_at timestamptz,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_issue  ON email_threads(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_threads_thread ON email_threads(tenant_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_user   ON email_threads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_fts    ON email_threads
  USING gin(to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body_text,'')));

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS et_own ON email_threads;
CREATE POLICY et_own ON email_threads
  USING (user_id = auth.uid() OR
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ─── 2.8 meeting_issue_drops  ⚠ NEW (Gap Filled) ────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_issue_drops (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  issue_id   uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  dropped_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_issue_drops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mid_tenant ON meeting_issue_drops;
CREATE POLICY mid_tenant ON meeting_issue_drops
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ));
ALTER TABLE meeting_issue_drops REPLICA IDENTITY FULL;

-- ─── 2.9 universal_mentions  ⚠ NEW (Gap Filled) ─────────────────────────────
CREATE TABLE IF NOT EXISTS universal_mentions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  surface           text NOT NULL,
  resource_id       uuid NOT NULL,
  context_text      text,
  link              text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON universal_mentions(mentioned_user_id, created_at DESC);
ALTER TABLE universal_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS um_own ON universal_mentions;
CREATE POLICY um_own ON universal_mentions
  USING (mentioned_user_id = auth.uid() OR
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ─── 2.10 Notification Triggers ──────────────────────────────────────────────

DROP TRIGGER IF EXISTS t_notify_mention ON messages;
CREATE OR REPLACE FUNCTION notify_on_mention() RETURNS TRIGGER AS $$
DECLARE
  mentioned_user uuid;
  author_name    text;
BEGIN
  IF array_length(NEW.mentions, 1) IS NULL THEN RETURN NEW; END IF;
  SELECT display_name INTO author_name FROM profiles WHERE id = NEW.author_id;
  FOREACH mentioned_user IN ARRAY NEW.mentions LOOP
    IF mentioned_user = NEW.author_id THEN CONTINUE; END IF;
    INSERT INTO notifications
      (tenant_id, user_id, type, title, body, link, message_id, channel_id, actor_id)
    VALUES (
      NEW.tenant_id, mentioned_user, 'mention',
      author_name || ' mentioned you',
      LEFT(NEW.body, 120),
      '/chat?channel=' || NEW.channel_id,
      NEW.id, NEW.channel_id, NEW.author_id
    );
    INSERT INTO universal_mentions
      (tenant_id, mentioned_user_id, actor_id, surface, resource_id, context_text, link)
    VALUES (
      NEW.tenant_id, mentioned_user, NEW.author_id, 'chat', NEW.id,
      LEFT(NEW.body, 120), '/chat?channel=' || NEW.channel_id
    );
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER t_notify_mention AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_on_mention();

DROP TRIGGER IF EXISTS t_notify_assign ON issues;
CREATE OR REPLACE FUNCTION notify_on_issue_assign() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NEW; END IF;
  INSERT INTO notifications
    (tenant_id, user_id, type, title, body, link, issue_id)
  VALUES (
    NEW.tenant_id, NEW.assignee_id, 'issue_assigned',
    'Issue assigned to you',
    NEW.title,
    '/board?issue=' || NEW.id,
    NEW.id
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER t_notify_assign AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION notify_on_issue_assign();

DROP TRIGGER IF EXISTS t_auto_channel ON projects;
CREATE OR REPLACE FUNCTION auto_create_project_channel() RETURNS TRIGGER AS $$
DECLARE auto_create boolean;
BEGIN
  SELECT ws.auto_create_project_channels INTO auto_create
  FROM workspace_settings ws WHERE ws.tenant_id = NEW.tenant_id;
  IF COALESCE(auto_create, true) THEN
    INSERT INTO channels (tenant_id, project_id, name, created_by)
    VALUES (
      NEW.tenant_id, NEW.id,
      lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')),
      NEW.created_by
    ) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t_auto_channel AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION auto_create_project_channel();

-- ─── Add new tables to Realtime publication ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_threads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE email_threads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_issue_drops') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_issue_drops;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'universal_mentions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE universal_mentions;
  END IF;
END $$;
