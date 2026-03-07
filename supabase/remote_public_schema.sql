


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."comm_conversation_kind" AS ENUM (
    'channel',
    'dm',
    'group_dm',
    'issue_room',
    'system'
);


ALTER TYPE "public"."comm_conversation_kind" OWNER TO "postgres";


CREATE TYPE "public"."comm_message_kind" AS ENUM (
    'message',
    'system',
    'command',
    'meeting_event'
);


ALTER TYPE "public"."comm_message_kind" OWNER TO "postgres";


CREATE TYPE "public"."comm_presence_status" AS ENUM (
    'online',
    'available',
    'out_of_office',
    'last_seen',
    'offline'
);


ALTER TYPE "public"."comm_presence_status" OWNER TO "postgres";


CREATE TYPE "public"."meeting_status" AS ENUM (
    'scheduled',
    'started',
    'ended',
    'cancelled'
);


ALTER TYPE "public"."meeting_status" OWNER TO "postgres";


CREATE TYPE "public"."workspace_role" AS ENUM (
    'owner',
    'admin',
    'employee'
);


ALTER TYPE "public"."workspace_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_issue_status_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."capture_issue_status_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_archive_old_messages"("p_days_old" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_archive_old_messages"("p_days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_bootstrap_workspace_context"("p_preferred_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "is_default" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
#variable_conflict use_column
declare
  v_actor uuid;
  v_actor_email text;
  v_display_name text;
  v_default_workspace_id uuid;
  v_workspace_slug text;
  v_workspace_name text;
  v_workspace_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required: no authenticated session.';
  end if;

  -- Prefer profile record over auth.users (avoids permission issues)
  select p.email, p.display_name, p.default_workspace_id
    into v_actor_email, v_display_name, v_default_workspace_id
  from public.profiles p
  where p.id = v_actor;

  -- Fall back to auth.users if profile is missing
  if v_display_name is null then
    begin
      select u.email,
             coalesce(
               u.raw_user_meta_data->>'full_name',
               u.raw_user_meta_data->>'name',
               split_part(coalesce(u.email, ''), '@', 1)
             )
        into v_actor_email, v_display_name
      from auth.users u
      where u.id = v_actor;
    exception when others then
      v_actor_email := null;
      v_display_name := null;
    end;
  end if;

  -- Create a workspace if this user has none
  if not exists (
    select 1 from public.workspace_members wm where wm.user_id = v_actor
  ) then
    v_workspace_slug := coalesce(nullif(lower(btrim(p_preferred_slug)), ''), 'ws-' || substr(v_actor::text, 1, 12));
    v_workspace_slug := regexp_replace(v_workspace_slug, '[^a-z0-9-]+', '-', 'g');
    v_workspace_slug := regexp_replace(v_workspace_slug, '(^-+|-+$)', '', 'g');

    if v_workspace_slug = '' then
      v_workspace_slug := 'ws-' || substr(v_actor::text, 1, 12);
    end if;

    -- Prevent generic slug collisions across users
    if v_workspace_slug in ('default-workspace', 'workspace', 'general') then
      v_workspace_slug := v_workspace_slug || '-' || substr(v_actor::text, 1, 8);
    end if;

    v_workspace_name := coalesce(nullif(v_display_name, ''), 'User') || '''s Workspace';

    -- Use constraint name to avoid "slug is ambiguous" (OUT param vs column)
    insert into public.workspaces (slug, name, owner_user_id, owner_id)
    values (v_workspace_slug, v_workspace_name, v_actor, v_actor)
    on conflict on constraint workspaces_slug_key do update
      set owner_user_id = coalesce(workspaces.owner_user_id, excluded.owner_user_id)
    returning workspaces.id into v_workspace_id;

    if v_workspace_id is null then
      select w.id into v_workspace_id
      from public.workspaces w
      where w.slug = v_workspace_slug
      limit 1;
    end if;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_actor, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';

    v_default_workspace_id := coalesce(v_default_workspace_id, v_workspace_id);
  end if;

  -- Resolve preferred slug
  if v_default_workspace_id is null and nullif(lower(btrim(p_preferred_slug)), '') is not null then
    select w.id into v_default_workspace_id
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = v_actor
    where lower(w.slug) = lower(btrim(p_preferred_slug))
    limit 1;
  end if;

  -- Fall back to oldest membership
  if v_default_workspace_id is null then
    select wm.workspace_id into v_default_workspace_id
    from public.workspace_members wm
    where wm.user_id = v_actor
    order by wm.joined_at asc
    limit 1;
  end if;

  -- Upsert profile (use constraint name to avoid "id is ambiguous")
  insert into public.profiles (id, email, display_name, default_workspace_id)
  values (v_actor, v_actor_email, v_display_name, v_default_workspace_id)
  on conflict on constraint profiles_pkey do update
    set email        = coalesce(profiles.email, excluded.email),
        display_name = coalesce(profiles.display_name, excluded.display_name),
        default_workspace_id = coalesce(profiles.default_workspace_id, excluded.default_workspace_id);

  -- Return all workspaces the user belongs to
  return query
  select w.id,
         w.name,
         w.slug,
         (w.id = v_default_workspace_id) as is_default
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = v_actor
  order by (w.id = v_default_workspace_id) desc, w.created_at asc;

exception when others then
  raise exception 'comm_bootstrap_workspace_context failed: % (SQLSTATE: %)', sqlerrm, sqlstate;
end
$_$;


ALTER FUNCTION "public"."comm_bootstrap_workspace_context"("p_preferred_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_can_access_conversation"("p_conversation_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.comm_conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."comm_can_access_conversation"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_cleanup_old_notifications"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_create_channel"("p_workspace_id" "uuid", "p_name" "text", "p_topic" "text" DEFAULT ''::"text", "p_is_private" boolean DEFAULT false, "p_slug" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "kind" "public"."comm_conversation_kind", "workspace_id" "uuid", "slug" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_topic text := coalesce(p_topic, '');
  v_slug_base text;
  v_slug text;
  v_suffix integer := 1;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null then
    raise exception 'Channel name is required';
  end if;

  if not public.comm_is_workspace_member(p_workspace_id, v_actor) then
    raise exception 'Not a member of workspace';
  end if;

  v_slug_base := lower(coalesce(nullif(btrim(p_slug), ''), v_name));
  v_slug_base := regexp_replace(v_slug_base, '[^a-z0-9]+', '-', 'g');
  v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');

  if v_slug_base = '' then
    v_slug_base := 'channel';
  end if;

  v_slug := v_slug_base;
  while exists (
    select 1
    from public.comm_conversations c
    where c.workspace_id = p_workspace_id
      and c.kind = 'channel'
      and c.slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_slug_base || '-' || v_suffix::text;
  end loop;

  insert into public.comm_conversations (
    workspace_id,
    kind,
    name,
    slug,
    topic,
    is_private,
    created_by
  ) values (
    p_workspace_id,
    'channel',
    v_name,
    v_slug,
    v_topic,
    coalesce(p_is_private, false),
    v_actor
  ) returning comm_conversations.id into v_id;

  insert into public.comm_conversation_members (conversation_id, user_id, workspace_id, role)
  values (v_id, v_actor, p_workspace_id, 'owner')
  on conflict (conversation_id, user_id) do update
  set role = excluded.role,
      workspace_id = excluded.workspace_id;

  return query
  select c.id, c.name, c.kind, c.workspace_id, c.slug
  from public.comm_conversations c
  where c.id = v_id;
end
$_$;


ALTER FUNCTION "public"."comm_create_channel"("p_workspace_id" "uuid", "p_name" "text", "p_topic" "text", "p_is_private" boolean, "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_ensure_default_channel"("p_workspace_id" "uuid", "p_slug" "text" DEFAULT 'general'::"text", "p_name" "text" DEFAULT 'general'::"text") RETURNS TABLE("id" "uuid", "name" "text", "kind" "public"."comm_conversation_kind", "workspace_id" "uuid", "slug" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_slug text := lower(coalesce(nullif(btrim(p_slug), ''), 'general'));
  v_name text := coalesce(nullif(btrim(p_name), ''), 'general');
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.comm_is_workspace_member(p_workspace_id, v_actor) then
    raise exception 'Not a member of workspace';
  end if;

  select c.id
  into v_id
  from public.comm_conversations c
  where c.workspace_id = p_workspace_id
    and c.kind = 'channel'
    and c.slug = v_slug
  order by c.created_at asc
  limit 1;

  if v_id is null then
    insert into public.comm_conversations (
      workspace_id,
      kind,
      name,
      slug,
      topic,
      is_private,
      created_by
    ) values (
      p_workspace_id,
      'channel',
      v_name,
      v_slug,
      'Workspace default channel',
      false,
      v_actor
    ) returning comm_conversations.id into v_id;
  end if;

  insert into public.comm_conversation_members (conversation_id, user_id, workspace_id, role)
  values (v_id, v_actor, p_workspace_id, 'owner')
  on conflict (conversation_id, user_id) do update
  set role = excluded.role,
      workspace_id = excluded.workspace_id;

  return query
  select c.id, c.name, c.kind, c.workspace_id, c.slug
  from public.comm_conversations c
  where c.id = v_id;
end
$$;


ALTER FUNCTION "public"."comm_ensure_default_channel"("p_workspace_id" "uuid", "p_slug" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_fan_out_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_member_row  record;
  v_conv_name   text;
  v_sender_name text;
begin
  -- Only fan out for regular chat messages, not system/command events
  if new.kind <> 'message' then
    return new;
  end if;

  -- Resolve conversation display name
  select name
    into v_conv_name
    from public.comm_conversations
   where id = new.conversation_id;

  -- Resolve sender display name from profiles
  select coalesce(
           p.display_name,
           split_part(coalesce(p.email, ''), '@', 1),
           new.sender_user_id::text
         )
    into v_sender_name
    from public.profiles p
   where p.id = new.sender_user_id;

  -- Insert one notification per member who should be notified
  for v_member_row in
    select cm.user_id,
           coalesce(cm.workspace_id, new.workspace_id) as wid
      from public.comm_conversation_members cm
     where cm.conversation_id  = new.conversation_id
       and cm.user_id          <> new.sender_user_id
       and cm.notification_level <> 'mute'
  loop
    insert into public.comm_notifications (workspace_id, user_id, kind, payload)
    values (
      v_member_row.wid,
      v_member_row.user_id,
      'new_message',
      jsonb_build_object(
        'conversation_id',   new.conversation_id,
        'conversation_name', coalesce(v_conv_name, 'channel'),
        'message_id',        new.id,
        'sender_user_id',    new.sender_user_id,
        'sender_name',       coalesce(v_sender_name, 'Someone'),
        'preview',           left(new.body, 120)
      )
    );
  end loop;

  return new;
end
$$;


ALTER FUNCTION "public"."comm_fan_out_message_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_find_user_by_name"("p_name" "text") RETURNS TABLE("user_id" "uuid", "display_name" "text", "email" "text", "default_workspace_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select p.id, p.display_name, p.email, p.default_workspace_id
  from public.profiles p
  where p.display_name ilike '%' || p_name || '%'
     or p.email ilike '%' || p_name || '%'
  order by p.display_name nulls last
  limit 20;
end
$$;


ALTER FUNCTION "public"."comm_find_user_by_name"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_get_pinned_messages"("p_conversation_id" "uuid") RETURNS TABLE("message_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_get_pinned_messages"("p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."comm_is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_join_all_workspaces"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_inserted integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  with inserted as (
    insert into public.workspace_members (workspace_id, user_id, role)
    select w.id, v_actor, 'employee'::public.workspace_role
    from public.workspaces w
    where not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = w.id
        and wm.user_id = v_actor
    )
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end
$$;


ALTER FUNCTION "public"."comm_join_all_workspaces"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_mark_notification_read"("p_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_notify_user"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_kind" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_notify_user"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_kind" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_open_direct_conversation"("p_workspace_id" "uuid", "p_target_user_id" "uuid", "p_issue_key" "text" DEFAULT NULL::"text", "p_target_workspace_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_open_direct_conversation"("p_workspace_id" "uuid", "p_target_user_id" "uuid", "p_issue_key" "text", "p_target_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_pin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_pin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_schedule_meeting"("p_workspace_id" "uuid", "p_title" "text", "p_scheduled_for" timestamp with time zone, "p_duration_minutes" integer, "p_participant_ids" "uuid"[], "p_conversation_id" "uuid" DEFAULT NULL::"uuid", "p_issue_key" "text" DEFAULT NULL::"text", "p_participant_workspaces" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_schedule_meeting"("p_workspace_id" "uuid", "p_title" "text", "p_scheduled_for" timestamp with time zone, "p_duration_minutes" integer, "p_participant_ids" "uuid"[], "p_conversation_id" "uuid", "p_issue_key" "text", "p_participant_workspaces" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."comm_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "sender_user_id" "uuid" NOT NULL,
    "kind" "public"."comm_message_kind" DEFAULT 'message'::"public"."comm_message_kind" NOT NULL,
    "body" "text" NOT NULL,
    "parent_message_id" "uuid",
    "issue_key" "text",
    "mentions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "command_name" "text",
    "command_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."comm_messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_send_message"("p_conversation_id" "uuid", "p_body" "text", "p_parent_message_id" "uuid" DEFAULT NULL::"uuid", "p_kind" "public"."comm_message_kind" DEFAULT 'message'::"public"."comm_message_kind", "p_command_name" "text" DEFAULT NULL::"text", "p_command_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_attachments" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "public"."comm_messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_send_message"("p_conversation_id" "uuid", "p_body" "text", "p_parent_message_id" "uuid", "p_kind" "public"."comm_message_kind", "p_command_name" "text", "p_command_payload" "jsonb", "p_attachments" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."workspace_role" DEFAULT 'employee'::"public"."workspace_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_set_member_role"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_role" "public"."workspace_role") RETURNS "public"."workspace_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_row public.workspace_members;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select wm.role into v_actor_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = v_actor;

  if v_actor_role is null then
    raise exception 'Not a member of workspace';
  end if;

  if v_actor_role not in ('owner', 'admin') then
    raise exception 'Only owner/admin can assign roles';
  end if;

  if p_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'Only owner can assign owner role';
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id
    and user_id = p_user_id
  returning * into v_row;

  if v_row.user_id is null then
    raise exception 'Workspace member not found';
  end if;

  return v_row;
end
$$;


ALTER FUNCTION "public"."comm_set_member_role"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_role" "public"."workspace_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_sync_issue_thread"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.issue_key is not null and btrim(new.issue_key) <> '' then
    insert into public.comm_issue_threads(issue_key, message_id, workspace_id)
    values (new.issue_key, new.id, new.workspace_id)
    on conflict do nothing;
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."comm_sync_issue_thread"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_unpin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."comm_unpin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_workspace_directory"("p_workspace_id" "uuid") RETURNS TABLE("workspace_id" "uuid", "user_id" "uuid", "display_name" "text", "email" "text", "role" "public"."workspace_role", "default_workspace_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this workspace';
  end if;

  return query
  select
    wm.workspace_id,
    wm.user_id,
    coalesce(p.display_name, split_part(coalesce(p.email, ''), '@', 1), wm.user_id::text) as display_name,
    p.email,
    wm.role,
    p.default_workspace_id
  from public.workspace_members wm
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id
  order by coalesce(p.display_name, p.email, wm.user_id::text);
end
$$;


ALTER FUNCTION "public"."comm_workspace_directory"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_workspace_for_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
	workspace_uuid uuid;
	workspace_slug text;
	workspace_name text;
	display_name text;
begin
	workspace_uuid := gen_random_uuid();
	workspace_slug := 'ws-' || substr(new.id::text, 1, 12);
	display_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
	workspace_name := coalesce(display_name, 'Workspace') || '''s Workspace';

	insert into public.workspaces (id, slug, name, owner_user_id, owner_id)
	values (workspace_uuid, workspace_slug, workspace_name, new.id, new.id)
	on conflict (slug) do nothing;

	insert into public.workspace_members (workspace_id, user_id, role)
	select w.id, new.id, 'owner'
	from public.workspaces w
	where w.slug = workspace_slug
	on conflict (workspace_id, user_id) do nothing;

	insert into public.profiles (id, email, display_name, default_workspace_id)
	select new.id, new.email, display_name, w.id
	from public.workspaces w
	where w.slug = workspace_slug
	on conflict (id) do update
		set email = excluded.email,
				display_name = coalesce(public.profiles.display_name, excluded.display_name),
				default_workspace_id = coalesce(public.profiles.default_workspace_id, excluded.default_workspace_id);

	return new;
end
$$;


ALTER FUNCTION "public"."create_default_workspace_for_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_issue_key"("p_body" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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


ALTER FUNCTION "public"."extract_issue_key"("p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."github_login_to_user_id"("login" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT user_id FROM public.github_connections WHERE github_login = login LIMIT 1;
$$;


ALTER FUNCTION "public"."github_login_to_user_id"("login" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  default_workspace_id UUID := '00000000-0000-0000-0000-200000000001'; -- REACH Engineering
BEGIN
  -- 1. Create / update User Profile
  --    ON CONFLICT covers re-runs / duplicate triggers
  INSERT INTO public.user_profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')  -- ← was hard-coded 'member'
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email        = EXCLUDED.email,
        role         = EXCLUDED.role;

  -- 2. Add to default workspace (idempotent)
  INSERT INTO public.workspace_memberships (workspace_id, member_id, role, status)
  VALUES (
    default_workspace_id,
    NEW.id::text,
    'member'
  )
  ON CONFLICT (workspace_id, member_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS NULL OR OLD.assignee_id <> NEW.assignee_id)) THEN
    PERFORM send_notification(NEW.assignee_id,'assignment','New assignment','You were assigned to "' || COALESCE(NEW.title,'Untitled') || '"','/board/' || NEW.board_id::TEXT,auth.uid(),NULL,NEW.id,'issue');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NEW.assignee_id IS NOT NULL) THEN
    PERFORM send_notification(NEW.assignee_id,'status_change','Status updated','"' || COALESCE(NEW.title,'Untitled') || '" moved to ' || NEW.status,'/board/' || NEW.board_id::TEXT,auth.uid(),NULL,NEW.id,'issue');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_notification"("p_recipient_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text" DEFAULT ''::"text", "p_link" "text" DEFAULT NULL::"text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_actor_name" "text" DEFAULT NULL::"text", "p_resource_id" "uuid" DEFAULT NULL::"uuid", "p_resource_type" "text" DEFAULT NULL::"text", "p_workspace_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO notifications (recipient_id, workspace_id, type, title, body, link, actor_id, actor_name, resource_id, resource_type)
  VALUES (p_recipient_id, p_workspace_id, p_type, p_title, p_body, p_link, p_actor_id, p_actor_name, p_resource_id, p_resource_type)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."send_notification"("p_recipient_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_resource_id" "uuid", "p_resource_type" "text", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_pr_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_pr_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
	new.updated_at = now();
	return new;
end
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_docs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_docs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pull_request_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pull_request_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid",
    "user_id" "uuid",
    "action" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" DEFAULT 'application/octet-stream'::"text" NOT NULL,
    "file_size" bigint DEFAULT 0 NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid",
    "filters" "jsonb" DEFAULT '[]'::"jsonb",
    "sorts" "jsonb" DEFAULT '[]'::"jsonb",
    "visible_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "coloring_rules" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."board_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "boards_type_check" CHECK (("type" = ANY (ARRAY['scrum'::"text", 'kanban'::"text", 'table'::"text", 'chart'::"text"])))
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "last_commit_sha" "text",
    "last_commit_message" "text",
    "last_commit_author" "text",
    "last_commit_time" timestamp with time zone,
    "is_protected" boolean DEFAULT false NOT NULL,
    "protection_rules" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channel_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_channel_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."chat_channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "text" DEFAULT 'ws-reach'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'group'::"text" NOT NULL,
    "description" "text",
    "topic" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_channels_type_check" CHECK (("type" = ANY (ARRAY['group'::"text", 'direct'::"text"])))
);


ALTER TABLE "public"."chat_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_name" "text" DEFAULT ''::"text" NOT NULL,
    "text" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "thread_id" "uuid",
    "reply_count" integer DEFAULT 0,
    "reactions" "jsonb" DEFAULT '{}'::"jsonb",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "edited" boolean DEFAULT false,
    "pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'file'::"text", 'image'::"text", 'system'::"text", 'video_call'::"text", 'code'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_conversation_members" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "notification_level" "text" DEFAULT 'all'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_message_id" "uuid",
    CONSTRAINT "comm_conversation_members_notification_level_check" CHECK (("notification_level" = ANY (ARRAY['all'::"text", 'mentions'::"text", 'mute'::"text"]))),
    CONSTRAINT "comm_conversation_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."comm_conversation_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "kind" "public"."comm_conversation_kind" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "topic" "text" DEFAULT ''::"text" NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "issue_key" "text",
    "direct_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_issue_threads" (
    "issue_key" "text" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_issue_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_meeting_participants" (
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "response" "text" DEFAULT 'pending'::"text" NOT NULL,
    "joined_at" timestamp with time zone,
    "left_at" timestamp with time zone,
    CONSTRAINT "comm_meeting_participants_response_check" CHECK (("response" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'tentative'::"text"])))
);


ALTER TABLE "public"."comm_meeting_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "issue_key" "text",
    "title" "text" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "status" "public"."meeting_status" DEFAULT 'scheduled'::"public"."meeting_status" NOT NULL,
    "meeting_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_messages_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "sender_user_id" "uuid" NOT NULL,
    "kind" "public"."comm_message_kind" DEFAULT 'message'::"public"."comm_message_kind" NOT NULL,
    "body" "text" NOT NULL,
    "parent_message_id" "uuid",
    "issue_key" "text",
    "mentions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "command_name" "text",
    "command_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."comm_messages_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_pinned_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "pinned_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_pinned_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_presence" (
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."comm_presence_status" DEFAULT 'online'::"public"."comm_presence_status" NOT NULL,
    "availability_text" "text" DEFAULT ''::"text" NOT NULL,
    "issue_key" "text",
    "file_path" "text",
    "line_number" integer,
    "cursor_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid",
    "user_id" "uuid",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repository_id" "uuid" NOT NULL,
    "sha" "text" NOT NULL,
    "branch_id" "uuid",
    "branch_name" "text",
    "message" "text" DEFAULT ''::"text" NOT NULL,
    "author_name" "text" DEFAULT ''::"text" NOT NULL,
    "author_email" "text" DEFAULT ''::"text" NOT NULL,
    "author_id" "uuid",
    "committer_name" "text",
    "committer_email" "text",
    "committer_id" "uuid",
    "timestamp" timestamp with time zone,
    "pr_id" "uuid",
    "pr_number" integer,
    "additions" integer DEFAULT 0 NOT NULL,
    "deletions" integer DEFAULT 0 NOT NULL,
    "files_changed" integer DEFAULT 0 NOT NULL,
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."docs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "text" DEFAULT 'ws-reach'::"text" NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "created_by" "text",
    "updated_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "emoji" "text" DEFAULT ''::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "parent_id" "uuid",
    "created_by" "text" DEFAULT 'anonymous'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."field_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid",
    "name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "options" "jsonb" DEFAULT '{}'::"jsonb",
    "position" double precision DEFAULT 0,
    CONSTRAINT "field_definitions_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'rich_text'::"text", 'link'::"text", 'number'::"text", 'status'::"text", 'tag'::"text", 'date'::"text", 'timeline'::"text", 'person'::"text"])))
);


ALTER TABLE "public"."field_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid",
    "file_url" "text",
    "file_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "github_login" "text" NOT NULL,
    "github_id" bigint NOT NULL,
    "access_token" "text" NOT NULL,
    "token_scope" "text" DEFAULT 'repo,read:org'::"text",
    "avatar_url" "text",
    "github_name" "text",
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."github_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_pr_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "repo_full_name" "text" NOT NULL,
    "pr_number" integer NOT NULL,
    "pr_title" "text" NOT NULL,
    "event" "text" NOT NULL,
    "actor_login" "text" NOT NULL,
    "actor_user_id" "uuid",
    "target_branch" "text",
    "head_branch" "text",
    "additions" integer,
    "deletions" integer,
    "github_pr_id" bigint,
    "github_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."github_pr_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ide_floating_windows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" DEFAULT 'anonymous'::"text" NOT NULL,
    "windows" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "z_indexes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "next_z_index" integer DEFAULT 1000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ide_floating_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ide_window_layouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" DEFAULT 'anonymous'::"text" NOT NULL,
    "layout" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ide_window_layouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "issue_key" "text" NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "source_table" "text",
    "source_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issue_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "issue_key" "text" NOT NULL,
    "message_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "content_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issue_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid",
    "sprint_id" "uuid",
    "parent_id" "uuid",
    "title" "text" NOT NULL,
    "notes" "text",
    "section" "text",
    "status" "text" DEFAULT 'empty'::"text",
    "priority" "text" DEFAULT 'Medium'::"text",
    "story_points" integer,
    "assignee_id" "uuid",
    "position" double precision DEFAULT 0,
    "custom_fields" "jsonb" DEFAULT '{}'::"jsonb",
    "is_archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'task'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "owner_id" "uuid",
    "start_date" "date",
    "due_date" "date",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kic_assessments" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "framework" "text" NOT NULL,
    "control_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'not-reviewed'::"text" NOT NULL,
    "evidence_json" "text" DEFAULT ''::"text" NOT NULL,
    "assessed_by" "text" DEFAULT 'manual'::"text" NOT NULL,
    "assessed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kic_assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kubric_tenants" (
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "plan" "text" DEFAULT 'starter'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kubric_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "role" "text" DEFAULT 'member'::"text",
    "team_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missed_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "emailed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."missed_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."noc_agents" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "cluster_id" "text" DEFAULT ''::"text" NOT NULL,
    "hostname" "text" NOT NULL,
    "agent_type" "text" NOT NULL,
    "version" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'online'::"text" NOT NULL,
    "last_heartbeat" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."noc_agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."noc_clusters" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "provider" "text" DEFAULT 'k8s'::"text" NOT NULL,
    "version" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."noc_clusters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "recipient_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "link" "text",
    "actor_id" "uuid",
    "actor_name" "text",
    "resource_id" "uuid",
    "resource_type" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['issue'::"text", 'comment'::"text", 'pr'::"text", 'doc'::"text", 'chat'::"text", 'workspace'::"text"]))),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['mention'::"text", 'assignment'::"text", 'comment'::"text", 'status_change'::"text", 'due_date'::"text", 'pr_review'::"text", 'system'::"text", 'invite'::"text", 'reaction'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pr_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pr_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_name" "text" NOT NULL,
    "user_avatar" "text",
    "parent_id" "uuid",
    "file_path" "text",
    "line_number" integer,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pr_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pr_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pr_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_name" "text",
    "event" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pr_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pr_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pr_id" "uuid" NOT NULL,
    "reviewer_id" "uuid",
    "reviewer_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "comments" "text" DEFAULT ''::"text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pr_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'changes_requested'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."pr_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "display_name" "text",
    "signature" "text" DEFAULT ''::"text" NOT NULL,
    "default_workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pull_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "repository_id" "uuid" NOT NULL,
    "number" integer NOT NULL,
    "github_number" integer,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "source_branch" "text" NOT NULL,
    "target_branch" "text" DEFAULT 'main'::"text" NOT NULL,
    "author_id" "uuid",
    "author_name" "text" NOT NULL,
    "author_avatar" "text",
    "reviewers" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "reviewer_names" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "assignees" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "review_status" "text",
    "merge_status" "text",
    "github_url" "text",
    "github_id" bigint,
    "sync_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "last_sync" timestamp with time zone,
    "files_changed" integer DEFAULT 0 NOT NULL,
    "additions" integer DEFAULT 0 NOT NULL,
    "deletions" integer DEFAULT 0 NOT NULL,
    "commits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "labels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "milestone" "text",
    "ci_status" "text",
    "ci_url" "text",
    "app_source" boolean DEFAULT true NOT NULL,
    "linked_issues" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "merged_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    CONSTRAINT "pull_requests_ci_status_check" CHECK (("ci_status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'passed'::"text", 'failed'::"text"]))),
    CONSTRAINT "pull_requests_merge_status_check" CHECK (("merge_status" = ANY (ARRAY['unresolved'::"text", 'has_conflicts'::"text", 'ready'::"text"]))),
    CONSTRAINT "pull_requests_review_status_check" CHECK (("review_status" = ANY (ARRAY['needs_review'::"text", 'changes_needed'::"text", 'approved'::"text"]))),
    CONSTRAINT "pull_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'open'::"text", 'changes_requested'::"text", 'approved'::"text", 'merged'::"text", 'closed'::"text"]))),
    CONSTRAINT "pull_requests_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['pending'::"text", 'synced'::"text", 'conflict'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."pull_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reach_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "issue_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assignee_user_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reach_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repositories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "name" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "github_id" bigint,
    "github_url" "text",
    "default_branch" "text" DEFAULT 'main'::"text" NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "sync_enabled" boolean DEFAULT true NOT NULL,
    "last_sync" timestamp with time zone,
    "description" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."repositories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid",
    "name" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "goal" "text",
    "position" double precision DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tag_definitions" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#64748b'::"text" NOT NULL,
    "workspace_id" "text" DEFAULT 'ws-reach'::"text" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tag_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#4f6ef7'::"text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "address" "text",
    "note" "text",
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid",
    "user_id" "uuid",
    "start_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_time" timestamp with time zone,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid",
    "project_id" "uuid",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "billable" boolean DEFAULT true
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#64748b'::"text",
    "client_id" "uuid",
    "billable" boolean DEFAULT true,
    "public_project" boolean DEFAULT true,
    "estimate_hours" numeric(10,2),
    "note" "text",
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timesheet_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'My Template'::"text" NOT NULL,
    "rows" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."timesheet_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_presence" (
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'offline'::"text" NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "current_page" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_presence_status_check" CHECK (("status" = ANY (ARRAY['online'::"text", 'away'::"text", 'dnd'::"text", 'offline'::"text"])))
);


