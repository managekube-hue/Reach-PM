-- Migration: notify_on_universal_mention trigger
-- Spec Part 19.3 — fires notification on every INSERT to universal_mentions

CREATE OR REPLACE FUNCTION notify_on_universal_mention()
RETURNS TRIGGER AS $$
DECLARE
  actor_name text;
BEGIN
  SELECT display_name INTO actor_name FROM profiles WHERE id = NEW.actor_id;
  INSERT INTO notifications (tenant_id, user_id, type, title, body, link, actor_id)
  VALUES (
    NEW.tenant_id,
    NEW.mentioned_user_id,
    'mention',
    COALESCE(actor_name, 'Someone') || ' mentioned you in ' || NEW.surface,
    LEFT(COALESCE(NEW.context_text, ''), 120),
    COALESCE(NEW.link, ''),
    NEW.actor_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS t_notify_universal_mention ON universal_mentions;
CREATE TRIGGER t_notify_universal_mention
  AFTER INSERT ON universal_mentions
  FOR EACH ROW EXECUTE FUNCTION notify_on_universal_mention();
