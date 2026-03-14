-- ============================================================
-- REACH_gap_patch.sql
-- Idempotent patch — run AFTER REACH_unified.sql
-- Adds everything missing identified in full gap audit
-- Safe to re-run: all CREATE TABLE IF NOT EXISTS,
-- ALTER ADD COLUMN via DO blocks, idempotent seeds
-- ============================================================

-- ============================================================
-- §1  ISSUE FIELDS — missing columns on existing table
-- ============================================================

DO $$ BEGIN
  -- Scheduling
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='due_date')
    THEN ALTER TABLE issues ADD COLUMN due_date date; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='start_date')
    THEN ALTER TABLE issues ADD COLUMN start_date date; END IF;

  -- Visual
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='color_label')
    THEN ALTER TABLE issues ADD COLUMN color_label text; END IF;  -- hex e.g. '#E8965A'

  -- Hierarchy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='parent_id')
    THEN ALTER TABLE issues ADD COLUMN parent_id uuid REFERENCES issues(id) ON DELETE SET NULL; END IF;

  -- Issue type (Scrum + Shape Up unified)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_type') THEN
    CREATE TYPE issue_type AS ENUM (
      'task','bug','story','epic','spike',          -- Scrum
      'pitch','bet','experiment','chore',            -- Shape Up
      'feature','improvement','question'             -- General
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='issue_type')
    THEN ALTER TABLE issues ADD COLUMN issue_type issue_type DEFAULT 'task'; END IF;

  -- Shape Up cycle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='cycle_id')
    THEN ALTER TABLE issues ADD COLUMN cycle_id uuid; END IF;

  -- Time budget
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='estimate_hours')
    THEN ALTER TABLE issues ADD COLUMN estimate_hours numeric(6,2); END IF;

  -- Visibility
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='published')
    THEN ALTER TABLE issues ADD COLUMN published boolean DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='public_slug')
    THEN ALTER TABLE issues ADD COLUMN public_slug text UNIQUE; END IF;

  -- External import tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='external_id')
    THEN ALTER TABLE issues ADD COLUMN external_id text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='external_source')
    THEN ALTER TABLE issues ADD COLUMN external_source text; END IF;  -- 'jira'|'linear'|'github'

  -- Watchers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='watcher_ids')
    THEN ALTER TABLE issues ADD COLUMN watcher_ids uuid[] DEFAULT '{}'; END IF;

  -- Multiple assignees (keep assignee_id as primary, add array for co-assignees)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='co_assignee_ids')
    THEN ALTER TABLE issues ADD COLUMN co_assignee_ids uuid[] DEFAULT '{}'; END IF;

  -- Shape Up: appetite (small=2w, medium=4w, large=6w)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issues' AND column_name='appetite')
    THEN ALTER TABLE issues ADD COLUMN appetite text; END IF;

END $$;


-- ============================================================
-- §2  ISSUE COMMENTS — new table
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issue_id      uuid NOT NULL REFERENCES issues(id)  ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES profiles(id),
  body          text NOT NULL,
  body_rich     jsonb,                    -- Tiptap/ProseMirror delta
  parent_id     uuid,                    -- threaded replies (self-ref, FK below)
  file_line_ref jsonb,                   -- {file, line, sha} for code comments
  is_system     boolean DEFAULT false,   -- auto-generated (status change, PR link, etc.)
  edited_at     timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_comments_parent_fk') THEN
    ALTER TABLE issue_comments ADD CONSTRAINT issue_comments_parent_fk
      FOREIGN KEY (parent_id) REFERENCES issue_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue  ON issue_comments(issue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_issue_comments_author ON issue_comments(author_id);

ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issue_comments_tenant ON issue_comments;
CREATE POLICY issue_comments_tenant ON issue_comments
  USING (tenant_id = get_tenant_id());

ALTER TABLE issue_comments REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE issue_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- §3  ISSUE EXTERNAL LINKS — new table
-- Attaches Google Docs, OneDrive, Notion, Figma, Loom etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issue_id     uuid NOT NULL REFERENCES issues(id)  ON DELETE CASCADE,
  url          text NOT NULL,
  title        text,
  link_type    text DEFAULT 'external',  -- 'google_doc'|'onedrive'|'notion'|'figma'|'loom'|'github'|'external'
  preview_meta jsonb,                    -- {thumbnail, description, favicon} from og:tags
  added_by     uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_links_issue ON issue_links(issue_id);
ALTER TABLE issue_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issue_links_tenant ON issue_links;
CREATE POLICY issue_links_tenant ON issue_links USING (tenant_id = get_tenant_id());


-- ============================================================
-- §4  ISSUE RELATIONS — blocking / blocked_by / duplicate
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_relations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  source_id     uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'relates_to',
  -- 'blocks'|'blocked_by'|'duplicates'|'is_duplicated_by'|'relates_to'|'child_of'
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

ALTER TABLE issue_relations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issue_relations_tenant ON issue_relations;
CREATE POLICY issue_relations_tenant ON issue_relations USING (tenant_id = get_tenant_id());


-- ============================================================
-- §5  ISSUE FILES — expand existing thin table
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issue_files' AND column_name='file_name')
    THEN ALTER TABLE issue_files ADD COLUMN file_name text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issue_files' AND column_name='file_size')
    THEN ALTER TABLE issue_files ADD COLUMN file_size bigint; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issue_files' AND column_name='mime_type')
    THEN ALTER TABLE issue_files ADD COLUMN mime_type text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issue_files' AND column_name='storage_path')
    THEN ALTER TABLE issue_files ADD COLUMN storage_path text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issue_files' AND column_name='uploaded_by')
    THEN ALTER TABLE issue_files ADD COLUMN uploaded_by uuid REFERENCES profiles(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='issue_files' AND column_name='comment_id')
    THEN ALTER TABLE issue_files ADD COLUMN comment_id uuid REFERENCES issue_comments(id) ON DELETE SET NULL; END IF;
END $$;


-- ============================================================
-- §6  SHAPE UP CYCLES — new table
-- ============================================================

CREATE TABLE IF NOT EXISTS cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  project_id  uuid REFERENCES projects(id),
  name        text NOT NULL,
  appetite    text DEFAULT 'medium',   -- 'small'=2w | 'medium'=4w | 'large'=6w
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      text DEFAULT 'planning', -- 'planning'|'active'|'cooldown'|'done'
  hill_chart  jsonb DEFAULT '[]',      -- [{issue_id, progress 0-100, side:'uphill'|'downhill'}]
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cycles_tenant ON cycles;
CREATE POLICY cycles_tenant ON cycles USING (tenant_id = get_tenant_id());

-- Add FK from issues.cycle_id now that cycles table exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_cycle_fk') THEN
    ALTER TABLE issues ADD CONSTRAINT issues_cycle_fk
      FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- §7  LABELS — new table + issue_labels join
-- ============================================================

CREATE TABLE IF NOT EXISTS labels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  project_id  uuid REFERENCES projects(id),   -- null = workspace-wide label
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#6B7280',
  label_type  text DEFAULT 'custom',           -- 'scrum'|'shapeup'|'custom'
  description text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, project_id, name)
);

ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS labels_tenant ON labels;
CREATE POLICY labels_tenant ON labels USING (tenant_id = get_tenant_id());

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id   uuid NOT NULL REFERENCES issues(id)  ON DELETE CASCADE,
  label_id   uuid NOT NULL REFERENCES labels(id)  ON DELETE CASCADE,
  added_by   uuid REFERENCES profiles(id),
  added_at   timestamptz DEFAULT now(),
  PRIMARY KEY (issue_id, label_id)
);