ALTER TABLE "public"."user_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "title" "text",
    "bio" "text",
    "role" "text" DEFAULT 'member'::"text",
    "notification_prefs" "jsonb" DEFAULT '{"sound": true, "types": {"system": true, "comment": true, "mention": true, "due_date": true, "pr_review": true, "assignment": true, "status_change": true}, "volume": 70, "enabled": true, "slideOut": true, "desktopPush": true}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_saved_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "name" "text" NOT NULL,
    "filter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_saved_views_type_check" CHECK (("type" = ANY (ARRAY['channel'::"text", 'dm'::"text", 'issue-thread'::"text"])))
);


ALTER TABLE "public"."user_saved_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vdr_findings" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "target" "text" NOT NULL,
    "scanner" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "cve_id" "text" DEFAULT ''::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "raw_json" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vdr_findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "member_id" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "display_name" "text",
    "status" "text" DEFAULT 'offline'::"text" NOT NULL,
    "status_text" "text",
    "status_emoji" "text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "last_active_at" timestamp with time zone
);


ALTER TABLE "public"."workspace_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "duration_format" "text" DEFAULT 'full'::"text",
    "week_start" "text" DEFAULT 'monday'::"text",
    "working_days" "text"[] DEFAULT '{monday,tuesday,wednesday,thursday,friday}'::"text"[],
    "billable_rate" numeric(10,2) DEFAULT 0.00,
    "currency" "text" DEFAULT 'USD'::"text",
    "activate_timesheet" boolean DEFAULT false,
    "hide_tracker" boolean DEFAULT false,
    "kiosk_mode" boolean DEFAULT false,
    "new_project_billable" boolean DEFAULT true,
    "new_project_public" boolean DEFAULT true,
    "organize_time_by" "text" DEFAULT 'project'::"text",
    "project_favorites" boolean DEFAULT false,
    "task_favorites" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspace_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "avatar" "text",
    "description" "text",
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "owner_user_id" "uuid",
    "settings" "jsonb"
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_views"
    ADD CONSTRAINT "board_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_repository_id_name_key" UNIQUE ("repository_id", "name");



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_conversation_members"
    ADD CONSTRAINT "comm_conversation_members_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."comm_conversations"
    ADD CONSTRAINT "comm_conversations_direct_key_key" UNIQUE ("direct_key");



