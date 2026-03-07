create extension if not exists pgcrypto;

-- Communication primitives aligned to issue-centric orchestration.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'comm_conversation_kind' and n.nspname = 'public'
  ) then
    create type public.comm_conversation_kind as enum ('channel', 'dm', 'group_dm', 'issue_room', 'system');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'comm_message_kind' and n.nspname = 'public'
  ) then
    create type public.comm_message_kind as enum ('message', 'system', 'command', 'meeting_event');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'comm_presence_status' and n.nspname = 'public'
  ) then
    create type public.comm_presence_status as enum ('online', 'available', 'out_of_office', 'last_seen', 'offline');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'meeting_status' and n.nspname = 'public'
  ) then
    create type public.meeting_status as enum ('scheduled', 'started', 'ended', 'cancelled');
  end if;
end
$$;

create table if not exists public.reach_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  issue_key text not null,
  title text not null,
  description text not null default '',
  status text not null default 'open',
  assignee_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, issue_key)
);

create table if not exists public.comm_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind public.comm_conversation_kind not null,
  name text not null,
  slug text,
  topic text not null default '',
  is_private boolean not null default false,
  issue_key text,
  direct_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comm_conversation_members (
  conversation_id uuid not null references public.comm_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  notification_level text not null default 'all' check (notification_level in ('all', 'mentions', 'mute')),
  joined_at timestamptz not null default now(),
  last_read_message_id uuid,
  primary key (conversation_id, user_id)
);

