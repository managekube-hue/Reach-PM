-- Allow workspace admins/owners to delete channel conversations.
-- Deletion cascades to related conversation members/messages via FK rules.

create or replace function public.comm_delete_channel(
  p_workspace_id uuid,
  p_conversation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.workspace_role;
  v_deleted_conversation_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.comm_is_workspace_member(p_workspace_id, v_actor) then
    raise exception 'Not a member of workspace';
  end if;

  select wm.role
    into v_actor_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = v_actor;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'Only workspace admins or owners can delete channels';
  end if;

  select c.id
    into v_deleted_conversation_id
  from public.comm_conversations c
  where c.id = p_conversation_id
    and c.workspace_id = p_workspace_id
    and c.kind = 'channel'
  limit 1;

  if v_deleted_conversation_id is null then
    raise exception 'Channel not found in workspace';
  end if;

  delete from public.comm_conversations c
  where c.id = v_deleted_conversation_id
    and c.workspace_id = p_workspace_id
    and c.kind = 'channel';

  return v_deleted_conversation_id;
end
$$;

grant execute on function public.comm_delete_channel(uuid, uuid) to authenticated;