ALTER TABLE issue_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issue_labels_tenant ON issue_labels;
CREATE POLICY issue_labels_tenant ON issue_labels
  USING (EXISTS (SELECT 1 FROM issues i WHERE i.id = issue_id AND i.tenant_id = get_tenant_id()));


-- ============================================================
-- §8  KEYBINDINGS — new table + seed
-- ============================================================

CREATE TABLE IF NOT EXISTS keybindings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid,                             -- null = global platform default
  user_id     uuid REFERENCES profiles(id),     -- null = applies to all users
  scope       text NOT NULL DEFAULT 'global',   -- 'global'|'board'|'editor'|'chat'|'ide'
  action      text NOT NULL,
  keys        text NOT NULL,                    -- e.g. 'Cmd+K' or 'G I'
  description text,
  is_custom   boolean DEFAULT false,
  UNIQUE(tenant_id, user_id, action)
);

-- Seed global defaults (tenant_id IS NULL = platform-wide)
INSERT INTO keybindings (tenant_id, user_id, scope, action, keys, description) VALUES
  -- Global navigation
  (NULL, NULL, 'global',  'open_search',        'Cmd+K',       'Open command palette'),
  (NULL, NULL, 'global',  'open_search_win',    'Ctrl+K',      'Open command palette (Windows)'),
  (NULL, NULL, 'global',  'new_issue',          'C',           'Create new issue'),
  (NULL, NULL, 'global',  'go_inbox',           'G I',         'Go to Inbox'),
  (NULL, NULL, 'global',  'go_board',           'G B',         'Go to Board'),
  (NULL, NULL, 'global',  'go_backlog',         'G L',         'Go to Backlog'),
  (NULL, NULL, 'global',  'go_roadmap',         'G R',         'Go to Roadmap'),
  (NULL, NULL, 'global',  'go_docs',            'G D',         'Go to Docs'),
  (NULL, NULL, 'global',  'go_chat',            'G C',         'Go to Chat'),
  (NULL, NULL, 'global',  'go_ide',             'G E',         'Go to IDE'),
  (NULL, NULL, 'global',  'go_analytics',       'G A',         'Go to Analytics'),
  (NULL, NULL, 'global',  'go_crm',             'G M',         'Go to CRM'),
  (NULL, NULL, 'global',  'go_settings',        'G S',         'Go to Settings'),
  (NULL, NULL, 'global',  'toggle_theme',       'Cmd+Shift+L', 'Toggle dark/light mode'),
  (NULL, NULL, 'global',  'close_modal',        'Escape',      'Close modal / cancel'),
  -- Issue actions
  (NULL, NULL, 'issue',   'assign_me',          'A',           'Assign to me'),
  (NULL, NULL, 'issue',   'set_priority_urgent','!',           'Set priority: urgent'),
  (NULL, NULL, 'issue',   'set_priority_high',  'H',           'Set priority: high'),
  (NULL, NULL, 'issue',   'set_priority_medium','M',           'Set priority: medium'),
  (NULL, NULL, 'issue',   'set_priority_low',   'L',           'Set priority: low'),
  (NULL, NULL, 'issue',   'set_status_todo',    'T',           'Set status: todo'),
  (NULL, NULL, 'issue',   'set_status_progress','P',           'Set status: in progress'),
  (NULL, NULL, 'issue',   'set_status_review',  'V',           'Set status: review'),
  (NULL, NULL, 'issue',   'set_status_done',    'D',           'Set status: done'),
  (NULL, NULL, 'issue',   'copy_link',          'Cmd+Shift+C', 'Copy issue link'),
  (NULL, NULL, 'issue',   'delete_issue',       'Backspace',   'Delete issue (with confirm)'),
  -- Board
  (NULL, NULL, 'board',   'move_up',            'ArrowUp',     'Move issue up in column'),
  (NULL, NULL, 'board',   'move_down',          'ArrowDown',   'Move issue down in column'),
  (NULL, NULL, 'board',   'move_left',          'ArrowLeft',   'Move issue to prev column'),
  (NULL, NULL, 'board',   'move_right',         'ArrowRight',  'Move issue to next column'),
  -- Editor / Docs
  (NULL, NULL, 'editor',  'save_doc',           'Cmd+S',       'Save document'),
  (NULL, NULL, 'editor',  'bold',               'Cmd+B',       'Bold'),
  (NULL, NULL, 'editor',  'italic',             'Cmd+I',       'Italic'),
  (NULL, NULL, 'editor',  'code_inline',        'Cmd+E',       'Inline code'),
  (NULL, NULL, 'editor',  'code_block',         'Cmd+Alt+C',   'Code block'),
  (NULL, NULL, 'editor',  'heading_1',          'Cmd+Alt+1',   'Heading 1'),
  (NULL, NULL, 'editor',  'heading_2',          'Cmd+Alt+2',   'Heading 2'),
  (NULL, NULL, 'editor',  'slash_menu',         '/',           'Open slash command menu'),
  (NULL, NULL, 'editor',  'at_mention',         '@',           'Mention a person or issue'),
  -- Chat
  (NULL, NULL, 'chat',    'send_message',       'Enter',       'Send message'),
  (NULL, NULL, 'chat',    'new_line',           'Shift+Enter', 'New line in message'),
  (NULL, NULL, 'chat',    'react_last',         'Cmd+Shift+E', 'React to last message'),
  (NULL, NULL, 'chat',    'jump_latest',        'Cmd+J',       'Jump to latest message'),
  (NULL, NULL, 'chat',    'search_channel',     'Cmd+F',       'Search in channel'),
  -- IDE
  (NULL, NULL, 'ide',     'run_code',           'Cmd+Enter',   'Run / execute'),
  (NULL, NULL, 'ide',     'format_code',        'Cmd+Shift+F', 'Format file'),
  (NULL, NULL, 'ide',     'toggle_terminal',    'Ctrl+`',      'Toggle terminal'),
  (NULL, NULL, 'ide',     'go_to_file',         'Cmd+P',       'Go to file'),
  (NULL, NULL, 'ide',     'find_in_files',      'Cmd+Shift+F', 'Find in files')