ALTER TABLE ONLY "public"."comm_conversations"
    ADD CONSTRAINT "comm_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_issue_threads"
    ADD CONSTRAINT "comm_issue_threads_pkey" PRIMARY KEY ("issue_key", "message_id");



ALTER TABLE ONLY "public"."comm_meeting_participants"
    ADD CONSTRAINT "comm_meeting_participants_pkey" PRIMARY KEY ("meeting_id", "user_id");



ALTER TABLE ONLY "public"."comm_meetings"
    ADD CONSTRAINT "comm_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_messages_archive"
    ADD CONSTRAINT "comm_messages_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_pinned_messages"
    ADD CONSTRAINT "comm_pinned_messages_conversation_id_message_id_key" UNIQUE ("conversation_id", "message_id");



ALTER TABLE ONLY "public"."comm_pinned_messages"
    ADD CONSTRAINT "comm_pinned_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_presence"
    ADD CONSTRAINT "comm_presence_pkey" PRIMARY KEY ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_repository_id_sha_key" UNIQUE ("repository_id", "sha");



ALTER TABLE ONLY "public"."docs"
    ADD CONSTRAINT "docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."field_definitions"
    ADD CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_connections"
    ADD CONSTRAINT "github_connections_github_id_key" UNIQUE ("github_id");



