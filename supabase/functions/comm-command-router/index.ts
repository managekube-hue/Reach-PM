import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";

type CommandPayload = {
  workspaceId: string;
  conversationId: string;
  input: string;
  issueKey?: string;
};

function parseQuoted(value: string) {
  return value.replace(/^"|"$/g, "").trim();
}

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

    const body = parseJson<CommandPayload>(await req.text());
    if (!body.workspaceId || !body.conversationId || !body.input) {
      return new Response(JSON.stringify({ error: "workspaceId, conversationId, and input are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.input.startsWith("/")) {
      const { data, error } = await supabase.rpc("comm_send_message", {
        p_conversation_id: body.conversationId,
        p_body: body.input,
        p_kind: "message",
        p_command_name: null,
        p_command_payload: {},
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ type: "message", message: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [rawCommand, ...restParts] = body.input.trim().split(" ");
    const command = rawCommand.toLowerCase();
    const rest = restParts.join(" ").trim();

    if (command === "/issue") {
      const [titlePart, assigneePart] = rest.split("@");
      const title = parseQuoted(titlePart || "");

      if (!title) {
        return new Response(JSON.stringify({ error: "Usage: /issue <title> @user-id(optional)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const issueKey = `ISS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const assigneeUserId = assigneePart ? parseQuoted(assigneePart) : null;

      const { data: issue, error: issueError } = await supabase
        .from("reach_issues")
        .insert({
          workspace_id: body.workspaceId,
          issue_key: issueKey,
          title,
          assignee_user_id: assigneeUserId,
          created_by: authData.user.id,
          metadata: { source: "command-router" },
        })
        .select("id,issue_key,title,status,assignee_user_id")
        .single();

      if (issueError) {
        return new Response(JSON.stringify({ error: issueError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: message, error: msgError } = await supabase.rpc("comm_send_message", {
        p_conversation_id: body.conversationId,
        p_body: `Created @issue ${issue.issue_key}: ${issue.title}`,
        p_kind: "command",
        p_command_name: "issue",
        p_command_payload: { issue_id: issue.id, issue_key: issue.issue_key },
      });

      if (msgError) {
        return new Response(JSON.stringify({ error: msgError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ type: "issue", issue, message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (command === "/meet") {
      const [titlePart, whenPart, usersPart] = rest.split("|").map((x) => x?.trim());
      if (!titlePart || !whenPart) {
        return new Response(JSON.stringify({ error: "Usage: /meet <title> | <ISO datetime> | <user-id,user-id(optional)>" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const participantIds = (usersPart || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      const { data: meetingId, error: meetingError } = await supabase.rpc("comm_schedule_meeting", {
        p_workspace_id: body.workspaceId,
        p_title: parseQuoted(titlePart),
        p_scheduled_for: whenPart,
        p_duration_minutes: 30,
        p_participant_ids: participantIds,
        p_conversation_id: body.conversationId,
        p_issue_key: body.issueKey ?? null,
        p_participant_workspaces: [],
      });

      if (meetingError) {
        return new Response(JSON.stringify({ error: meetingError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: message, error: msgError } = await supabase.rpc("comm_send_message", {
        p_conversation_id: body.conversationId,
        p_body: `Scheduled meeting \"${parseQuoted(titlePart)}\" for ${whenPart}`,
        p_kind: "meeting_event",
        p_command_name: "meet",
        p_command_payload: { meeting_id: meetingId },
      });

      if (msgError) {
        return new Response(JSON.stringify({ error: msgError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ type: "meeting", meetingId, message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (command === "/status") {
      const nextStatus = parseQuoted(rest || "").toLowerCase();
      const allowed = ["online", "available", "out_of_office", "last_seen", "offline"];
      if (!allowed.includes(nextStatus)) {
        return new Response(JSON.stringify({ error: "Usage: /status <online|available|out_of_office|last_seen|offline>" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: presenceError } = await supabase
        .from("comm_presence")
        .upsert({
          workspace_id: body.workspaceId,
          user_id: authData.user.id,
          status: nextStatus,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id,user_id" });

      if (presenceError) {
        return new Response(JSON.stringify({ error: presenceError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: message, error: msgError } = await supabase.rpc("comm_send_message", {
        p_conversation_id: body.conversationId,
        p_body: `Status updated to ${nextStatus}`,
        p_kind: "system",
        p_command_name: "status",
        p_command_payload: { status: nextStatus },
      });

      if (msgError) {
        return new Response(JSON.stringify({ error: msgError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ type: "status", status: nextStatus, message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unsupported command: ${command}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