ON CONFLICT (tenant_id, user_id, action) DO NOTHING;


-- ============================================================
-- §9  LABELS — Seed Scrum + Shape Up defaults
-- ============================================================

-- These seed into a special "platform" context (tenant_id=NULL is not valid per FK)
-- Instead: seeded via a function called during tenant creation
CREATE OR REPLACE FUNCTION seed_default_labels(p_tenant_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO labels (tenant_id, project_id, name, color, label_type, description) VALUES
    -- Scrum labels
    (p_tenant_id, NULL, 'Story',       '#8B7CF8', 'scrum',   'User story — value delivered to user'),
    (p_tenant_id, NULL, 'Bug',         '#EF4444', 'scrum',   'Something broken'),
    (p_tenant_id, NULL, 'Task',        '#3ECFCF', 'scrum',   'Technical task'),
    (p_tenant_id, NULL, 'Epic',        '#F59E0B', 'scrum',   'Large initiative spanning multiple sprints'),
    (p_tenant_id, NULL, 'Spike',       '#6B7280', 'scrum',   'Research / investigation timebox'),
    (p_tenant_id, NULL, 'Chore',       '#9CA3AF', 'scrum',   'Maintenance, refactor, debt'),
    -- Shape Up labels
    (p_tenant_id, NULL, 'Pitch',       '#3B82F6', 'shapeup', 'Problem + solution proposal (betting table input)'),
    (p_tenant_id, NULL, 'Bet',         '#10B981', 'shapeup', 'Approved pitch — goes into a cycle'),
    (p_tenant_id, NULL, 'Appetite',    '#F97316', 'shapeup', 'Time budget for a bet'),
    (p_tenant_id, NULL, 'Experiment',  '#A78BFA', 'shapeup', 'Low-risk try'),
    (p_tenant_id, NULL, 'Cool-down',   '#D1D5DB', 'shapeup', 'Between cycles — no formal work'),
    -- Priority / Status utility labels
    (p_tenant_id, NULL, 'Blocked',     '#DC2626', 'custom',  'Work is blocked by an external dependency'),
    (p_tenant_id, NULL, 'Needs Review','#FBBF24', 'custom',  'Awaiting review or decision'),
    (p_tenant_id, NULL, 'Good First Issue','#22C55E','custom','Suitable for new contributors'),
    (p_tenant_id, NULL, 'Won''t Fix',  '#9CA3AF', 'custom',  'Acknowledged but will not be addressed')
  ON CONFLICT (tenant_id, project_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- §10  CHAT — missing fields + channel_files + DM lookup
-- ============================================================

-- Add missing columns to chat_channels
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_channels' AND column_name='description')
    THEN ALTER TABLE chat_channels ADD COLUMN description text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_channels' AND column_name='topic')
    THEN ALTER TABLE chat_channels ADD COLUMN topic text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_channels' AND column_name='is_private')
    THEN ALTER TABLE chat_channels ADD COLUMN is_private boolean DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_channels' AND column_name='is_default')
    THEN ALTER TABLE chat_channels ADD COLUMN is_default boolean DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_channels' AND column_name='member_count')
    THEN ALTER TABLE chat_channels ADD COLUMN member_count int DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_channels' AND column_name='dm_user_ids')
    THEN ALTER TABLE chat_channels ADD COLUMN dm_user_ids uuid[] DEFAULT '{}'; END IF;
    -- For DMs: always sorted array of 2 user IDs — unique index enables fast lookup
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_dm
  ON chat_channels(tenant_id, dm_user_ids)
  WHERE channel_type = 'dm';

-- Add missing columns to chat_messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='encrypted')
    THEN ALTER TABLE chat_messages ADD COLUMN encrypted boolean DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='file_ids')
    THEN ALTER TABLE chat_messages ADD COLUMN file_ids uuid[] DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='link_previews')
    THEN ALTER TABLE chat_messages ADD COLUMN link_previews jsonb; END IF;  -- [{url,title,description,image}]
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='issue_id')
    THEN ALTER TABLE chat_messages ADD COLUMN issue_id uuid REFERENCES issues(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='pinned_at')
    THEN ALTER TABLE chat_messages ADD COLUMN pinned_at timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='pinned_by')
    THEN ALTER TABLE chat_messages ADD COLUMN pinned_by uuid REFERENCES profiles(id); END IF;