ALTER TABLE ONLY "public"."github_connections"
    ADD CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_connections"
    ADD CONSTRAINT "github_connections_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."github_pr_activity"
    ADD CONSTRAINT "github_pr_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ide_floating_windows"
    ADD CONSTRAINT "ide_floating_windows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ide_window_layouts"
    ADD CONSTRAINT "ide_window_layouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issue_activity"
    ADD CONSTRAINT "issue_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issue_attachments"
    ADD CONSTRAINT "issue_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kic_assessments"
    ADD CONSTRAINT "kic_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kubric_tenants"
    ADD CONSTRAINT "kubric_tenants_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missed_messages"
    ADD CONSTRAINT "missed_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missed_messages"
    ADD CONSTRAINT "missed_messages_user_id_message_id_key" UNIQUE ("user_id", "message_id");



ALTER TABLE ONLY "public"."noc_agents"
    ADD CONSTRAINT "noc_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."noc_clusters"
    ADD CONSTRAINT "noc_clusters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pr_comments"
    ADD CONSTRAINT "pr_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pr_logs"
    ADD CONSTRAINT "pr_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pr_reviews"
    ADD CONSTRAINT "pr_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_repository_id_number_key" UNIQUE ("repository_id", "number");



ALTER TABLE ONLY "public"."reach_issues"
    ADD CONSTRAINT "reach_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reach_issues"
    ADD CONSTRAINT "reach_issues_workspace_id_issue_key_key" UNIQUE ("workspace_id", "issue_key");



