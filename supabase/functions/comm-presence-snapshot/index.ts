import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";

type SnapshotPayload = {
  workspaceId: string;
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

    const body = parseJson<SnapshotPayload>(await req.text());
    if (!body.workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: directoryRows, error: directoryError } = await supabase.rpc("comm_workspace_directory", {
      p_workspace_id: body.workspaceId,
    });

    if (directoryError) {
      return new Response(JSON.stringify({ error: directoryError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: presenceRows, error: presenceError } = await supabase
      .from("comm_presence")
      .select("user_id,status,last_seen_at")
      .eq("workspace_id", body.workspaceId);

    if (presenceError) {
      return new Response(JSON.stringify({ error: presenceError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const presenceByUser = new Map<string, { status: string; last_seen_at: string | null }>();
    for (const row of presenceRows || []) {
      presenceByUser.set(row.user_id, { status: row.status, last_seen_at: row.last_seen_at });
    }

    const nowMs = Date.now();
    const members = (directoryRows || []).map((row: any) => {
      const presence = presenceByUser.get(row.user_id);
      const lastSeenMs = presence?.last_seen_at ? new Date(presence.last_seen_at).getTime() : 0;
      const ageMs = lastSeenMs ? nowMs - lastSeenMs : Number.MAX_SAFE_INTEGER;
      const isOnlineWindow = ageMs <= 90_000;

      let status = (presence?.status || "offline") as "online" | "available" | "out_of_office" | "last_seen" | "offline";
      if (!presence) {
        status = "offline";
      } else if (!isOnlineWindow && status !== "out_of_office") {
        status = "last_seen";
      }

      return {
        userId: row.user_id,
        userName: row.display_name || row.email || row.user_id,
        role: row.role,
        status,
        online: status === "online" || status === "available" || status === "out_of_office",
        lastActiveAt: presence?.last_seen_at || null,
      };
    });

    return new Response(JSON.stringify({
      workspaceId: body.workspaceId,
      generatedAt: new Date().toISOString(),
      members,
    }), {
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