END $$;

-- Channel files (images + attachments sent in chat)
CREATE TABLE IF NOT EXISTS channel_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id    uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  message_id    uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  uploaded_by   uuid NOT NULL REFERENCES profiles(id),
  file_name     text NOT NULL,
  file_size     bigint,
  mime_type     text,
  storage_path  text NOT NULL,
  thumbnail_path text,              -- generated for images
  width         int,                -- image dimensions
  height        int,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_files_channel ON channel_files(channel_id, created_at DESC);
ALTER TABLE channel_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_files_tenant ON channel_files;
CREATE POLICY channel_files_tenant ON channel_files USING (tenant_id = get_tenant_id());

-- Pinned messages table
CREATE TABLE IF NOT EXISTS channel_pins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  channel_id  uuid NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  pinned_by   uuid NOT NULL REFERENCES profiles(id),
  pinned_at   timestamptz DEFAULT now(),
  UNIQUE(channel_id, message_id)
);

ALTER TABLE channel_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_pins_tenant ON channel_pins;
CREATE POLICY channel_pins_tenant ON channel_pins USING (tenant_id = get_tenant_id());

-- RPC: get_or_create_dm_channel (called when user clicks DM button)
CREATE OR REPLACE FUNCTION get_or_create_dm_channel(
  p_user_a uuid,
  p_user_b uuid
) RETURNS uuid AS $$
DECLARE
  v_channel_id uuid;
  v_tenant_id  uuid;
  v_sorted     uuid[];
