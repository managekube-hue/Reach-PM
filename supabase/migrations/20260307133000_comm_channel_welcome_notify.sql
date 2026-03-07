-- Make channel creation workflow server-side: create channel, add creator,
-- seed welcome system message, and fan-out notifications.

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
  v_welcome_id uuid;
  v_payload jsonb;
  v_member record;
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

  insert into public.comm_messages (
    conversation_id,
    workspace_id,
    sender_user_id,
    kind,
    body
  ) values (
    v_id,
    p_workspace_id,
    v_actor,
    'system',
    format('Welcome to #%s. This channel is now live.', v_name)
  )
  returning id into v_welcome_id;

  v_payload := jsonb_build_object(
    'conversation_id', v_id,
    'conversation_name', v_name,
    'message_id', v_welcome_id,
    'message_preview', format('Welcome to #%s. This channel is now live.', v_name),
    'pinned', true,
    'created_at', now()
  );

  for v_member in
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
  loop
    perform public.comm_notify_user(
      p_workspace_id,
      v_member.user_id,
      'channel_message',
      v_payload
    );
  end loop;

  return query
  select c.id, c.name, c.kind, c.workspace_id, c.slug
  from public.comm_conversations c
  where c.id = v_id;
end
$$;

grant execute on function public.comm_create_channel(uuid, text, text, boolean, text) to authenticated;
