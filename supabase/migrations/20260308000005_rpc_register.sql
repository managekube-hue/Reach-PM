CREATE OR REPLACE FUNCTION register_tenant_admin(
  p_user_id uuid,
  p_tenant_name text,
  p_slug text,
  p_display_name text
) RETURNS uuid AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Insert tenant and return its generated ID
  INSERT INTO tenants (name, slug)
  VALUES (p_tenant_name, p_slug)
  RETURNING id INTO v_tenant_id;

  -- Insert profile for the user linking them to the tenant
  INSERT INTO profiles (id, tenant_id, display_name, role)
  VALUES (p_user_id, v_tenant_id, p_display_name, 'admin');

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;