BEGIN
  -- Sort IDs so DM lookup is order-independent
  v_sorted := ARRAY(SELECT unnest FROM unnest(ARRAY[p_user_a, p_user_b]) ORDER BY 1);

  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1;

  -- Try to find existing DM channel
  SELECT id INTO v_channel_id
  FROM   chat_channels
  WHERE  tenant_id    = v_tenant_id
    AND  channel_type = 'dm'
    AND  dm_user_ids  = v_sorted
  LIMIT 1;

  -- Create if not found
  IF v_channel_id IS NULL THEN
    INSERT INTO chat_channels (tenant_id, name, channel_type, dm_user_ids, is_private)
    VALUES (
      v_tenant_id,
      'dm:' || p_user_a::text || ':' || p_user_b::text,
      'dm',
      v_sorted,
      true
    )
    RETURNING id INTO v_channel_id;

    -- Auto-add both users as members
    INSERT INTO chat_members (tenant_id, channel_id, user_id, role)
    VALUES
      (v_tenant_id, v_channel_id, p_user_a, 'member'),
      (v_tenant_id, v_channel_id, p_user_b, 'member')
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: mark_channel_read
CREATE OR REPLACE FUNCTION mark_channel_read(p_channel_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO channel_last_read (tenant_id, channel_id, user_id, last_read)
  VALUES (get_tenant_id(), p_channel_id, auth.uid(), now())
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET last_read = now();

  UPDATE chat_members SET last_read = now()
  WHERE channel_id = p_channel_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: unread_counts (for sidebar badges)
CREATE OR REPLACE VIEW unread_counts AS
SELECT
  cm.user_id,
  cm.channel_id,
  cm.tenant_id,
  COALESCE((
    SELECT COUNT(*)
    FROM   chat_messages msg
    WHERE  msg.channel_id = cm.channel_id
      AND  msg.created_at > COALESCE(cm.last_read, '1970-01-01')
      AND  msg.sender_id  != cm.user_id
      AND  msg.deleted_at IS NULL
  ), 0) AS unread_count
FROM chat_members cm;

-- Seed default channels when tenant is created
CREATE OR REPLACE FUNCTION seed_default_channels(p_tenant_id uuid) RETURNS void AS $$
DECLARE
  v_general_id uuid;
  v_announce_id uuid;
BEGIN
  -- #general
  INSERT INTO chat_channels (tenant_id, name, channel_type, is_default, description)
  VALUES (p_tenant_id, 'general', 'public', true, 'General team conversation')
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_general_id;

  -- #announcements
  INSERT INTO chat_channels (tenant_id, name, channel_type, is_default, description)
  VALUES (p_tenant_id, 'announcements', 'public', true, 'Important workspace announcements')
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_announce_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- §11  DOCUMENTS — missing fields
-- ============================================================

DO $$ BEGIN
  -- Visibility
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_visibility') THEN
    CREATE TYPE doc_visibility AS ENUM ('private','workspace','link','public');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='visibility')
    THEN ALTER TABLE documents ADD COLUMN visibility doc_visibility DEFAULT 'workspace'; END IF;

  -- Public slug for /docs/:slug URLs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='public_slug')
    THEN ALTER TABLE documents ADD COLUMN public_slug text UNIQUE; END IF;

  -- Document type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type') THEN
    CREATE TYPE doc_type AS ENUM ('doc','wiki','template','runbook','spec','meeting_notes','changelog');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='doc_type')
    THEN ALTER TABLE documents ADD COLUMN doc_type doc_type DEFAULT 'doc'; END IF;

  -- Hierarchy (folders)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='parent_id')
    THEN ALTER TABLE documents ADD COLUMN parent_id uuid REFERENCES documents(id) ON DELETE SET NULL; END IF;

  -- External link (mirror/embed from external source)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='external_url')
    THEN ALTER TABLE documents ADD COLUMN external_url text; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='external_type')
    THEN ALTER TABLE documents ADD COLUMN external_type text; END IF;
    -- 'google_doc'|'onedrive'|'notion'|'confluence'|'coda'

  -- Collaboration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='collaborator_ids')
    THEN ALTER TABLE documents ADD COLUMN collaborator_ids uuid[] DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='last_edited_by')
    THEN ALTER TABLE documents ADD COLUMN last_edited_by uuid REFERENCES profiles(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='published_at')
    THEN ALTER TABLE documents ADD COLUMN published_at timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='word_count')
    THEN ALTER TABLE documents ADD COLUMN word_count int DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='emoji_icon')
    THEN ALTER TABLE documents ADD COLUMN emoji_icon text DEFAULT '📄'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='cover_url')
    THEN ALTER TABLE documents ADD COLUMN cover_url text; END IF;
END $$;

-- Document versions (snapshot on each manual save or every N minutes)
CREATE TABLE IF NOT EXISTS doc_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  content     text NOT NULL,
  snapshot_by uuid REFERENCES profiles(id),
  version_num int  NOT NULL DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON doc_versions(doc_id, version_num DESC);
ALTER TABLE doc_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doc_versions_tenant ON doc_versions;
CREATE POLICY doc_versions_tenant ON doc_versions USING (tenant_id = get_tenant_id());

-- Public doc access (no auth needed if visibility='public' or 'link')
DROP POLICY IF EXISTS documents_public_read ON documents;
CREATE POLICY documents_public_read ON documents
  FOR SELECT USING (
    visibility IN ('public','link')
    OR tenant_id = get_tenant_id()
  );

-- Function to generate a public slug
CREATE OR REPLACE FUNCTION publish_document(p_doc_id uuid, p_visibility doc_visibility)
RETURNS text AS $$
DECLARE
  v_slug text;
BEGIN
  IF p_visibility IN ('link','public') THEN
    v_slug := lower(replace(
      (SELECT title FROM documents WHERE id = p_doc_id), ' ', '-'
    )) || '-' || substr(p_doc_id::text, 1, 8);
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');

    UPDATE documents
    SET visibility  = p_visibility,
        public_slug = v_slug,
        published_at = now()
    WHERE id = p_doc_id AND tenant_id = get_tenant_id();

    RETURN v_slug;
  ELSE
    UPDATE documents
    SET visibility  = p_visibility,
        public_slug = NULL,
        published_at = NULL
    WHERE id = p_doc_id AND tenant_id = get_tenant_id();
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- §12  TIME TRACKING — fill manual entry gaps
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_logs' AND column_name='entry_type')
    THEN ALTER TABLE time_logs ADD COLUMN entry_type text DEFAULT 'auto'; END IF;
    -- 'auto' = triggered by status change | 'manual' = user typed hours | 'import'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_logs' AND column_name='billable')
    THEN ALTER TABLE time_logs ADD COLUMN billable boolean DEFAULT true; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_logs' AND column_name='rate_usd')
    THEN ALTER TABLE time_logs ADD COLUMN rate_usd numeric(8,2); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_logs' AND column_name='approved_by')
    THEN ALTER TABLE time_logs ADD COLUMN approved_by uuid REFERENCES profiles(id); END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_logs' AND column_name='approved_at')
    THEN ALTER TABLE time_logs ADD COLUMN approved_at timestamptz; END IF;
