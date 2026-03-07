import { corsHeaders } from "../_shared/cors.ts";
import { createAuthedClient, parseJson } from "../_shared/client.ts";

type ParticipantWorkspace = { userId: string; workspaceId: string };

type ScheduleMeetingPayload = {
  workspaceId: string;
  title: string;
  scheduledFor: string;
  durationMinutes?: number;
  participantIds?: string[];
  participantWorkspaces?: ParticipantWorkspace[];
  conversationId?: string;
  issueKey?: string;
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

    const body = parseJson<ScheduleMeetingPayload>(await req.text());
    if (!body.workspaceId || !body.title || !body.scheduledFor) {
      return new Response(JSON.stringify({ error: "workspaceId, title, and scheduledFor are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const participantWorkspaces = (body.participantWorkspaces ?? []).map((item) => ({
      user_id: item.userId,
      workspace_id: item.workspaceId,
    }));

    const { data, error } = await supabase.rpc("comm_schedule_meeting", {
      p_workspace_id: body.workspaceId,
      p_title: body.title,
      p_scheduled_for: body.scheduledFor,
      p_duration_minutes: body.durationMinutes ?? 30,
      p_participant_ids: body.participantIds ?? [],
      p_conversation_id: body.conversationId ?? null,
      p_issue_key: body.issueKey ?? null,
      p_participant_workspaces: participantWorkspaces,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ meetingId: data }), {
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
