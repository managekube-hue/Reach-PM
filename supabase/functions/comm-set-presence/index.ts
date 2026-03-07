import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";

type PresencePayload = {
  workspaceId: string;
  status: "online" | "available" | "out_of_office" | "last_seen" | "offline";
  availabilityText?: string;
  issueKey?: string;
  filePath?: string;
  lineNumber?: number;
  cursorMeta?: Record<string, unknown>;
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

    const body = parseJson<PresencePayload>(await req.text());
    if (!body.workspaceId || !body.status) {
      return new Response(JSON.stringify({ error: "workspaceId and status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      workspace_id: body.workspaceId,
      user_id: authData.user.id,
      status: body.status,
      availability_text: body.availabilityText ?? "",
      issue_key: body.issueKey ?? null,
      file_path: body.filePath ?? null,
      line_number: body.lineNumber ?? null,
      cursor_meta: body.cursorMeta ?? {},
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("comm_presence")
      .upsert(payload, { onConflict: "workspace_id,user_id" })
      .select("workspace_id,user_id,status,availability_text,issue_key,file_path,line_number,last_seen_at,updated_at")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ presence: data }), {
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