ALTER TABLE ONLY "public"."repositories"
    ADD CONSTRAINT "repositories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repositories"
    ADD CONSTRAINT "repositories_workspace_id_full_name_key" UNIQUE ("workspace_id", "full_name");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag_definitions"
    ADD CONSTRAINT "tag_definitions_name_workspace_id_key" UNIQUE ("name", "workspace_id");



ALTER TABLE ONLY "public"."tag_definitions"
    ADD CONSTRAINT "tag_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_clients"
    ADD CONSTRAINT "time_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_clients"
    ADD CONSTRAINT "time_clients_workspace_id_name_key" UNIQUE ("workspace_id", "name");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_projects"
    ADD CONSTRAINT "time_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_projects"
    ADD CONSTRAINT "time_projects_workspace_id_name_key" UNIQUE ("workspace_id", "name");



ALTER TABLE ONLY "public"."timesheet_templates"
    ADD CONSTRAINT "timesheet_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_presence"
    ADD CONSTRAINT "user_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_saved_views"
    ADD CONSTRAINT "user_saved_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vdr_findings"
    ADD CONSTRAINT "vdr_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_workspace_id_member_id_key" UNIQUE ("workspace_id", "member_id");



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_workspace_id_key" UNIQUE ("workspace_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_slug_key" UNIQUE ("slug");



CREATE INDEX "comm_messages_archive_conversation_id_created_at_idx" ON "public"."comm_messages_archive" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "comm_messages_archive_issue_key_created_at_idx" ON "public"."comm_messages_archive" USING "btree" ("issue_key", "created_at");



CREATE INDEX "idx_activities_created_at" ON "public"."activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activities_issue_id" ON "public"."activities" USING "btree" ("issue_id");



CREATE INDEX "idx_attachments_issue_id" ON "public"."attachments" USING "btree" ("issue_id");



CREATE INDEX "idx_board_views_board_id" ON "public"."board_views" USING "btree" ("board_id");



CREATE INDEX "idx_branches_repo" ON "public"."branches" USING "btree" ("repository_id");



CREATE INDEX "idx_ccm_channel" ON "public"."chat_channel_members" USING "btree" ("channel_id");



CREATE INDEX "idx_ccm_user" ON "public"."chat_channel_members" USING "btree" ("user_id");



CREATE INDEX "idx_chat_channels_ws" ON "public"."chat_channels" USING "btree" ("workspace_id");



CREATE INDEX "idx_chat_msgs_channel" ON "public"."chat_messages" USING "btree" ("channel_id", "created_at" DESC);



CREATE INDEX "idx_chat_msgs_thread" ON "public"."chat_messages" USING "btree" ("thread_id") WHERE ("thread_id" IS NOT NULL);



CREATE INDEX "idx_comm_conversations_workspace" ON "public"."comm_conversations" USING "btree" ("workspace_id", "kind", "created_at" DESC);



CREATE INDEX "idx_comm_meetings_workspace" ON "public"."comm_meetings" USING "btree" ("workspace_id", "scheduled_for" DESC);



CREATE INDEX "idx_comm_messages_conversation" ON "public"."comm_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_comm_messages_issue_key" ON "public"."comm_messages" USING "btree" ("issue_key", "created_at");



CREATE INDEX "idx_comm_notifications_user_unread" ON "public"."comm_notifications" USING "btree" ("user_id", "read_at", "created_at" DESC);



CREATE INDEX "idx_comm_pinned_conversation" ON "public"."comm_pinned_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_comm_presence_workspace_status" ON "public"."comm_presence" USING "btree" ("workspace_id", "status", "updated_at" DESC);



CREATE INDEX "idx_comments_pr" ON "public"."pr_comments" USING "btree" ("pr_id");



CREATE INDEX "idx_commits_repo" ON "public"."commits" USING "btree" ("repository_id");



CREATE INDEX "idx_commits_repository" ON "public"."commits" USING "btree" ("repository_id");



CREATE INDEX "idx_commits_timestamp" ON "public"."commits" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_commits_ts" ON "public"."commits" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_docs_workspace" ON "public"."docs" USING "btree" ("workspace_id");



CREATE INDEX "idx_gpa_actor" ON "public"."github_pr_activity" USING "btree" ("actor_login");



CREATE INDEX "idx_gpa_created_at" ON "public"."github_pr_activity" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_gpa_repo" ON "public"."github_pr_activity" USING "btree" ("repo_full_name");



CREATE INDEX "idx_gpa_workspace" ON "public"."github_pr_activity" USING "btree" ("workspace_id");



CREATE INDEX "idx_issue_activity_workspace_created" ON "public"."issue_activity" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_issue_activity_workspace_issue_created" ON "public"."issue_activity" USING "btree" ("workspace_id", "issue_key", "created_at" DESC);



CREATE INDEX "idx_issues_deleted_at" ON "public"."issues" USING "btree" ("deleted_at");



CREATE INDEX "idx_issues_due_date" ON "public"."issues" USING "btree" ("due_date");



CREATE INDEX "idx_issues_owner_id" ON "public"."issues" USING "btree" ("owner_id");



CREATE INDEX "idx_logs_pr" ON "public"."pr_logs" USING "btree" ("pr_id");



CREATE INDEX "idx_logs_timestamp" ON "public"."pr_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_members_team_id" ON "public"."members" USING "btree" ("team_id");



CREATE INDEX "idx_missed_unprocessed" ON "public"."missed_messages" USING "btree" ("emailed", "created_at") WHERE ("emailed" = false);



CREATE INDEX "idx_notif_recipient" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_notif_unread" ON "public"."notifications" USING "btree" ("recipient_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_notif_workspace" ON "public"."notifications" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_pr_comments_pr" ON "public"."pr_comments" USING "btree" ("pr_id");



CREATE INDEX "idx_pr_logs_pr" ON "public"."pr_logs" USING "btree" ("pr_id");



CREATE INDEX "idx_pr_logs_timestamp" ON "public"."pr_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_pr_reviews_pr" ON "public"."pr_reviews" USING "btree" ("pr_id");



CREATE UNIQUE INDEX "idx_profiles_email_unique" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_prs_author" ON "public"."pull_requests" USING "btree" ("author_id");



CREATE INDEX "idx_prs_created" ON "public"."pull_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_prs_repo" ON "public"."pull_requests" USING "btree" ("repository_id");



CREATE INDEX "idx_prs_status" ON "public"."pull_requests" USING "btree" ("status");



CREATE INDEX "idx_pull_requests_author" ON "public"."pull_requests" USING "btree" ("author_id");



CREATE INDEX "idx_pull_requests_created" ON "public"."pull_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pull_requests_repository" ON "public"."pull_requests" USING "btree" ("repository_id");



CREATE INDEX "idx_pull_requests_status" ON "public"."pull_requests" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_repositories_full_name" ON "public"."repositories" USING "btree" ("full_name");



CREATE INDEX "idx_reviews_pr" ON "public"."pr_reviews" USING "btree" ("pr_id");



CREATE INDEX "idx_time_entries_issue_id" ON "public"."time_entries" USING "btree" ("issue_id");



CREATE INDEX "idx_time_entries_user_id" ON "public"."time_entries" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_memberships_member" ON "public"."workspace_memberships" USING "btree" ("member_id");



CREATE INDEX "idx_workspace_memberships_workspace" ON "public"."workspace_memberships" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspaces_slug" ON "public"."workspaces" USING "btree" ("slug");



CREATE UNIQUE INDEX "idx_workspaces_slug_unique" ON "public"."workspaces" USING "btree" ("slug");



CREATE INDEX "kic_assessments_framework" ON "public"."kic_assessments" USING "btree" ("framework");



CREATE INDEX "kic_assessments_tenant_id" ON "public"."kic_assessments" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "noc_agents_identity_idx" ON "public"."noc_agents" USING "btree" ("tenant_id", "hostname", "agent_type");



CREATE INDEX "noc_agents_tenant_id" ON "public"."noc_agents" USING "btree" ("tenant_id");



CREATE INDEX "noc_clusters_tenant_id" ON "public"."noc_clusters" USING "btree" ("tenant_id");



CREATE INDEX "vdr_findings_severity" ON "public"."vdr_findings" USING "btree" ("severity");



CREATE INDEX "vdr_findings_tenant_id" ON "public"."vdr_findings" USING "btree" ("tenant_id");



CREATE OR REPLACE TRIGGER "docs_updated_at" BEFORE UPDATE ON "public"."docs" FOR EACH ROW EXECUTE FUNCTION "public"."update_docs_updated_at"();



CREATE OR REPLACE TRIGGER "set_workspaces_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_comm_messages_fan_out_notif" AFTER INSERT ON "public"."comm_messages" FOR EACH ROW EXECUTE FUNCTION "public"."comm_fan_out_message_notification"();



