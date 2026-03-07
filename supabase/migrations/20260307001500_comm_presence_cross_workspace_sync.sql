-- Minimal fix: keep workspace separation, but let users see each other online across spaces.

create or replace function public.comm_join_all_workspaces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
grant execute on function public.comm_join_all_workspaces() to authenticated;
-- Backfill current users so both can appear online in either workspace immediately.
do $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  select w.id, u.id, 'employee'::public.workspace_role
  from public.workspaces w
  cross join auth.users u
  where not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = w.id
      and wm.user_id = u.id
  )
  on conflict (workspace_id, user_id) do nothing;
end
$$;
