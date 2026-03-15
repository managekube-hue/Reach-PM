-- ============================================================
-- CommCollab v3 — Schema Migration
-- Conflicts resolved:
--   C-02  tenant_id → workspace_id everywhere
--   C-03  ALTER profiles (add comm preference columns)
--   C-06B ALTER notifications (rename + add columns, no DROP)
--   C-10  notify_on_issue_assign: get workspace_id from assignee profile
--   C-14  webrtc_signals: explicit DISABLE ROW LEVEL SECURITY
-- Run entire file in Supabase SQL Editor.
-- ============================================================

-- 1. EXTENSIONS --------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. STORAGE BUCKETS -------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings', 'recordings', false, 524288000,
  ARRAY['video/webm','video/mp4','audio/webm']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments', 'attachments', false, 52428800,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp',
    'application/pdf','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4','video/webm','audio/mpeg','audio/webm'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS (C-02: use default_workspace_id from profiles)
DROP POLICY IF EXISTS "recordings_read"   ON storage.objects;
DROP POLICY IF EXISTS "recordings_insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments_read"  ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;

CREATE POLICY "recordings_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = (
    SELECT default_workspace_id::text FROM profiles WHERE id = auth.uid()
  )
);
CREATE POLICY "recordings_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'recordings'
  AND (storage.foldername(name))[1] = (
    SELECT default_workspace_id::text FROM profiles WHERE id = auth.uid()
  )
);
CREATE POLICY "attachments_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (
    SELECT default_workspace_id::text FROM profiles WHERE id = auth.uid()
  )
);
CREATE POLICY "attachments_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = (
    SELECT default_workspace_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- 3. ALTER profiles (C-03) --------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_email      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_browser    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_sounds     boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_types      text[]
    DEFAULT '{mention,dm,issue_assigned,video_start}',
  ADD COLUMN IF NOT EXISTS theme                   text DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS timezone                text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS auto_assign_to_self     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_input_device      text,
  ADD COLUMN IF NOT EXISTS audio_input_device      text,
  ADD COLUMN IF NOT EXISTS push_subscription       jsonb,
  ADD COLUMN IF NOT EXISTS email_signature         text,
  ADD COLUMN IF NOT EXISTS zoom_connected          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gmail_connected         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outlook_connected       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS color                   text DEFAULT '#48B8FF',
  ADD COLUMN IF NOT EXISTS avatar_url              text;