CREATE OR REPLACE TRIGGER "trg_comm_messages_sync_issue_thread" AFTER INSERT ON "public"."comm_messages" FOR EACH ROW EXECUTE FUNCTION "public"."comm_sync_issue_thread"();



CREATE OR REPLACE TRIGGER "trg_notify_assignment" AFTER UPDATE OF "assignee_id" ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_assignment"();



CREATE OR REPLACE TRIGGER "trg_notify_status" AFTER UPDATE OF "status" ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_status_change"();



CREATE OR REPLACE TRIGGER "trg_pr_updated" BEFORE UPDATE ON "public"."pull_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_pr_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pull_requests_updated_at" BEFORE UPDATE ON "public"."pull_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_pull_request_timestamp"();



CREATE OR REPLACE TRIGGER "trg_reach_issues_status_activity" AFTER UPDATE ON "public"."reach_issues" FOR EACH ROW EXECUTE FUNCTION "public"."capture_issue_status_activity"();



CREATE OR REPLACE TRIGGER "trg_workspaces_set_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."board_views"
    ADD CONSTRAINT "board_views_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_conversation_members"
    ADD CONSTRAINT "comm_conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_conversation_members"
    ADD CONSTRAINT "comm_conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_conversation_members"
    ADD CONSTRAINT "comm_conversation_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_conversations"
    ADD CONSTRAINT "comm_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_conversations"
    ADD CONSTRAINT "comm_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_issue_threads"
    ADD CONSTRAINT "comm_issue_threads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."comm_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_issue_threads"
    ADD CONSTRAINT "comm_issue_threads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_meeting_participants"
    ADD CONSTRAINT "comm_meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."comm_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_meeting_participants"
    ADD CONSTRAINT "comm_meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_meeting_participants"
    ADD CONSTRAINT "comm_meeting_participants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_meetings"
    ADD CONSTRAINT "comm_meetings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_meetings"
    ADD CONSTRAINT "comm_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_meetings"
    ADD CONSTRAINT "comm_meetings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."comm_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_messages"
    ADD CONSTRAINT "comm_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_pinned_messages"
    ADD CONSTRAINT "comm_pinned_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."comm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_pinned_messages"
    ADD CONSTRAINT "comm_pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."comm_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_pinned_messages"
    ADD CONSTRAINT "comm_pinned_messages_pinned_by_fkey" FOREIGN KEY ("pinned_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_pinned_messages"
    ADD CONSTRAINT "comm_pinned_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_presence"
    ADD CONSTRAINT "comm_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_presence"
    ADD CONSTRAINT "comm_presence_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id");



ALTER TABLE ONLY "public"."commits"
    ADD CONSTRAINT "commits_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."field_definitions"
    ADD CONSTRAINT "field_definitions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."github_connections"
    ADD CONSTRAINT "github_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_activity"
    ADD CONSTRAINT "issue_activity_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issue_activity"
    ADD CONSTRAINT "issue_activity_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_attachments"
    ADD CONSTRAINT "issue_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."comm_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issue_attachments"
    ADD CONSTRAINT "issue_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_attachments"
    ADD CONSTRAINT "issue_attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missed_messages"
    ADD CONSTRAINT "missed_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missed_messages"
    ADD CONSTRAINT "missed_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missed_messages"
    ADD CONSTRAINT "missed_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pr_comments"
    ADD CONSTRAINT "pr_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."pr_comments"("id");



ALTER TABLE ONLY "public"."pr_comments"
    ADD CONSTRAINT "pr_comments_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pr_logs"
    ADD CONSTRAINT "pr_logs_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pr_reviews"
    ADD CONSTRAINT "pr_reviews_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_default_workspace_id_fkey" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pull_requests"
    ADD CONSTRAINT "pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reach_issues"
    ADD CONSTRAINT "reach_issues_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reach_issues"
    ADD CONSTRAINT "reach_issues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reach_issues"
    ADD CONSTRAINT "reach_issues_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprints"
    ADD CONSTRAINT "sprints_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_clients"
    ADD CONSTRAINT "time_clients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."time_projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_projects"
    ADD CONSTRAINT "time_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."time_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_projects"
    ADD CONSTRAINT "time_projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheet_templates"
    ADD CONSTRAINT "timesheet_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_presence"
    ADD CONSTRAINT "user_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_views"
    ADD CONSTRAINT "user_saved_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_saved_views"
    ADD CONSTRAINT "user_saved_views_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_settings"
    ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "allow_all_branches" ON "public"."branches" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_commits" ON "public"."commits" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_pr_logs" ON "public"."pr_logs" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_pr_reviews" ON "public"."pr_reviews" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_pull_requests" ON "public"."pull_requests" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_repositories" ON "public"."repositories" USING (true) WITH CHECK (true);



ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_all" ON "public"."branches" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."commits" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."pr_comments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."pr_logs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."pr_reviews" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."pull_requests" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_all" ON "public"."repositories" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branches_all" ON "public"."branches" USING (true) WITH CHECK (true);



CREATE POLICY "ccm_insert" ON "public"."chat_channel_members" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "ccm_select" ON "public"."chat_channel_members" FOR SELECT USING (true);



ALTER TABLE "public"."chat_channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_channels_insert" ON "public"."chat_channels" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "chat_channels_select" ON "public"."chat_channels" FOR SELECT USING (true);



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_msgs_insert" ON "public"."chat_messages" FOR INSERT WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "chat_msgs_select" ON "public"."chat_messages" FOR SELECT USING (true);



ALTER TABLE "public"."comm_conversation_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_conversation_members_insert_owner" ON "public"."comm_conversation_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."comm_conversation_members" "cm"
  WHERE (("cm"."conversation_id" = "comm_conversation_members"."conversation_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "comm_conversation_members_select_member" ON "public"."comm_conversation_members" FOR SELECT USING ("public"."comm_can_access_conversation"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."comm_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_conversations_insert_member" ON "public"."comm_conversations" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (("workspace_id" IS NULL) OR "public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()))));



CREATE POLICY "comm_conversations_select_member" ON "public"."comm_conversations" FOR SELECT USING ("public"."comm_can_access_conversation"("id", "auth"."uid"()));



CREATE POLICY "comm_conversations_update_owner" ON "public"."comm_conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."comm_conversation_members" "cm"
  WHERE (("cm"."conversation_id" = "comm_conversations"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."comm_conversation_members" "cm"
  WHERE (("cm"."conversation_id" = "comm_conversations"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."comm_issue_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_issue_threads_select_member" ON "public"."comm_issue_threads" FOR SELECT USING ((("workspace_id" IS NULL) OR "public"."comm_is_workspace_member"("workspace_id", "auth"."uid"())));



ALTER TABLE "public"."comm_meeting_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_meeting_participants_insert_creator" ON "public"."comm_meeting_participants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."comm_meetings" "m"
  WHERE (("m"."id" = "comm_meeting_participants"."meeting_id") AND ("m"."created_by" = "auth"."uid"())))));



CREATE POLICY "comm_meeting_participants_select_participant" ON "public"."comm_meeting_participants" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."comm_meetings" "m"
  WHERE (("m"."id" = "comm_meeting_participants"."meeting_id") AND ("m"."created_by" = "auth"."uid"()))))));



ALTER TABLE "public"."comm_meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_meetings_insert_member" ON "public"."comm_meetings" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."comm_is_workspace_member"("workspace_id", "auth"."uid"())));



CREATE POLICY "comm_meetings_select_participant" ON "public"."comm_meetings" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."comm_meeting_participants" "mp"
  WHERE (("mp"."meeting_id" = "comm_meetings"."id") AND ("mp"."user_id" = "auth"."uid"())))) OR "public"."comm_is_workspace_member"("workspace_id", "auth"."uid"())));



ALTER TABLE "public"."comm_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comm_messages_archive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_messages_insert_sender" ON "public"."comm_messages" FOR INSERT WITH CHECK ((("sender_user_id" = "auth"."uid"()) AND "public"."comm_can_access_conversation"("conversation_id", "auth"."uid"())));



CREATE POLICY "comm_messages_select_member" ON "public"."comm_messages" FOR SELECT USING ("public"."comm_can_access_conversation"("conversation_id", "auth"."uid"()));



CREATE POLICY "comm_messages_update_sender" ON "public"."comm_messages" FOR UPDATE USING (("sender_user_id" = "auth"."uid"())) WITH CHECK (("sender_user_id" = "auth"."uid"()));



ALTER TABLE "public"."comm_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_notifications_insert_member" ON "public"."comm_notifications" FOR INSERT WITH CHECK ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "comm_notifications_select_owner" ON "public"."comm_notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "comm_notifications_update_owner" ON "public"."comm_notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "comm_pinned_delete" ON "public"."comm_pinned_messages" FOR DELETE USING ("public"."comm_can_access_conversation"("conversation_id", "auth"."uid"()));



