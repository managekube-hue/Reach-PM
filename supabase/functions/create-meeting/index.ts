// supabase/functions/create-meeting/index.ts
// Spec Part 11 (adapted - C-02: workspace_id = profile.default_workspace_id)
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let code = ""
  for (let i = 0; i < 3; i++) {
    if (i > 0) code += "-"
    for (let j = 0; j < 4; j++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return code
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  )

  try {
    // Verify JWT and get user
    const authHeader = req.headers.get("authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const { channel_id, title } = await req.json()
    if (!channel_id) {
      return new Response(JSON.stringify({ error: "channel_id is required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    // Look up profile for workspace_id (C-02)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, display_name, default_workspace_id")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      })
    }

    const workspaceId = profile.default_workspace_id
    const roomCode = generateRoomCode()
    const meetingTitle = title || `Meeting in channel`

    // Create meeting row
    const { data: meeting, error: meetingErr } = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspaceId,
        channel_id,
        room_code: roomCode,
        title: meetingTitle,
        status: "active",
        created_by: user.id,
        started_at: new Date().toISOString(),
      })
      .select("id, room_code")
      .single()

    if (meetingErr || !meeting) {
      throw meetingErr ?? new Error("Failed to create meeting")
    }

    // Add creator as first participant
    await supabase.from("meeting_participants").insert({
      meeting_id: meeting.id,
      user_id: user.id,
      workspace_id: workspaceId,
      joined_at: new Date().toISOString(),
    })

    // Post a system message to the channel so members see the invite
    const joinUrl = `${Deno.env.get("APP_URL") ?? ""}/meeting/${roomCode}`
    await supabase.from("messages").insert({
      channel_id,
      workspace_id: workspaceId,
      author_id: user.id,
      body: `${profile.display_name} started a meeting: **${meetingTitle}**\n[Join now](${joinUrl})`,
      is_system: true,
    })

    return new Response(
      JSON.stringify({ meeting_id: meeting.id, room_code: meeting.room_code, join_url: joinUrl }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
