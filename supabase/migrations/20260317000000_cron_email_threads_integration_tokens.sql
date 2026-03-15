-- Migration: 20260317000000_cron_email_threads_integration_tokens.sql
-- Spec Part 2.7, 2.9, Part 22
-- Creates: email_threads, integration_tokens tables + 7 pg_cron jobs

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ─── email_threads ────────────────────────────────────────────────────────────
create table if not exists public.email_threads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id)  on delete cascade,
  tenant_id     uuid not null references public.tenants(id)   on delete cascade,
  issue_id      uuid references public.issues(id)             on delete set null,
  provider      text not null check (provider in ('google','microsoft')),
  message_id    text not null,
  thread_id     text,
  subject       text,
  from_email    text,
  from_name     text,
  body_preview  text,
  body_html     text,
  received_at   timestamptz,
  is_read       boolean not null default false,
  labels        text[]  not null default '{}',
  raw_metadata  jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists email_threads_user_provider_msg
  on public.email_threads(user_id, provider, message_id);

create index if not exists email_threads_tenant_idx  on public.email_threads(tenant_id);
create index if not exists email_threads_issue_idx   on public.email_threads(issue_id);
create index if not exists email_threads_received_idx on public.email_threads(received_at desc);

alter table public.email_threads enable row level security;

create policy "email_threads_owner" on public.email_threads
  for all using (user_id = auth.uid());

-- ─── integration_tokens ───────────────────────────────────────────────────────
create table if not exists public.integration_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id)  on delete cascade,
  tenant_id     uuid references public.tenants(id)            on delete cascade,
  provider      text not null check (provider in ('google','microsoft','zoom')),
  access_token  text not null,
  refresh_token text,
  token_expiry  timestamptz,
  scopes        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists integration_tokens_user_provider
  on public.integration_tokens(user_id, provider);

alter table public.integration_tokens enable row level security;

create policy "integration_tokens_owner" on public.integration_tokens
  for all using (user_id = auth.uid());

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_integration_tokens_updated_at'
  ) then
    create trigger set_integration_tokens_updated_at
      before update on public.integration_tokens
      for each row execute procedure public.set_updated_at();
  end if;
end;
$$;

-- zoom_connected flag on profiles (if not already present)
alter table public.profiles add column if not exists zoom_connected boolean not null default false;

-- ─── pg_cron jobs ─────────────────────────────────────────────────────────────
-- Store connection details so cron jobs can call Edge Functions
alter database postgres set "app.supabase_url"          to '';  -- filled by env
alter database postgres set "app.service_role_key"      to '';  -- filled by env

-- 1. Refresh OAuth tokens every 30 minutes
select cron.schedule(
  'refresh-oauth-tokens',
  '*/30 * * * *',
  $$
    select net.http_post(
      url      := current_setting('app.supabase_url') || '/functions/v1/refresh-oauth-tokens',
      headers  := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body     := '{}'::jsonb
    )
  $$
);

-- 2. Purge old WebRTC signals every 15 minutes
select cron.schedule(
  'purge-webrtc-signals',
  '*/15 * * * *',
  $$
    delete from public.webrtc_signals
    where created_at < now() - interval '2 hours'
  $$
);

-- 3. Cleanup notifications older than 90 days, daily at 02:00
select cron.schedule(
  'cleanup-notifications',
  '0 2 * * *',
  $$
    delete from public.notifications
    where created_at < now() - interval '90 days'
  $$
);

-- 4. Purge soft-deleted messages older than 30 days, weekly Sunday 03:00
select cron.schedule(
  'purge-deleted-messages',
  '0 3 * * 0',
  $$
    delete from public.messages
    where deleted = true
      and deleted_at < now() - interval '30 days'
  $$
);

-- 5. End stuck meetings (live for > 4 hours), every 30 minutes
select cron.schedule(
  'end-stuck-meetings',
  '*/30 * * * *',
  $$
    update public.meetings
    set status = 'ended', ended_at = now()
    where status = 'live'
      and started_at < now() - interval '4 hours'
  $$
);

-- 6. Standup reminder, weekdays 09:00
select cron.schedule(
  'standup-reminder',
  '0 9 * * 1-5',
  $$
    insert into public.notifications (user_id, tenant_id, type, title, body)
    select
      p.id,
      p.tenant_id,
      'standup_reminder',
      'Daily Standup Reminder',
      'Your daily standup is starting soon.'
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
    where t.standup_reminders = true
      and p.id not in (
        select user_id from public.notifications
        where type = 'standup_reminder'
          and created_at > now() - interval '12 hours'
      )
  $$
);

-- 7. Sync emails every 5 minutes
select cron.schedule(
  'sync-emails',
  '*/5 * * * *',
  $$
    select net.http_post(
      url      := current_setting('app.supabase_url') || '/functions/v1/sync-emails',
      headers  := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body     := '{}'::jsonb
    )
  $$
);