CREATE POLICY "comm_pinned_insert" ON "public"."comm_pinned_messages" FOR INSERT WITH CHECK (("public"."comm_can_access_conversation"("conversation_id", "auth"."uid"()) AND ("pinned_by" = "auth"."uid"())));



ALTER TABLE "public"."comm_pinned_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_pinned_select" ON "public"."comm_pinned_messages" FOR SELECT USING ("public"."comm_can_access_conversation"("conversation_id", "auth"."uid"()));



ALTER TABLE "public"."comm_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comm_presence_select_member" ON "public"."comm_presence" FOR SELECT USING ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "comm_presence_update_own" ON "public"."comm_presence" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "comm_presence_upsert_own" ON "public"."comm_presence" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."comm_is_workspace_member"("workspace_id", "auth"."uid"())));



CREATE POLICY "comments_all" ON "public"."pr_comments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."commits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commits_all" ON "public"."commits" USING (true) WITH CHECK (true);



ALTER TABLE "public"."docs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "docs_delete" ON "public"."docs" FOR DELETE USING (true);



CREATE POLICY "docs_insert" ON "public"."docs" FOR INSERT WITH CHECK (true);



CREATE POLICY "docs_select" ON "public"."docs" FOR SELECT USING (true);



CREATE POLICY "docs_update" ON "public"."docs" FOR UPDATE USING (true);



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."github_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "github_connections_admin_read" ON "public"."github_connections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['admin'::"text", 'lead'::"text"]))))));



CREATE POLICY "github_connections_owner" ON "public"."github_connections" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."github_pr_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gpa_admin_lead_read" ON "public"."github_pr_activity" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['admin'::"text", 'lead'::"text"]))))));



CREATE POLICY "gpa_insert_service" ON "public"."github_pr_activity" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."ide_floating_windows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ide_window_layouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "issue_activity_insert_workspace_member" ON "public"."issue_activity" FOR INSERT WITH CHECK ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "issue_activity_select_workspace_member" ON "public"."issue_activity" FOR SELECT USING ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()));



ALTER TABLE "public"."issue_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "issue_attachments_insert_uploader" ON "public"."issue_attachments" FOR INSERT WITH CHECK (("uploaded_by" = "auth"."uid"()));



CREATE POLICY "issue_attachments_select_member" ON "public"."issue_attachments" FOR SELECT USING ((("workspace_id" IS NULL) OR "public"."comm_is_workspace_member"("workspace_id", "auth"."uid"())));



ALTER TABLE "public"."kic_assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kubric_tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "logs_all" ON "public"."pr_logs" USING (true) WITH CHECK (true);



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "missed_insert" ON "public"."missed_messages" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."missed_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "missed_select" ON "public"."missed_messages" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."noc_agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."noc_clusters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete" ON "public"."notifications" FOR DELETE USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("recipient_id" = "auth"."uid"()));



ALTER TABLE "public"."pr_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pr_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pr_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "presence_select" ON "public"."user_presence" FOR SELECT USING (true);



CREATE POLICY "presence_update" ON "public"."user_presence" FOR UPDATE USING (true);



CREATE POLICY "presence_upsert" ON "public"."user_presence" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."user_profiles" FOR INSERT WITH CHECK ((("id" = "auth"."uid"()) OR true));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update" ON "public"."user_profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "prs_all" ON "public"."pull_requests" USING (true) WITH CHECK (true);



ALTER TABLE "public"."pull_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reach_issues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reach_issues_insert_member" ON "public"."reach_issues" FOR INSERT WITH CHECK (("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "reach_issues_select_member" ON "public"."reach_issues" FOR SELECT USING ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "reach_issues_update_member" ON "public"."reach_issues" FOR UPDATE USING ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"())) WITH CHECK ("public"."comm_is_workspace_member"("workspace_id", "auth"."uid"()));



CREATE POLICY "repos_all" ON "public"."repositories" USING (true) WITH CHECK (true);



ALTER TABLE "public"."repositories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_all" ON "public"."pr_reviews" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tag_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tag_definitions_delete" ON "public"."tag_definitions" FOR DELETE USING (true);



CREATE POLICY "tag_definitions_insert" ON "public"."tag_definitions" FOR INSERT WITH CHECK (true);



CREATE POLICY "tag_definitions_select" ON "public"."tag_definitions" FOR SELECT USING (true);



CREATE POLICY "tag_definitions_update" ON "public"."tag_definitions" FOR UPDATE USING (true);



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timesheet_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_presence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_saved_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_saved_views_insert_owner" ON "public"."user_saved_views" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_saved_views_select_owner" ON "public"."user_saved_views" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_saved_views_update_owner" ON "public"."user_saved_views" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vdr_findings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_members_delete_admin" ON "public"."workspace_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "self"
  WHERE (("self"."workspace_id" = "workspace_members"."workspace_id") AND ("self"."user_id" = "auth"."uid"()) AND ("self"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role"]))))));



CREATE POLICY "workspace_members_insert_admin" ON "public"."workspace_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "self"
  WHERE (("self"."workspace_id" = "workspace_members"."workspace_id") AND ("self"."user_id" = "auth"."uid"()) AND ("self"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role"]))))));



CREATE POLICY "workspace_members_select_member" ON "public"."workspace_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "self"
  WHERE (("self"."workspace_id" = "workspace_members"."workspace_id") AND ("self"."user_id" = "auth"."uid"())))));



CREATE POLICY "workspace_members_update_admin" ON "public"."workspace_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "self"
  WHERE (("self"."workspace_id" = "workspace_members"."workspace_id") AND ("self"."user_id" = "auth"."uid"()) AND ("self"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "self"
  WHERE (("self"."workspace_id" = "workspace_members"."workspace_id") AND ("self"."user_id" = "auth"."uid"()) AND ("self"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role"]))))));



ALTER TABLE "public"."workspace_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_memberships_open" ON "public"."workspace_memberships" USING (true) WITH CHECK (true);



ALTER TABLE "public"."workspace_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspaces_insert_owner" ON "public"."workspaces" FOR INSERT WITH CHECK ((COALESCE("owner_user_id", "owner_id") = "auth"."uid"()));



CREATE POLICY "workspaces_open" ON "public"."workspaces" USING (true) WITH CHECK (true);



CREATE POLICY "workspaces_select_member" ON "public"."workspaces" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "workspaces"."id") AND ("wm"."user_id" = "auth"."uid"())))));