-- 4. workspace_settings (C-02: workspace_id FK → workspaces) ----
CREATE TABLE IF NOT EXISTS workspace_settings (
  id                           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id                 uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  gifs_enabled                 boolean DEFAULT true,
  who_can_create_channels      text DEFAULT 'members',
  who_can_invite               text DEFAULT 'members',
  default_channels             text[] DEFAULT '{general,announcements}',
  auto_create_project_channels boolean DEFAULT true,
  file_upload_enabled          boolean DEFAULT true,
  max_file_size_mb             int DEFAULT 50,
  link_previews_enabled        boolean DEFAULT true,
  message_retention_days       int DEFAULT 0,
  standup_reminders            boolean DEFAULT false,
  standup_reminder_time        text DEFAULT '09:00',
  video_recording_enabled      boolean DEFAULT true,
  ai_enabled                   boolean DEFAULT true,
  email_notifications_enabled  boolean DEFAULT true,
  created_at                   timestamptz DEFAULT now(),
  updated_at                   timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS t_ws_updated ON workspace_settings;
CREATE TRIGGER t_ws_updated BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ws_workspace ON workspace_settings;
CREATE POLICY ws_workspace ON workspace_settings
  USING (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION create_default_workspace_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspace_settings (workspace_id) VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_default_ws_settings ON workspaces;
CREATE TRIGGER t_default_ws_settings AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION create_default_workspace_settings();

-- 5. channels (C-02: workspace_id) ------------------------------
CREATE TABLE IF NOT EXISTS channels (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  is_dm        boolean DEFAULT false,
  is_private   boolean DEFAULT false,
  is_archived  boolean DEFAULT false,
  members      uuid[] DEFAULT '{}',
  created_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  pinned_count int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_workspace ON channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_dm        ON channels(workspace_id, is_dm) WHERE is_dm = true;
CREATE INDEX IF NOT EXISTS idx_channels_archived  ON channels(workspace_id, is_archived);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channels_select ON channels;
DROP POLICY IF EXISTS channels_insert ON channels;
DROP POLICY IF EXISTS channels_update ON channels;

CREATE POLICY channels_select ON channels FOR SELECT
  USING (
    workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
    AND is_archived = false
    AND (
      is_private = false
      OR auth.uid() = ANY(members)
      OR created_by = auth.uid()
    )
  );

CREATE POLICY channels_insert ON channels FOR INSERT
  WITH CHECK (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY channels_update ON channels FOR UPDATE
  USING (
    workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM workspace_members
        WHERE user_id = auth.uid()
          AND workspace_id = channels.workspace_id
          AND role = 'admin'
      )
    )
  );

ALTER TABLE channels REPLICA IDENTITY FULL;

-- 6. messages (C-02: workspace_id) ------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body          text NOT NULL,
  is_system     boolean DEFAULT false,
  issue_id      uuid REFERENCES issues(id) ON DELETE SET NULL,
  thread_of     uuid REFERENCES messages(id) ON DELETE CASCADE,
  thread_count  int DEFAULT 0,
  last_reply_at timestamptz,
  edited        boolean DEFAULT false,
  edited_at     timestamptz,
  reactions     jsonb DEFAULT '{}',
  mentions      uuid[] DEFAULT '{}',
  attachments   jsonb DEFAULT '[]',
  link_preview  jsonb DEFAULT NULL,
  deleted       boolean DEFAULT false,
  deleted_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel  ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_author   ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_issue    ON messages(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread   ON messages(thread_of) WHERE thread_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_mentions ON messages USING GIN(mentions);
CREATE INDEX IF NOT EXISTS idx_messages_fts      ON messages
  USING gin(to_tsvector('english', body));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select ON messages;
DROP POLICY IF EXISTS messages_insert ON messages;
DROP POLICY IF EXISTS messages_update ON messages;

CREATE POLICY messages_select ON messages FOR SELECT
  USING (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY messages_update ON messages FOR UPDATE
  USING (
    workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM workspace_members
        WHERE user_id = auth.uid()
          AND workspace_id = messages.workspace_id
          AND role = 'admin'
      )
    )
  );

ALTER TABLE messages REPLICA IDENTITY FULL;

-- Trigger: set edited_at
CREATE OR REPLACE FUNCTION messages_set_edited()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.body IS DISTINCT FROM NEW.body THEN
    NEW.edited = true; NEW.edited_at = now();
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_messages_edited ON messages;
CREATE TRIGGER t_messages_edited BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_set_edited();

-- Trigger: soft-delete
CREATE OR REPLACE FUNCTION messages_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted = true AND OLD.deleted = false THEN
    NEW.body = '[deleted]'; NEW.deleted_at = now();
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_messages_soft_delete ON messages;
CREATE TRIGGER t_messages_soft_delete BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_soft_delete();

-- Trigger: increment thread_count on parent
CREATE OR REPLACE FUNCTION messages_thread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_of IS NOT NULL THEN
    UPDATE messages
    SET thread_count = thread_count + 1, last_reply_at = now()
    WHERE id = NEW.thread_of;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_thread_count ON messages;
CREATE TRIGGER t_thread_count AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_thread_count();

-- Trigger: copy channel_id + workspace_id from parent to thread replies
CREATE OR REPLACE FUNCTION copy_parent_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_of IS NOT NULL AND NEW.channel_id IS NULL THEN
    SELECT channel_id, workspace_id INTO NEW.channel_id, NEW.workspace_id
    FROM messages WHERE id = NEW.thread_of;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_copy_parent ON messages;
CREATE TRIGGER t_copy_parent BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION copy_parent_fields();

-- 7. pinned_messages (C-02: workspace_id) -----------------------
CREATE TABLE IF NOT EXISTS pinned_messages (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id   uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id   uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(channel_id, message_id)
);

ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pinned_workspace ON pinned_messages;
CREATE POLICY pinned_workspace ON pinned_messages
  USING (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE pinned_messages REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION sync_pinned_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE channels SET pinned_count = pinned_count + 1 WHERE id = NEW.channel_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE channels SET pinned_count = GREATEST(0, pinned_count - 1) WHERE id = OLD.channel_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_pinned_count ON pinned_messages;
CREATE TRIGGER t_pinned_count AFTER INSERT OR DELETE ON pinned_messages
  FOR EACH ROW EXECUTE FUNCTION sync_pinned_count();

-- 8. channel_last_read -------------------------------------------
CREATE TABLE IF NOT EXISTS channel_last_read (
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id   uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

ALTER TABLE channel_last_read ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clr_own ON channel_last_read;
CREATE POLICY clr_own ON channel_last_read
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 9. notifications ALTER (C-06B: non-destructive rename + add columns)
-- Rename recipient_id → user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'recipient_id'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN recipient_id TO user_id;
  END IF;
END $$;

-- Rename is_read → read
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN is_read TO "read";
  END IF;
END $$;

-- Add missing columns
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_id   uuid REFERENCES issues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at    timestamptz;

-- Drop conflicting type constraints (spec uses different type values)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_resource_type_check;

-- Fix indexes
DROP INDEX IF EXISTS idx_notif_recipient;
DROP INDEX IF EXISTS idx_notif_unread;
CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, "read", created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_workspace ON notifications(workspace_id);

-- Fix RLS policies to use renamed column
DROP POLICY IF EXISTS notifications_select ON notifications;
DROP POLICY IF EXISTS notifications_update ON notifications;
DROP POLICY IF EXISTS notifications_delete ON notifications;
DROP POLICY IF EXISTS notif_own ON notifications;
CREATE POLICY notif_own ON notifications USING (user_id = auth.uid());

ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Update send_notification function to use renamed column
CREATE OR REPLACE FUNCTION send_notification(
  p_recipient_id  uuid,
  p_type          text,
  p_title         text,
  p_body          text DEFAULT '',
  p_link          text DEFAULT NULL,
  p_actor_id      uuid DEFAULT NULL,
  p_actor_name    text DEFAULT NULL,
  p_resource_id   uuid DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_workspace_id  uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO notifications
    (user_id, workspace_id, type, title, body, link, actor_id, actor_name, resource_id, resource_type)
  VALUES
    (p_recipient_id, p_workspace_id, p_type, p_title, p_body, p_link,
     p_actor_id, p_actor_name, p_resource_id, p_resource_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. meetings (new table — avoids ENUM conflict with comm_meetings) -
CREATE TABLE IF NOT EXISTS meetings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  channel_id      uuid REFERENCES channels(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  room_code       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_secs   int,
  status          text DEFAULT 'scheduled', -- scheduled | live | ended | cancelled
  host_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recording_path  text,
  recording_url   text,
  external_emails text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_workspace ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_channel   ON meetings(channel_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status    ON meetings(status);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_workspace ON meetings;
DROP POLICY IF EXISTS meetings_insert    ON meetings;
CREATE POLICY meetings_workspace ON meetings
  USING (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY meetings_insert ON meetings FOR INSERT
  WITH CHECK (workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE meetings REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS meeting_participants (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  email      text,
  joined_at  timestamptz,
  left_at    timestamptz,
  is_host    boolean DEFAULT false
);

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mp_workspace ON meeting_participants;
CREATE POLICY mp_workspace ON meeting_participants
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE
      workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
  ));

-- 11. webrtc_signals (C-14: explicit DISABLE RLS) ---------------
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code  text NOT NULL,
  from_user  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user    uuid,
  type       text NOT NULL, -- offer | answer | ice-candidate | join | leave | ready
  payload    jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_room ON webrtc_signals(room_code, created_at);

-- Explicitly disable RLS — signals are ephemeral, room_code is a shared secret.
-- Rows are purged by cron every 2 hours.
ALTER TABLE webrtc_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_signals REPLICA IDENTITY FULL;

-- 12. integration_tokens ----------------------------------------
CREATE TABLE IF NOT EXISTS integration_tokens (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider       text NOT NULL, -- google | microsoft
  access_token   text,
  refresh_token  text,
  token_expiry   timestamptz,
  scopes         text[],
  provider_email text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
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

-- 13. email_threads ---------------------------------------------
CREATE TABLE IF NOT EXISTS email_threads (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issue_id             uuid REFERENCES issues(id) ON DELETE SET NULL,
  channel_id           uuid REFERENCES channels(id) ON DELETE SET NULL,
  provider             text NOT NULL,    -- google | microsoft
  thread_id            text NOT NULL,    -- Gmail threadId or Outlook conversationId
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

CREATE INDEX IF NOT EXISTS idx_email_threads_issue   ON email_threads(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_threads_thread  ON email_threads(workspace_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_user    ON email_threads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_fts     ON email_threads
  USING gin(to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body_text,'')));

ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS et_own ON email_threads;
CREATE POLICY et_own ON email_threads
  USING (
    user_id = auth.uid()
    OR workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
  );

ALTER TABLE email_threads REPLICA IDENTITY FULL;

-- 14. meeting_issue_drops ---------------------------------------
CREATE TABLE IF NOT EXISTS meeting_issue_drops (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  issue_id   uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  dropped_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_issue_drops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mid_workspace ON meeting_issue_drops;
CREATE POLICY mid_workspace ON meeting_issue_drops
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE
      workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
  ));

ALTER TABLE meeting_issue_drops REPLICA IDENTITY FULL;

-- 15. universal_mentions ----------------------------------------
CREATE TABLE IF NOT EXISTS universal_mentions (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  surface           text NOT NULL, -- chat | issue_description | issue_comment | doc | ide_note
  resource_id       uuid NOT NULL,
  context_text      text,
  link              text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON universal_mentions(mentioned_user_id, created_at DESC);

ALTER TABLE universal_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS um_own ON universal_mentions;
CREATE POLICY um_own ON universal_mentions
  USING (
    mentioned_user_id = auth.uid()
    OR workspace_id = (SELECT default_workspace_id FROM profiles WHERE id = auth.uid())
  );

-- 16. TRIGGERS ---------------------------------------------------

-- @mention in message → notification + universal_mention
-- (C-02: workspace_id throughout)
CREATE OR REPLACE FUNCTION notify_on_mention()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user uuid;
  author_name    text;
BEGIN
  IF array_length(NEW.mentions, 1) IS NULL THEN RETURN NEW; END IF;
  SELECT display_name INTO author_name FROM profiles WHERE id = NEW.author_id;
  FOREACH mentioned_user IN ARRAY NEW.mentions LOOP
    IF mentioned_user = NEW.author_id THEN CONTINUE; END IF;
    INSERT INTO notifications
      (workspace_id, user_id, type, title, body, link, message_id, channel_id, actor_id)
    VALUES (
      NEW.workspace_id, mentioned_user, 'mention',
      author_name || ' mentioned you',
      LEFT(NEW.body, 120),
      '/chat?channel=' || NEW.channel_id,
      NEW.id, NEW.channel_id, NEW.author_id
    );
    INSERT INTO universal_mentions
      (workspace_id, mentioned_user_id, actor_id, surface, resource_id, context_text, link)
    VALUES (
      NEW.workspace_id, mentioned_user, NEW.author_id, 'chat', NEW.id,
      LEFT(NEW.body, 120), '/chat?channel=' || NEW.channel_id
    );
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS t_notify_mention ON messages;
CREATE TRIGGER t_notify_mention AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_on_mention();

-- Issue assigned → notify new assignee
-- (C-10: issues.tenant_id doesn't exist → get workspace_id from assignee's profile)
CREATE OR REPLACE FUNCTION notify_on_issue_assign()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN RETURN NEW; END IF;
  SELECT default_workspace_id INTO v_workspace_id
    FROM profiles WHERE id = NEW.assignee_id;
  IF v_workspace_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO notifications
    (workspace_id, user_id, type, title, body, link, issue_id)
  VALUES (
    v_workspace_id, NEW.assignee_id, 'issue_assigned',
    'Issue assigned to you',
    NEW.title,
    '/board?issue=' || NEW.id,
    NEW.id
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS t_notify_assign ON issues;
CREATE TRIGGER t_notify_assign AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION notify_on_issue_assign();

-- Auto-create project channel when project is created
-- (C-02: assumes projects.workspace_id — adjust if column is named differently)
CREATE OR REPLACE FUNCTION auto_create_project_channel()
RETURNS TRIGGER AS $$
DECLARE
  auto_create    boolean;
  v_workspace_id uuid;
BEGIN
  v_workspace_id := NEW.workspace_id;
  IF v_workspace_id IS NULL THEN RETURN NEW; END IF;
  SELECT ws.auto_create_project_channels INTO auto_create
  FROM workspace_settings ws WHERE ws.workspace_id = v_workspace_id;
  IF COALESCE(auto_create, true) THEN
    INSERT INTO channels (workspace_id, project_id, name, created_by)
    VALUES (
      v_workspace_id, NEW.id,
      lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')),
      NEW.created_by
    ) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
    DROP TRIGGER IF EXISTS t_auto_channel ON projects;
    CREATE TRIGGER t_auto_channel AFTER INSERT ON projects
      FOR EACH ROW EXECUTE FUNCTION auto_create_project_channel();
  END IF;
END $$;

-- 17. CRON JOBS (pg_cron) ----------------------------------------

-- Purge old webrtc_signals every 2 hours
SELECT cron.schedule(
  'purge-webrtc-signals',
  '0 */2 * * *',
  $$DELETE FROM webrtc_signals WHERE created_at < now() - interval '2 hours'$$
);

-- Auto-end meetings that are live but started > 4 hours ago
SELECT cron.schedule(
  'auto-end-stale-meetings',
  '*/15 * * * *',
  $$UPDATE meetings SET status = 'ended', ended_at = now()
    WHERE status = 'live' AND started_at < now() - interval '4 hours'$$
);

-- Archive messages older than retention_days (skip if 0 = forever)
SELECT cron.schedule(
  'archive-old-messages',
  '0 3 * * *',
  $$
    INSERT INTO comm_messages_archive (id, workspace_id, channel_id, author_id, body, created_at)
    SELECT m.id, m.workspace_id, m.channel_id, m.author_id, m.body, m.created_at
    FROM messages m
    JOIN workspace_settings ws ON ws.workspace_id = m.workspace_id
    WHERE ws.message_retention_days > 0
      AND m.created_at < now() - (ws.message_retention_days || ' days')::interval
      AND m.deleted = false
    ON CONFLICT DO NOTHING;
    DELETE FROM messages m
    USING workspace_settings ws
    WHERE ws.workspace_id = m.workspace_id
      AND ws.message_retention_days > 0
      AND m.created_at < now() - (ws.message_retention_days || ' days')::interval;
  $$
);
