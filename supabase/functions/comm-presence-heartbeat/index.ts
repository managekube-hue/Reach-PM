import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";

type HeartbeatPayload = {
  workspaceId: string;
  status?: "online" | "available" | "out_of_office" | "last_seen" | "offline";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createAuthedClient(authHeader);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = parseJson<HeartbeatPayload>(await req.text());
    if (!body.workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = body.status ?? "available";
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("comm_presence")
      .upsert(
        {
          workspace_id: body.workspaceId,
          user_id: authData.user.id,
          status,
          last_seen_at: now,
          updated_at: now,
        },
        { onConflict: "workspace_id,user_id" }
      );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