CREATE POLICY "workspaces_update_admin" ON "public"."workspaces" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "workspaces"."id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "wm"
  WHERE (("wm"."workspace_id" = "workspaces"."id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role"]))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_issue_status_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_issue_status_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_issue_status_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_archive_old_messages"("p_days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."comm_archive_old_messages"("p_days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_archive_old_messages"("p_days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_bootstrap_workspace_context"("p_preferred_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_bootstrap_workspace_context"("p_preferred_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_bootstrap_workspace_context"("p_preferred_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_can_access_conversation"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_can_access_conversation"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_can_access_conversation"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_cleanup_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_create_channel"("p_workspace_id" "uuid", "p_name" "text", "p_topic" "text", "p_is_private" boolean, "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_create_channel"("p_workspace_id" "uuid", "p_name" "text", "p_topic" "text", "p_is_private" boolean, "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_create_channel"("p_workspace_id" "uuid", "p_name" "text", "p_topic" "text", "p_is_private" boolean, "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_ensure_default_channel"("p_workspace_id" "uuid", "p_slug" "text", "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_ensure_default_channel"("p_workspace_id" "uuid", "p_slug" "text", "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_ensure_default_channel"("p_workspace_id" "uuid", "p_slug" "text", "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_fan_out_message_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_fan_out_message_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_fan_out_message_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_find_user_by_name"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_find_user_by_name"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_find_user_by_name"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_get_pinned_messages"("p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_get_pinned_messages"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_get_pinned_messages"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_is_workspace_member"("p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_join_all_workspaces"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_join_all_workspaces"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_join_all_workspaces"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_mark_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_notify_user"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_kind" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_notify_user"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_kind" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_notify_user"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_kind" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_open_direct_conversation"("p_workspace_id" "uuid", "p_target_user_id" "uuid", "p_issue_key" "text", "p_target_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_open_direct_conversation"("p_workspace_id" "uuid", "p_target_user_id" "uuid", "p_issue_key" "text", "p_target_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_open_direct_conversation"("p_workspace_id" "uuid", "p_target_user_id" "uuid", "p_issue_key" "text", "p_target_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_pin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_pin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_pin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_schedule_meeting"("p_workspace_id" "uuid", "p_title" "text", "p_scheduled_for" timestamp with time zone, "p_duration_minutes" integer, "p_participant_ids" "uuid"[], "p_conversation_id" "uuid", "p_issue_key" "text", "p_participant_workspaces" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_schedule_meeting"("p_workspace_id" "uuid", "p_title" "text", "p_scheduled_for" timestamp with time zone, "p_duration_minutes" integer, "p_participant_ids" "uuid"[], "p_conversation_id" "uuid", "p_issue_key" "text", "p_participant_workspaces" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_schedule_meeting"("p_workspace_id" "uuid", "p_title" "text", "p_scheduled_for" timestamp with time zone, "p_duration_minutes" integer, "p_participant_ids" "uuid"[], "p_conversation_id" "uuid", "p_issue_key" "text", "p_participant_workspaces" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."comm_messages" TO "anon";
GRANT ALL ON TABLE "public"."comm_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_messages" TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_send_message"("p_conversation_id" "uuid", "p_body" "text", "p_parent_message_id" "uuid", "p_kind" "public"."comm_message_kind", "p_command_name" "text", "p_command_payload" "jsonb", "p_attachments" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_send_message"("p_conversation_id" "uuid", "p_body" "text", "p_parent_message_id" "uuid", "p_kind" "public"."comm_message_kind", "p_command_name" "text", "p_command_payload" "jsonb", "p_attachments" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_send_message"("p_conversation_id" "uuid", "p_body" "text", "p_parent_message_id" "uuid", "p_kind" "public"."comm_message_kind", "p_command_name" "text", "p_command_payload" "jsonb", "p_attachments" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_set_member_role"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_role" "public"."workspace_role") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_set_member_role"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_role" "public"."workspace_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_set_member_role"("p_workspace_id" "uuid", "p_user_id" "uuid", "p_role" "public"."workspace_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_sync_issue_thread"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_sync_issue_thread"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_sync_issue_thread"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_unpin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_unpin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_unpin_message"("p_conversation_id" "uuid", "p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_workspace_directory"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."comm_workspace_directory"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_workspace_directory"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_workspace_for_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_workspace_for_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_workspace_for_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_issue_key"("p_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_issue_key"("p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_issue_key"("p_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."github_login_to_user_id"("login" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."github_login_to_user_id"("login" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."github_login_to_user_id"("login" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_notification"("p_recipient_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_resource_id" "uuid", "p_resource_type" "text", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_notification"("p_recipient_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_resource_id" "uuid", "p_resource_type" "text", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_notification"("p_recipient_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_link" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_resource_id" "uuid", "p_resource_type" "text", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_pr_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_pr_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pr_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_docs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_docs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_docs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pull_request_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pull_request_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pull_request_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."board_views" TO "anon";
GRANT ALL ON TABLE "public"."board_views" TO "authenticated";
GRANT ALL ON TABLE "public"."board_views" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."chat_channel_members" TO "anon";
GRANT ALL ON TABLE "public"."chat_channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."chat_channels" TO "anon";
GRANT ALL ON TABLE "public"."chat_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channels" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."comm_conversation_members" TO "anon";
GRANT ALL ON TABLE "public"."comm_conversation_members" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_conversation_members" TO "service_role";



GRANT ALL ON TABLE "public"."comm_conversations" TO "anon";
GRANT ALL ON TABLE "public"."comm_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."comm_issue_threads" TO "anon";
GRANT ALL ON TABLE "public"."comm_issue_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_issue_threads" TO "service_role";



GRANT ALL ON TABLE "public"."comm_meeting_participants" TO "anon";
GRANT ALL ON TABLE "public"."comm_meeting_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_meeting_participants" TO "service_role";



GRANT ALL ON TABLE "public"."comm_meetings" TO "anon";
GRANT ALL ON TABLE "public"."comm_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."comm_messages_archive" TO "anon";
GRANT ALL ON TABLE "public"."comm_messages_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_messages_archive" TO "service_role";



GRANT ALL ON TABLE "public"."comm_notifications" TO "anon";
GRANT ALL ON TABLE "public"."comm_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."comm_pinned_messages" TO "anon";
GRANT ALL ON TABLE "public"."comm_pinned_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_pinned_messages" TO "service_role";



GRANT ALL ON TABLE "public"."comm_presence" TO "anon";
GRANT ALL ON TABLE "public"."comm_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_presence" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."commits" TO "anon";
GRANT ALL ON TABLE "public"."commits" TO "authenticated";
GRANT ALL ON TABLE "public"."commits" TO "service_role";



GRANT ALL ON TABLE "public"."docs" TO "anon";
GRANT ALL ON TABLE "public"."docs" TO "authenticated";
GRANT ALL ON TABLE "public"."docs" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."field_definitions" TO "anon";
GRANT ALL ON TABLE "public"."field_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."field_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."github_connections" TO "anon";
GRANT ALL ON TABLE "public"."github_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."github_connections" TO "service_role";



GRANT ALL ON TABLE "public"."github_pr_activity" TO "anon";
GRANT ALL ON TABLE "public"."github_pr_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."github_pr_activity" TO "service_role";



GRANT ALL ON TABLE "public"."ide_floating_windows" TO "anon";
GRANT ALL ON TABLE "public"."ide_floating_windows" TO "authenticated";
GRANT ALL ON TABLE "public"."ide_floating_windows" TO "service_role";



GRANT ALL ON TABLE "public"."ide_window_layouts" TO "anon";
GRANT ALL ON TABLE "public"."ide_window_layouts" TO "authenticated";
GRANT ALL ON TABLE "public"."ide_window_layouts" TO "service_role";



GRANT ALL ON TABLE "public"."issue_activity" TO "anon";
GRANT ALL ON TABLE "public"."issue_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_activity" TO "service_role";



GRANT ALL ON TABLE "public"."issue_attachments" TO "anon";
GRANT ALL ON TABLE "public"."issue_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."issues" TO "anon";
GRANT ALL ON TABLE "public"."issues" TO "authenticated";
GRANT ALL ON TABLE "public"."issues" TO "service_role";



GRANT ALL ON TABLE "public"."kic_assessments" TO "anon";
GRANT ALL ON TABLE "public"."kic_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."kic_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."kubric_tenants" TO "anon";
GRANT ALL ON TABLE "public"."kubric_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."kubric_tenants" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."missed_messages" TO "anon";
GRANT ALL ON TABLE "public"."missed_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."missed_messages" TO "service_role";



GRANT ALL ON TABLE "public"."noc_agents" TO "anon";
GRANT ALL ON TABLE "public"."noc_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."noc_agents" TO "service_role";



GRANT ALL ON TABLE "public"."noc_clusters" TO "anon";
GRANT ALL ON TABLE "public"."noc_clusters" TO "authenticated";
GRANT ALL ON TABLE "public"."noc_clusters" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pr_comments" TO "anon";
GRANT ALL ON TABLE "public"."pr_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."pr_comments" TO "service_role";



GRANT ALL ON TABLE "public"."pr_logs" TO "anon";
GRANT ALL ON TABLE "public"."pr_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pr_logs" TO "service_role";



GRANT ALL ON TABLE "public"."pr_reviews" TO "anon";
GRANT ALL ON TABLE "public"."pr_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."pr_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pull_requests" TO "anon";
GRANT ALL ON TABLE "public"."pull_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."pull_requests" TO "service_role";



GRANT ALL ON TABLE "public"."reach_issues" TO "anon";
GRANT ALL ON TABLE "public"."reach_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."reach_issues" TO "service_role";



GRANT ALL ON TABLE "public"."repositories" TO "anon";
GRANT ALL ON TABLE "public"."repositories" TO "authenticated";
GRANT ALL ON TABLE "public"."repositories" TO "service_role";



GRANT ALL ON TABLE "public"."spaces" TO "anon";
GRANT ALL ON TABLE "public"."spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."spaces" TO "service_role";



GRANT ALL ON TABLE "public"."sprints" TO "anon";
GRANT ALL ON TABLE "public"."sprints" TO "authenticated";
GRANT ALL ON TABLE "public"."sprints" TO "service_role";



GRANT ALL ON TABLE "public"."tag_definitions" TO "anon";
GRANT ALL ON TABLE "public"."tag_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."time_clients" TO "anon";
GRANT ALL ON TABLE "public"."time_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."time_clients" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."time_projects" TO "anon";
GRANT ALL ON TABLE "public"."time_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."time_projects" TO "service_role";



GRANT ALL ON TABLE "public"."timesheet_templates" TO "anon";
GRANT ALL ON TABLE "public"."timesheet_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheet_templates" TO "service_role";



GRANT ALL ON TABLE "public"."user_presence" TO "anon";
GRANT ALL ON TABLE "public"."user_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."user_presence" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_saved_views" TO "anon";
GRANT ALL ON TABLE "public"."user_saved_views" TO "authenticated";
GRANT ALL ON TABLE "public"."user_saved_views" TO "service_role";



GRANT ALL ON TABLE "public"."vdr_findings" TO "anon";
GRANT ALL ON TABLE "public"."vdr_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."vdr_findings" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_memberships" TO "anon";
GRANT ALL ON TABLE "public"."workspace_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_settings" TO "anon";
GRANT ALL ON TABLE "public"."workspace_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_settings" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







