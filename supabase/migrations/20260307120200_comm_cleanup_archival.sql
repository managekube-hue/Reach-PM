-- Persistent pinned messages, data cleanup helpers, and optional pg_cron schedules.
-- Run `npx supabase db push --project-ref <ref>` to apply to your remote project.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. comm_pinned_messages  – persist pins to DB instead of localStorage
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.comm_pinned_messages (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.comm_conversations(id) on delete cascade,
  message_id      uuid not null references public.comm_messages(id) on delete cascade,
  pinned_by       uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (conversation_id, message_id)
);

alter table public.comm_pinned_messages enable row level security;

drop policy if exists comm_pinned_select on public.comm_pinned_messages;
create policy comm_pinned_select on public.comm_pinned_messages for select
  using (public.comm_can_access_conversation(conversation_id, auth.uid()));

drop policy if exists comm_pinned_insert on public.comm_pinned_messages;
create policy comm_pinned_insert on public.comm_pinned_messages for insert
  with check (
    public.comm_can_access_conversation(conversation_id, auth.uid())
    and pinned_by = auth.uid()
  );

drop policy if exists comm_pinned_delete on public.comm_pinned_messages;
create policy comm_pinned_delete on public.comm_pinned_messages for delete
  using (public.comm_can_access_conversation(conversation_id, auth.uid()));

create index if not exists idx_comm_pinned_conversation
  on public.comm_pinned_messages (conversation_id);

-- RPC: pin a message (idempotent)
create or replace function public.comm_pin_message(
  p_conversation_id uuid,
  p_message_id      uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_workspace  uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.comm_can_access_conversation(p_conversation_id, v_actor) then
    raise exception 'Not a conversation member';
  end if;

  select workspace_id into v_workspace
    from public.comm_conversations
   where id = p_conversation_id;

  insert into public.comm_pinned_messages (workspace_id, conversation_id, message_id, pinned_by)
  values (v_workspace, p_conversation_id, p_message_id, v_actor)
  on conflict (conversation_id, message_id) do nothing;

  return true;
end
$$;

grant execute on function public.comm_pin_message(uuid, uuid) to authenticated;

-- RPC: unpin a message
create or replace function public.comm_unpin_message(
  p_conversation_id uuid,
  p_message_id      uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  delete from public.comm_pinned_messages
   where conversation_id = p_conversation_id
     and message_id      = p_message_id
     and public.comm_can_access_conversation(p_conversation_id, v_actor);

  return found;
end
$$;

grant execute on function public.comm_unpin_message(uuid, uuid) to authenticated;

-- RPC: list pinned message IDs for a conversation (used by the frontend)
create or replace function public.comm_get_pinned_messages(p_conversation_id uuid)
returns table (message_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.comm_can_access_conversation(p_conversation_id, auth.uid()) then
    raise exception 'Not a conversation member';
  end if;

  return query
  select pm.message_id
    from public.comm_pinned_messages pm
   where pm.conversation_id = p_conversation_id
   order by pm.created_at;
end
$$;

grant execute on function public.comm_get_pinned_messages(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Archive table for old messages (Supabase free-tier buffer)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.comm_messages_archive (like public.comm_messages including all);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Cleanup functions (call manually or schedule with pg_cron on Pro plan)
-- ─────────────────────────────────────────────────────────────────────────────

-- Delete read notifications older than 30 days; unread older than 90 days.
create or replace function public.comm_cleanup_old_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.comm_notifications
   where (read_at is not null and read_at    < now() - interval '30 days')
      or (read_at is null     and created_at < now() - interval '90 days');

  get diagnostics deleted_count = row_count;
  return deleted_count;
end
$$;

grant execute on function public.comm_cleanup_old_notifications() to service_role;

-- Archive messages older than p_days_old days and remove them from the live table.
create or replace function public.comm_archive_old_messages(p_days_old integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  archived_count integer := 0;
begin
  -- Copy to archive (idempotent)
  insert into public.comm_messages_archive
  select *
    from public.comm_messages
   where created_at < now() - (p_days_old || ' days')::interval
     and deleted_at is null
  on conflict do nothing;

  get diagnostics archived_count = row_count;

  -- Remove from live table only what was successfully archived
  delete from public.comm_messages
   where created_at < now() - (p_days_old || ' days')::interval
     and deleted_at is null
     and id in (select id from public.comm_messages_archive);

  return archived_count;
end
$$;

grant execute on function public.comm_archive_old_messages(integer) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. pg_cron schedules (Pro plan only – uncomment after upgrading)
--
--   select cron.schedule(
--     'nightly-notification-cleanup',
--     '0 3 * * *',
--     $$select public.comm_cleanup_old_notifications()$$
--   );
--
--   select cron.schedule(
--     'weekly-message-archive',
--     '0 4 * * 0',
--     $$select public.comm_archive_old_messages(90)$$
--   );
--
-- For the FREE tier, invoke these via a scheduled GitHub Actions workflow:
--   curl -X POST <SUPABASE_URL>/functions/v1/comm-maintenance \
--     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
-- ─────────────────────────────────────────────────────────────────────────────
