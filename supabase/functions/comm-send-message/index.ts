import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";

type SendMessagePayload = {
  conversationId: string;
  body: string;
  kind?: "message" | "system" | "command" | "meeting_event";
  parentMessageId?: string;
  commandName?: string;
  commandPayload?: Record<string, unknown>;
  attachments?: Array<Record<string, unknown>>;
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

    const body = parseJson<SendMessagePayload>(await req.text());

    if (!body.conversationId || typeof body.body !== "string") {
      return new Response(JSON.stringify({ error: "conversationId and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase.rpc("comm_send_message", {
      p_conversation_id: body.conversationId,
      p_body: body.body,
      p_parent_message_id: body.parentMessageId ?? null,
      p_kind: body.kind ?? "message",
      p_command_name: body.commandName ?? null,
      p_command_payload: body.commandPayload ?? {},
      p_attachments: body.attachments ?? [],
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: data }), {
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
