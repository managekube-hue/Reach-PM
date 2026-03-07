-- Fix: RETURNS TABLE declares OUT params named id, name, slug which shadow
-- column names inside the function body. PostgreSQL raises SQLSTATE 42702
-- "column reference is ambiguous" on ON CONFLICT (id) and ON CONFLICT (slug).
-- Solution: add #variable_conflict use_column pragma so column refs win over
-- PL/pgSQL variable names when both are in scope.
-- Also removes unnecessary SET LOCAL row_security (SECURITY DEFINER already
-- runs as superuser/owner and bypasses RLS).

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
$$;
grant execute on function public.comm_bootstrap_workspace_context(text) to authenticated;
