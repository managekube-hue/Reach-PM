-- Ensure every authenticated user has a workspace/member/profile context for communication flows.

create or replace function public.comm_bootstrap_workspace_context(
  p_preferred_slug text default null
)
returns table (
  id uuid,
  name text,
  slug text,
  is_default boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_display_name text;
  v_default_workspace_id uuid;
  v_workspace_slug text;
  v_workspace_name text;
  v_workspace_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select u.email,
         coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(coalesce(u.email, ''), '@', 1))
    into v_actor_email, v_display_name
  from auth.users u
  where u.id = v_actor;

  select p.default_workspace_id
    into v_default_workspace_id
  from public.profiles p
  where p.id = v_actor;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = v_actor
  ) then
    v_workspace_slug := coalesce(nullif(lower(btrim(p_preferred_slug)), ''), 'ws-' || substr(v_actor::text, 1, 12));
    v_workspace_slug := regexp_replace(v_workspace_slug, '[^a-z0-9-]+', '-', 'g');
    v_workspace_slug := regexp_replace(v_workspace_slug, '(^-+|-+$)', '', 'g');

    if v_workspace_slug = '' then
      v_workspace_slug := 'ws-' || substr(v_actor::text, 1, 12);
    end if;

    v_workspace_name := coalesce(nullif(v_display_name, ''), 'Workspace') || '''s Workspace';

    insert into public.workspaces (slug, name, owner_user_id, owner_id)
    values (v_workspace_slug, v_workspace_name, v_actor, v_actor)
    on conflict (slug) do update
      set owner_user_id = coalesce(public.workspaces.owner_user_id, excluded.owner_user_id)
    returning public.workspaces.id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_actor, 'owner')
    on conflict (workspace_id, user_id) do update
      set role = 'owner';

    v_default_workspace_id := coalesce(v_default_workspace_id, v_workspace_id);
  end if;

  if v_default_workspace_id is null and nullif(lower(btrim(p_preferred_slug)), '') is not null then
    select w.id
      into v_default_workspace_id
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = v_actor
    where lower(w.slug) = lower(btrim(p_preferred_slug))
    limit 1;
  end if;

  if v_default_workspace_id is null then
    select wm.workspace_id
      into v_default_workspace_id
    from public.workspace_members wm
    where wm.user_id = v_actor
    order by wm.joined_at asc
    limit 1;
  end if;

  insert into public.profiles (id, email, display_name, default_workspace_id)
  values (v_actor, v_actor_email, v_display_name, v_default_workspace_id)
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        default_workspace_id = coalesce(public.profiles.default_workspace_id, excluded.default_workspace_id);

  return query
  select w.id,
         w.name,
         w.slug,
         (w.id = v_default_workspace_id) as is_default
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = v_actor
  order by (w.id = v_default_workspace_id) desc, w.created_at asc;
end
$$;
grant execute on function public.comm_bootstrap_workspace_context(text) to authenticated;
