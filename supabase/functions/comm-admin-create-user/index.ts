import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";
const ALLOWED_ROLES = new Set([
  "owner",
  "admin",
  "employee"
]);
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    const authedClient = createAuthedClient(authHeader);
    const { data: authData, error: authError } = await authedClient.auth.getUser();
    if (authError || !authData.user) {
      return json(401, {
        error: "Unauthorized"
      });
    }
    const payload = parseJson(await req.text());
    const workspaceId = String(payload.workspaceId || "").trim();
    const email = String(payload.email || "").trim().toLowerCase();
    const displayName = String(payload.displayName || "").trim();
    const password = String(payload.password || "").trim();
    const requestedRole = String(payload.role || "employee").trim().toLowerCase();
    const role = ALLOWED_ROLES.has(requestedRole) ? requestedRole : "employee";
    if (!workspaceId || !email || !displayName) {
      return json(400, {
        error: "workspaceId, email, and displayName are required."
      });
    }
    const { data: actorMembership, error: membershipError } = await authedClient.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", authData.user.id).maybeSingle();
    if (membershipError) {
      return json(400, {
        error: membershipError.message
      });
    }
    if (!actorMembership || actorMembership.role !== "owner" && actorMembership.role !== "admin") {
      return json(403, {
        error: "Only workspace admins and owners can create users."
      });
    }
    const projectUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!projectUrl || !serviceRoleKey) {
      return json(500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
      });
    }
    const serviceClient = createClient(projectUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    const createResponse = await serviceClient.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        name: displayName
      }
    });
    if (createResponse.error || !createResponse.data.user) {
      const errMsg = createResponse.error?.message || "Unable to create user";
      const maybeConflict = /already|exists|registered|duplicate/i.test(errMsg);
      return json(maybeConflict ? 409 : 400, {
        error: errMsg
      });
    }
    const createdUserId = createResponse.data.user.id;
    const { error: profileError } = await serviceClient.from("profiles").upsert({
      id: createdUserId,
      email,
      display_name: displayName,
      default_workspace_id: workspaceId
    }, {
      onConflict: "id"
    });
    if (profileError) {
      return json(400, {
        error: profileError.message
      });
    }
    const membershipRole = actorMembership.role === "admin" && role === "owner" ? "employee" : role;
    const { error: memberError } = await serviceClient.from("workspace_members").upsert({
      workspace_id: workspaceId,
      user_id: createdUserId,
      role: membershipRole
    }, {
      onConflict: "workspace_id,user_id"
    });
    if (memberError) {
      return json(400, {
        error: memberError.message
      });
    }
    return json(200, {
      userId: createdUserId,
      email,
      displayName,
      workspaceId,
      role: membershipRole,
      invited: true
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
