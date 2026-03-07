-- Fix channel creation under RLS by providing atomic, security-definer RPCs.

create or replace function public.comm_create_channel(
  p_workspace_id uuid,
  p_name text,
  p_topic text default '',
  p_is_private boolean default false,
  p_slug text default null
)
returns table (
  id uuid,
  name text,
  kind public.comm_conversation_kind,
  workspace_id uuid,
  slug text
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.comm_create_channel(uuid, text, text, boolean, text) to authenticated;

create or replace function public.comm_ensure_default_channel(
  p_workspace_id uuid,
  p_slug text default 'general',
  p_name text default 'general'
)
returns table (
  id uuid,
  name text,
  kind public.comm_conversation_kind,
  workspace_id uuid,
  slug text
)
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function public.comm_ensure_default_channel(uuid, text, text) to authenticated;
