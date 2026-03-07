-- Auto-fan-out notifications when a new chat message is inserted.
-- This is what makes the unread badge on channels and DMs work in real-time.
-- Every conversation member (except the sender) gets a comm_notification
-- of kind 'new_message' with the conversation_id in the payload so the
-- frontend unreadCountByConversation map stays accurate.

create or replace function public.comm_fan_out_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
drop trigger if exists trg_comm_messages_fan_out_notif on public.comm_messages;
create trigger trg_comm_messages_fan_out_notif
  after insert on public.comm_messages
  for each row
  execute function public.comm_fan_out_message_notification();
