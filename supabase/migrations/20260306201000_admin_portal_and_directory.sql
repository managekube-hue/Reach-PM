-- Admin portal and user-friendly directory RPCs for communication UI.

create or replace function public.comm_workspace_directory(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role public.workspace_role,
  default_workspace_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
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
grant execute on function public.comm_workspace_directory(uuid) to authenticated;
create or replace function public.comm_set_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
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
grant execute on function public.comm_set_member_role(uuid, uuid, public.workspace_role) to authenticated;
create or replace function public.comm_find_user_by_name(p_name text)
returns table (
  user_id uuid,
  display_name text,
  email text,
  default_workspace_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
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
grant execute on function public.comm_find_user_by_name(text) to authenticated;
-- Bootstrap: if a user profile is named managekube, ensure admin role where applicable.
do $$
begin
  update public.workspace_members wm
  set role = 'admin'
  from public.profiles p
  where p.id = wm.user_id
    and lower(coalesce(p.display_name, '')) = 'managekube'
    and wm.role = 'employee';
end
$$;