END $$;

-- Standalone time entries (not tied to an issue — meetings, admin, etc.)
CREATE TABLE IF NOT EXISTS time_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES profiles(id),
  project_id  uuid REFERENCES projects(id),
  issue_id    uuid REFERENCES issues(id) ON DELETE SET NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  hours       numeric(5,2) NOT NULL,
  description text,
  category    text DEFAULT 'work',  -- 'work'|'meeting'|'research'|'admin'|'pto'
  billable    boolean DEFAULT true,
  rate_usd    numeric(8,2),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user    ON time_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id, date DESC);
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_entries_tenant ON time_entries;
CREATE POLICY time_entries_tenant ON time_entries USING (tenant_id = get_tenant_id());

-- Weekly timesheet view
CREATE OR REPLACE VIEW weekly_timesheets AS
SELECT
  te.user_id,
  te.tenant_id,
  te.project_id,
  date_trunc('week', te.date::timestamptz) AS week_start,
  SUM(te.hours)                            AS total_hours,
  SUM(CASE WHEN te.billable THEN te.hours ELSE 0 END) AS billable_hours,
  COUNT(DISTINCT te.date)                  AS days_logged
FROM time_entries te
GROUP BY te.user_id, te.tenant_id, te.project_id, week_start;


-- ============================================================
-- §13  MCP SERVERS + AGENT RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS mcp_servers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  url          text,                  -- HTTP transport URL
  transport    text DEFAULT 'http',   -- 'http'|'stdio'|'ws'
  api_key_ref  uuid REFERENCES encrypted_secrets(id),
  headers      jsonb DEFAULT '{}',    -- extra headers for HTTP transport
  tools        jsonb DEFAULT '[]',    -- cached tool manifest [{name, description, inputSchema}]
  enabled      boolean DEFAULT true,
  last_ping    timestamptz,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mcp_servers_tenant ON mcp_servers;
CREATE POLICY mcp_servers_tenant ON mcp_servers USING (tenant_id = get_tenant_id());