create table if not exists public.comm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.comm_conversations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  kind public.comm_message_kind not null default 'message',
  body text not null,
  parent_message_id uuid references public.comm_messages(id) on delete set null,
  issue_key text,
  mentions jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  command_name text,
  command_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.comm_issue_threads (
  issue_key text not null,
  message_id uuid not null references public.comm_messages(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (issue_key, message_id)
);

create table if not exists public.user_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  filter jsonb not null default '{}'::jsonb,
  type text not null check (type in ('channel', 'dm', 'issue-thread')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  issue_key text not null,
  message_id uuid references public.comm_messages(id) on delete set null,
  file_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.comm_presence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.comm_presence_status not null default 'online',
  availability_text text not null default '',
  issue_key text,
  file_path text,
  line_number integer,
  cursor_meta jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.comm_meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.comm_conversations(id) on delete set null,
  issue_key text,
  title text not null,
  scheduled_for timestamptz not null,
  duration_minutes integer not null default 30,
  status public.meeting_status not null default 'scheduled',
  meeting_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comm_meeting_participants (
  meeting_id uuid not null references public.comm_meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined', 'tentative')),
  joined_at timestamptz,
  left_at timestamptz,
  primary key (meeting_id, user_id)
);

create index if not exists idx_comm_conversations_workspace on public.comm_conversations(workspace_id, kind, created_at desc);
create index if not exists idx_comm_messages_conversation on public.comm_messages(conversation_id, created_at);
create index if not exists idx_comm_messages_issue_key on public.comm_messages(issue_key, created_at);
create index if not exists idx_comm_presence_workspace_status on public.comm_presence(workspace_id, status, updated_at desc);
create index if not exists idx_comm_meetings_workspace on public.comm_meetings(workspace_id, scheduled_for desc);

create or replace function public.extract_issue_key(p_body text)
returns text
language plpgsql
immutable
as $$
declare
  m text[];
begin
  if p_body is null then
    return null;
  end if;

  m := regexp_match(p_body, '@issue\\s+([A-Za-z0-9_-]+)', 'i');
  if m is null or array_length(m, 1) is null then
    return null;
  end if;

  return m[1];
end
$$;

create or replace function public.comm_is_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  );
$$;

create or replace function public.comm_can_access_conversation(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.comm_conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
  );
$$;

create or replace function public.comm_sync_issue_thread()
returns trigger
language plpgsql
as $$
begin
  if new.issue_key is not null and btrim(new.issue_key) <> '' then
    insert into public.comm_issue_threads(issue_key, message_id, workspace_id)
    values (new.issue_key, new.id, new.workspace_id)
    on conflict do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists trg_comm_messages_sync_issue_thread on public.comm_messages;
create trigger trg_comm_messages_sync_issue_thread
after insert on public.comm_messages
for each row
execute function public.comm_sync_issue_thread();

create or replace function public.comm_open_direct_conversation(
  p_workspace_id uuid,
  p_target_user_id uuid,
  p_issue_key text default null,
  p_target_workspace_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_key text;
  v_target_workspace uuid := coalesce(p_target_workspace_id, p_workspace_id);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.comm_is_workspace_member(p_workspace_id, v_user_id) then
    raise exception 'Not a member of source workspace';
  end if;

  if not public.comm_is_workspace_member(v_target_workspace, p_target_user_id) then
    raise exception 'Target user is not a member of target workspace';
  end if;

  v_key := concat(
    'dm:',
    coalesce(nullif(trim(p_issue_key), ''), 'none'),
    ':',
    least(v_user_id::text, p_target_user_id::text),
    ':',
    greatest(v_user_id::text, p_target_user_id::text)
  );

  select c.id into v_conversation_id
  from public.comm_conversations c
  where c.direct_key = v_key
  limit 1;

  if v_conversation_id is null then
    insert into public.comm_conversations (
      workspace_id,
      kind,
      name,
      slug,
      topic,
      is_private,
      issue_key,
      direct_key,
      metadata,
      created_by
    ) values (
      p_workspace_id,
      'dm',
      'Direct message',
      null,
      '',
      true,
      nullif(trim(p_issue_key), ''),
      v_key,
      jsonb_build_object(
        'scope', case when p_workspace_id = v_target_workspace then 'single_workspace' else 'cross_workspace' end,
        'source_workspace_id', p_workspace_id,
        'target_workspace_id', v_target_workspace
      ),
      v_user_id
    ) returning id into v_conversation_id;

    insert into public.comm_conversation_members (conversation_id, user_id, workspace_id, role)
    values
      (v_conversation_id, v_user_id, p_workspace_id, 'owner'),
      (v_conversation_id, p_target_user_id, v_target_workspace, 'member')
    on conflict do nothing;
  end if;

  return v_conversation_id;
end
$$;

grant execute on function public.comm_open_direct_conversation(uuid, uuid, text, uuid) to authenticated;

create or replace function public.comm_send_message(
  p_conversation_id uuid,
  p_body text,
  p_parent_message_id uuid default null,
  p_kind public.comm_message_kind default 'message',
  p_command_name text default null,
  p_command_payload jsonb default '{}'::jsonb,
  p_attachments jsonb default '[]'::jsonb
)
returns public.comm_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.comm_messages;
  v_workspace_id uuid;
  v_issue_key text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.comm_can_access_conversation(p_conversation_id, v_user_id) then
    raise exception 'User does not belong to conversation';
  end if;

  select c.workspace_id, coalesce(nullif(c.issue_key, ''), public.extract_issue_key(p_body))
    into v_workspace_id, v_issue_key
  from public.comm_conversations c
  where c.id = p_conversation_id;

  insert into public.comm_messages (
    conversation_id,
    workspace_id,
    sender_user_id,
    kind,
    body,
    parent_message_id,
    issue_key,
    command_name,
    command_payload,
    attachments
  ) values (
    p_conversation_id,
    v_workspace_id,
    v_user_id,
    p_kind,
    coalesce(p_body, ''),
    p_parent_message_id,
    v_issue_key,
    p_command_name,
    coalesce(p_command_payload, '{}'::jsonb),
    coalesce(p_attachments, '[]'::jsonb)
  ) returning * into v_row;

  return v_row;
end
$$;

grant execute on function public.comm_send_message(uuid, text, uuid, public.comm_message_kind, text, jsonb, jsonb) to authenticated;

create or replace function public.comm_schedule_meeting(
  p_workspace_id uuid,
  p_title text,
  p_scheduled_for timestamptz,
  p_duration_minutes integer,
  p_participant_ids uuid[],
  p_conversation_id uuid default null,
  p_issue_key text default null,
  p_participant_workspaces jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_meeting_id uuid;
  v_participant uuid;
  v_workspace uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.comm_is_workspace_member(p_workspace_id, v_user_id) then
    raise exception 'Not a member of host workspace';
  end if;

  insert into public.comm_meetings (
    workspace_id,
    conversation_id,
    issue_key,
    title,
    scheduled_for,
    duration_minutes,
    status,
    created_by
  ) values (
    p_workspace_id,
    p_conversation_id,
    nullif(trim(p_issue_key), ''),
    p_title,
    p_scheduled_for,
    greatest(5, coalesce(p_duration_minutes, 30)),
    'scheduled',
    v_user_id
  ) returning id into v_meeting_id;

  insert into public.comm_meeting_participants (meeting_id, user_id, workspace_id, response)
  values (v_meeting_id, v_user_id, p_workspace_id, 'accepted')
  on conflict do nothing;

  foreach v_participant in array coalesce(p_participant_ids, '{}')
  loop
    if v_participant = v_user_id then
      continue;
    end if;

    select (item->>'workspace_id')::uuid into v_workspace
    from jsonb_array_elements(coalesce(p_participant_workspaces, '[]'::jsonb)) item
    where (item->>'user_id')::uuid = v_participant
    limit 1;

    v_workspace := coalesce(v_workspace, p_workspace_id);

    insert into public.comm_meeting_participants (meeting_id, user_id, workspace_id, response)
    values (v_meeting_id, v_participant, v_workspace, 'pending')
    on conflict do nothing;
  end loop;

  return v_meeting_id;
end
$$;

grant execute on function public.comm_schedule_meeting(uuid, text, timestamptz, integer, uuid[], uuid, text, jsonb) to authenticated;

alter table public.reach_issues enable row level security;
alter table public.comm_conversations enable row level security;
alter table public.comm_conversation_members enable row level security;
alter table public.comm_messages enable row level security;
alter table public.comm_issue_threads enable row level security;
alter table public.user_saved_views enable row level security;
alter table public.issue_attachments enable row level security;
alter table public.comm_presence enable row level security;
alter table public.comm_meetings enable row level security;
alter table public.comm_meeting_participants enable row level security;

drop policy if exists reach_issues_select_member on public.reach_issues;
create policy reach_issues_select_member
on public.reach_issues
for select
using (public.comm_is_workspace_member(workspace_id, auth.uid()));

drop policy if exists reach_issues_insert_member on public.reach_issues;
create policy reach_issues_insert_member
on public.reach_issues
for insert
with check (public.comm_is_workspace_member(workspace_id, auth.uid()) and created_by = auth.uid());

drop policy if exists reach_issues_update_member on public.reach_issues;
create policy reach_issues_update_member
on public.reach_issues
for update
using (public.comm_is_workspace_member(workspace_id, auth.uid()))
with check (public.comm_is_workspace_member(workspace_id, auth.uid()));

drop policy if exists comm_conversations_select_member on public.comm_conversations;
create policy comm_conversations_select_member
on public.comm_conversations
for select
using (public.comm_can_access_conversation(id, auth.uid()));

drop policy if exists comm_conversations_insert_member on public.comm_conversations;
create policy comm_conversations_insert_member
on public.comm_conversations
for insert
with check (
  created_by = auth.uid()
  and (workspace_id is null or public.comm_is_workspace_member(workspace_id, auth.uid()))
);

drop policy if exists comm_conversations_update_owner on public.comm_conversations;
create policy comm_conversations_update_owner
on public.comm_conversations
for update
using (
  exists (
    select 1
    from public.comm_conversation_members cm
    where cm.conversation_id = public.comm_conversations.id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.comm_conversation_members cm
    where cm.conversation_id = public.comm_conversations.id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  )
);

drop policy if exists comm_conversation_members_select_member on public.comm_conversation_members;
create policy comm_conversation_members_select_member
on public.comm_conversation_members
for select
using (public.comm_can_access_conversation(conversation_id, auth.uid()));

drop policy if exists comm_conversation_members_insert_owner on public.comm_conversation_members;
create policy comm_conversation_members_insert_owner
on public.comm_conversation_members
for insert
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.comm_conversation_members cm
    where cm.conversation_id = public.comm_conversation_members.conversation_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  )
);

drop policy if exists comm_messages_select_member on public.comm_messages;
create policy comm_messages_select_member
on public.comm_messages
for select
using (public.comm_can_access_conversation(conversation_id, auth.uid()));

drop policy if exists comm_messages_insert_sender on public.comm_messages;
create policy comm_messages_insert_sender
on public.comm_messages
for insert
with check (
  sender_user_id = auth.uid()
  and public.comm_can_access_conversation(conversation_id, auth.uid())
);

drop policy if exists comm_messages_update_sender on public.comm_messages;
create policy comm_messages_update_sender
on public.comm_messages
for update
using (sender_user_id = auth.uid())
with check (sender_user_id = auth.uid());

drop policy if exists comm_issue_threads_select_member on public.comm_issue_threads;
create policy comm_issue_threads_select_member
on public.comm_issue_threads
for select
using (
  workspace_id is null
  or public.comm_is_workspace_member(workspace_id, auth.uid())
);

drop policy if exists user_saved_views_select_owner on public.user_saved_views;
create policy user_saved_views_select_owner
on public.user_saved_views
for select
using (user_id = auth.uid());

drop policy if exists user_saved_views_insert_owner on public.user_saved_views;
create policy user_saved_views_insert_owner
on public.user_saved_views
for insert
with check (user_id = auth.uid());

drop policy if exists user_saved_views_update_owner on public.user_saved_views;
create policy user_saved_views_update_owner
on public.user_saved_views
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists issue_attachments_select_member on public.issue_attachments;
create policy issue_attachments_select_member
on public.issue_attachments
for select
using (
  workspace_id is null
  or public.comm_is_workspace_member(workspace_id, auth.uid())
);

drop policy if exists issue_attachments_insert_uploader on public.issue_attachments;
create policy issue_attachments_insert_uploader
on public.issue_attachments
for insert
with check (uploaded_by = auth.uid());

drop policy if exists comm_presence_select_member on public.comm_presence;
create policy comm_presence_select_member
on public.comm_presence
for select
using (public.comm_is_workspace_member(workspace_id, auth.uid()));

drop policy if exists comm_presence_upsert_own on public.comm_presence;
create policy comm_presence_upsert_own
on public.comm_presence
for insert
with check (user_id = auth.uid() and public.comm_is_workspace_member(workspace_id, auth.uid()));

drop policy if exists comm_presence_update_own on public.comm_presence;
create policy comm_presence_update_own
on public.comm_presence
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists comm_meetings_select_participant on public.comm_meetings;
create policy comm_meetings_select_participant
on public.comm_meetings
for select
using (
  exists (
    select 1
    from public.comm_meeting_participants mp
    where mp.meeting_id = public.comm_meetings.id
      and mp.user_id = auth.uid()
  )
  or public.comm_is_workspace_member(workspace_id, auth.uid())
);

drop policy if exists comm_meetings_insert_member on public.comm_meetings;
create policy comm_meetings_insert_member
on public.comm_meetings
for insert
with check (
  created_by = auth.uid()
  and public.comm_is_workspace_member(workspace_id, auth.uid())
);

drop policy if exists comm_meeting_participants_select_participant on public.comm_meeting_participants;
create policy comm_meeting_participants_select_participant
on public.comm_meeting_participants
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.comm_meetings m
    where m.id = public.comm_meeting_participants.meeting_id
      and m.created_by = auth.uid()
  )
);

drop policy if exists comm_meeting_participants_insert_creator on public.comm_meeting_participants;
create policy comm_meeting_participants_insert_creator
on public.comm_meeting_participants
for insert
with check (
  exists (
    select 1
    from public.comm_meetings m
    where m.id = public.comm_meeting_participants.meeting_id
      and m.created_by = auth.uid()
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.comm_messages;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.comm_presence;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.comm_meetings;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.comm_meeting_participants;
  exception when duplicate_object then null;
  end;
end
$$;
