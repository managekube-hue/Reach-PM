-- Collaboration notifications + issue activity bridge for REACH phases 2 and 7.

create table if not exists public.comm_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_comm_notifications_user_unread
  on public.comm_notifications(user_id, read_at, created_at desc);

create table if not exists public.issue_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  issue_key text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  summary text not null,
  source_table text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_issue_activity_workspace_issue_created
  on public.issue_activity(workspace_id, issue_key, created_at desc);

create index if not exists idx_issue_activity_workspace_created
  on public.issue_activity(workspace_id, created_at desc);

create or replace function public.comm_notify_user(
  p_workspace_id uuid,
  p_user_id uuid,
  p_kind text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_notification_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = v_actor
  ) then
    raise exception 'Actor must belong to workspace';
  end if;

  insert into public.comm_notifications (workspace_id, user_id, kind, payload)
  values (p_workspace_id, p_user_id, p_kind, coalesce(p_payload, '{}'::jsonb))
  returning id into v_notification_id;

  return v_notification_id;
end
$$;

grant execute on function public.comm_notify_user(uuid, uuid, text, jsonb) to authenticated;

create or replace function public.comm_mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  update public.comm_notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = v_actor;

  return found;
end
$$;

grant execute on function public.comm_mark_notification_read(uuid) to authenticated;

create or replace function public.capture_issue_status_activity()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    insert into public.issue_activity (
      workspace_id,
      issue_key,
      actor_user_id,
      action,
      summary,
      source_table,
      source_id
    )
    values (
      new.workspace_id,
      new.issue_key,
      auth.uid(),
      'status_changed',
      format('Status moved from %s to %s', old.status, new.status),
      'reach_issues',
      new.id
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_reach_issues_status_activity on public.reach_issues;
create trigger trg_reach_issues_status_activity
after update on public.reach_issues
for each row
execute function public.capture_issue_status_activity();

alter table public.comm_notifications enable row level security;
alter table public.issue_activity enable row level security;

drop policy if exists comm_notifications_select_owner on public.comm_notifications;
create policy comm_notifications_select_owner
on public.comm_notifications
for select
using (user_id = auth.uid());

drop policy if exists comm_notifications_insert_member on public.comm_notifications;
create policy comm_notifications_insert_member
on public.comm_notifications
for insert
with check (public.comm_is_workspace_member(workspace_id, auth.uid()));

drop policy if exists comm_notifications_update_owner on public.comm_notifications;
create policy comm_notifications_update_owner
on public.comm_notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists issue_activity_select_workspace_member on public.issue_activity;
create policy issue_activity_select_workspace_member
on public.issue_activity
for select
using (public.comm_is_workspace_member(workspace_id, auth.uid()));

drop policy if exists issue_activity_insert_workspace_member on public.issue_activity;
create policy issue_activity_insert_workspace_member
on public.issue_activity
for insert
with check (public.comm_is_workspace_member(workspace_id, auth.uid()));