-- Agent runs (every AI agent invocation, across all surfaces)
CREATE TABLE IF NOT EXISTS agent_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid REFERENCES profiles(id),
  agent_type   text NOT NULL,    -- 'plan'|'code'|'review'|'debug'|'research'|'mcp_tool'
  surface      text,             -- 'ide'|'chat'|'issue'|'doc'
  model        text,
  input        jsonb,
  output       jsonb,
  tool_calls   jsonb DEFAULT '[]',  -- [{tool, input, output, server_id}]
  status       text DEFAULT 'running', -- 'running'|'done'|'failed'|'cancelled'
  error        text,
  token_count  int DEFAULT 0,
  cost_usd     numeric(10,6) DEFAULT 0,
  duration_ms  int,
  issue_id     uuid REFERENCES issues(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant ON agent_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user   ON agent_runs(user_id, created_at DESC);
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_runs_tenant ON agent_runs;
CREATE POLICY agent_runs_tenant ON agent_runs USING (tenant_id = get_tenant_id());

-- AI Skills (REACH built-in + tenant-custom prompt templates)
CREATE TABLE IF NOT EXISTS ai_skills (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid,             -- null = platform built-in skill
  name             text NOT NULL,
  slug             text NOT NULL,    -- machine-readable e.g. 'explain_code'
  description      text,
  surface          text DEFAULT 'ide',  -- 'ide'|'chat'|'issue'|'doc'|'any'
  model            text,             -- null = use workspace default
  system_prompt    text NOT NULL,
  user_prompt_tmpl text,             -- {{{selection}}}, {{{context}}} etc.
  icon             text DEFAULT '⚡',
  enabled          boolean DEFAULT true,
  sort_order       int DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

ALTER TABLE ai_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_skills_read ON ai_skills;
CREATE POLICY ai_skills_read ON ai_skills
  FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_tenant_id());
DROP POLICY IF EXISTS ai_skills_write ON ai_skills;
CREATE POLICY ai_skills_write ON ai_skills
  FOR ALL USING (tenant_id = get_tenant_id());

-- Seed platform built-in skills
INSERT INTO ai_skills (tenant_id, name, slug, surface, system_prompt, user_prompt_tmpl, description, icon, sort_order) VALUES
  (NULL, 'Explain Code',      'explain_code',      'ide',   'You are a senior engineer. Explain the selected code clearly and concisely. Identify patterns, potential issues, and intent.', 'Explain this code:\n\n```\n{{{selection}}}\n```', 'Explain selected code', '🔍', 1),
  (NULL, 'Fix Bug',           'fix_bug',           'ide',   'You are a senior engineer. Fix the bug in the selected code. Explain what was wrong and why your fix is correct.', 'Fix the bug in this code:\n\n```\n{{{selection}}}\n```\n\nError: {{{error}}}', 'Fix a bug in selected code', '🐛', 2),
  (NULL, 'Write Tests',       'write_tests',       'ide',   'You are a senior engineer. Write comprehensive unit tests for the selected code. Use the existing testing framework if visible.', 'Write tests for:\n\n```\n{{{selection}}}\n```', 'Generate unit tests', '🧪', 3),
  (NULL, 'Refactor',          'refactor',          'ide',   'You are a senior engineer. Refactor the selected code for readability, performance, and maintainability without changing behavior.', 'Refactor this code:\n\n```\n{{{selection}}}\n```', 'Refactor for quality', '♻️', 4),
  (NULL, 'Add Docs',          'add_docs',          'ide',   'You are a senior engineer. Add JSDoc/docstring comments to the selected code. Be precise and useful.', 'Add documentation comments to:\n\n```\n{{{selection}}}\n```', 'Add inline documentation', '📝', 5),
  (NULL, 'Code Review',       'code_review',       'ide',   'You are a principal engineer doing a code review. Be thorough: check for bugs, security issues, performance, style, and test coverage.', 'Review this code:\n\n```\n{{{selection}}}\n```', 'Full code review', '👁️', 6),
  (NULL, 'Plan Issue',        'plan_issue',        'issue', 'You are a tech lead. Break down this issue into clear, actionable subtasks with acceptance criteria.', 'Break down this issue:\n\nTitle: {{{title}}}\nDescription: {{{description}}}', 'Break issue into tasks', '📋', 7),
  (NULL, 'Write PR Desc',     'write_pr_desc',     'ide',   'You are a senior engineer. Write a clear, informative PR description based on the diff and issue context.', 'Write a PR description for:\n\nIssue: {{{issue_title}}}\nChanges:\n{{{diff}}}', 'Generate PR description', '🔀', 8),
  (NULL, 'Summarize Thread',  'summarize_thread',  'chat',  'You are a technical assistant. Summarize this conversation thread concisely, highlighting decisions and action items.', 'Summarize this thread:\n\n{{{messages}}}', 'Summarize chat thread', '💬', 9),
  (NULL, 'Draft Doc Section', 'draft_doc',         'doc',   'You are a technical writer. Draft a clear, well-structured documentation section based on the context provided.', 'Draft a doc section about:\n\n{{{context}}}', 'Draft documentation', '✍️', 10)
ON CONFLICT (tenant_id, slug) DO NOTHING;


-- ============================================================
-- §14  IDE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ide_settings (
  user_id       uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  theme         text DEFAULT 'vs-dark',   -- Monaco theme name
  font_family   text DEFAULT 'JetBrains Mono',
  font_size     int  DEFAULT 14,
  tab_size      int  DEFAULT 2,
  word_wrap     boolean DEFAULT false,
  minimap       boolean DEFAULT true,
  line_numbers  boolean DEFAULT true,
  vim_mode      boolean DEFAULT false,
  emmet         boolean DEFAULT true,
  auto_save     boolean DEFAULT true,
  auto_save_ms  int DEFAULT 1000,
  format_on_save boolean DEFAULT true,
  default_lang  text DEFAULT 'typescript',
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE ide_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ide_settings_owner ON ide_settings;
CREATE POLICY ide_settings_owner ON ide_settings
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ============================================================
-- §15  PROJECT ROLE OVERRIDES
-- ============================================================

-- project_members already has a role column — add a can_do check that
-- considers it. Extend the existing can_do() function to check project context.

CREATE OR REPLACE FUNCTION can_do_in_project(p_action text, p_project_id uuid)
RETURNS boolean AS $$
DECLARE
  v_global_role   text;
  v_project_role  text;
  v_effective     text;
BEGIN
  -- Platform owner can do everything
  IF (SELECT is_platform_owner FROM profiles WHERE id = auth.uid()) THEN RETURN true; END IF;

  SELECT role INTO v_global_role FROM profiles WHERE id = auth.uid();
  SELECT role INTO v_project_role FROM project_members
    WHERE user_id = auth.uid() AND project_id = p_project_id;

  -- Role hierarchy: admin > member > guest
  -- Take the HIGHER of global or project role
  v_effective := CASE
    WHEN v_global_role = 'admin' OR v_project_role = 'admin' THEN 'admin'
    WHEN v_global_role = 'member' OR v_project_role = 'member' THEN 'member'
    ELSE 'guest'
  END;

  -- Admin can do everything
  IF v_effective = 'admin' THEN RETURN true; END IF;

  -- Members can do most things except admin actions
  IF v_effective = 'member' AND p_action NOT IN (
    'manage_members', 'manage_billing', 'delete_workspace', 'manage_integrations'
  ) THEN RETURN true; END IF;

  -- Guests: check workspace_permissions
  RETURN EXISTS (
    SELECT 1 FROM workspace_permissions
    WHERE tenant_id = get_tenant_id()
      AND role      = 'guest'
      AND action    = p_action
      AND granted   = true
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================
-- §16  IMPORT / EXPORT QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS import_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  initiated_by uuid REFERENCES profiles(id),
  source      text NOT NULL,   -- 'jira'|'linear'|'github_issues'|'csv'|'asana'
  status      text DEFAULT 'pending',  -- 'pending'|'running'|'done'|'failed'
  file_path   text,            -- storage path of uploaded import file
  options     jsonb DEFAULT '{}',
  result      jsonb,           -- {created, updated, skipped, errors[]}
  error       text,
  created_at  timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_jobs_tenant ON import_jobs;
CREATE POLICY import_jobs_tenant ON import_jobs USING (tenant_id = get_tenant_id());


-- ============================================================
-- §17  REALTIME — add missing tables
-- ============================================================

ALTER TABLE documents      REPLICA IDENTITY FULL;
ALTER TABLE chat_channels  REPLICA IDENTITY FULL;
ALTER TABLE chat_members   REPLICA IDENTITY FULL;
ALTER TABLE sprints        REPLICA IDENTITY FULL;
ALTER TABLE projects       REPLICA IDENTITY FULL;
ALTER TABLE issue_comments REPLICA IDENTITY FULL;
ALTER TABLE agent_runs     REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sprints;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE projects;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE issue_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_runs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- §18  UPDATE TENANT INIT TRIGGER to call new seed functions
-- ============================================================

CREATE OR REPLACE FUNCTION on_tenant_created()
RETURNS TRIGGER AS $$
BEGIN
  -- workspace_settings row
  INSERT INTO workspace_settings (tenant_id, workspace_name)
  VALUES (NEW.id, NEW.name) ON CONFLICT DO NOTHING;

  -- Default permission matrix
  PERFORM seed_workspace_permissions(NEW.id);

  -- Default Scrum + Shape Up labels
  PERFORM seed_default_labels(NEW.id);

  -- Default channels: #general + #announcements
  PERFORM seed_default_channels(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't_tenant_created') THEN
    CREATE TRIGGER t_tenant_created
      AFTER INSERT ON tenants
      FOR EACH ROW EXECUTE FUNCTION on_tenant_created();
  END IF;
END $$;


-- ============================================================
-- §19  ADDITIONAL SEED: workspace_permissions granular actions
-- ============================================================

CREATE OR REPLACE FUNCTION seed_workspace_permissions(p_tenant_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO workspace_permissions (tenant_id, role, action, granted) VALUES
    -- Member permissions
    (p_tenant_id, 'member', 'create_issues',              true),
    (p_tenant_id, 'member', 'edit_own_issues',            true),
    (p_tenant_id, 'member', 'delete_own_issues',          true),
    (p_tenant_id, 'member', 'comment_on_issues',          true),
    (p_tenant_id, 'member', 'create_private_channels',    true),
    (p_tenant_id, 'member', 'invite_members',             true),
    (p_tenant_id, 'member', 'create_teams',               true),
    (p_tenant_id, 'member', 'manage_labels',              true),
    (p_tenant_id, 'member', 'create_api_keys',            true),
    (p_tenant_id, 'member', 'create_docs',                true),
    (p_tenant_id, 'member', 'publish_docs',               true),
    (p_tenant_id, 'member', 'log_time',                   true),
    (p_tenant_id, 'member', 'use_ai',                     true),
    (p_tenant_id, 'member', 'interact_with_ai_agents',    true),
    (p_tenant_id, 'member', 'use_ide',                    true),
    (p_tenant_id, 'member', 'create_sprints',             false),
    (p_tenant_id, 'member', 'manage_billing',             false),
    (p_tenant_id, 'member', 'manage_integrations',        false),
    (p_tenant_id, 'member', 'delete_workspace',           false),
    -- Guest permissions
    (p_tenant_id, 'guest',  'create_issues',              false),
    (p_tenant_id, 'guest',  'edit_own_issues',            true),
    (p_tenant_id, 'guest',  'comment_on_issues',          true),
    (p_tenant_id, 'guest',  'create_private_channels',    false),
    (p_tenant_id, 'guest',  'invite_members',             false),
    (p_tenant_id, 'guest',  'create_docs',                false),
    (p_tenant_id, 'guest',  'publish_docs',               false),
    (p_tenant_id, 'guest',  'log_time',                   true),
    (p_tenant_id, 'guest',  'use_ai',                     false),
    (p_tenant_id, 'guest',  'interact_with_ai_agents',    false),
    (p_tenant_id, 'guest',  'use_ide',                    false),
    (p_tenant_id, 'guest',  'manage_labels',              false),
    (p_tenant_id, 'guest',  'create_api_keys',            false)
  ON CONFLICT (tenant_id, role, action) DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- §20  INDEXES for new tables
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue    ON issue_comments(issue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_issue_links_issue        ON issue_links(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_relations_source   ON issue_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_issue_relations_target   ON issue_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_labels_tenant            ON labels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cycles_project           ON cycles(project_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant       ON mcp_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_date   ON agent_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_skills_surface        ON ai_skills(surface, enabled);
CREATE INDEX IF NOT EXISTS idx_channel_files_channel    ON channel_files(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_user        ON time_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_slug           ON documents(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issues_public_slug       ON issues(public_slug) WHERE public_slug IS NOT NULL;

-- Full-text search on comments
CREATE INDEX IF NOT EXISTS idx_issue_comments_fts ON issue_comments
  USING gin(to_tsvector('english', body));


-- ============================================================
-- END OF GAP PATCH
-- New tables: issue_comments, issue_links, issue_relations,
--   cycles, labels, issue_labels, channel_files, channel_pins,
--   doc_versions, time_entries, mcp_servers, agent_runs,
--   ai_skills, ide_settings, import_jobs, keybindings
-- New columns on: issues, issue_files, chat_channels,
--   chat_messages, documents, time_logs
-- New functions: get_or_create_dm_channel, mark_channel_read,
--   publish_document, seed_default_labels, seed_default_channels,
--   seed_workspace_permissions (expanded), can_do_in_project,
--   on_tenant_created (expanded)
-- New views: unread_counts, weekly_timesheets
-- Realtime: 7 new tables added to publication
-- Seed: 50 keybindings, 15 labels, 10 AI skills, 20 permissions
-- ============================================================
