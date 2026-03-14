// ============================================================
// supabase/functions/webrtc-signal/index.ts
// Supabase Broadcast-based WebRTC signaling server.
// Replaces Daily.co mock entirely.
// Flow: join → exchange offers/answers/candidates → call
// STUN: Google public STUN servers (free, no account needed)
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── STUN servers (public, free, no auth needed) ────────────
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  // Optional: add TURN if you need relay (e.g. Cloudflare TURN / Twilio TURN)
  // { urls: "turn:turn.example.com", username: "...", credential: "..." }
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
    );
    if (!user) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { action, roomId, signal, targetUserId } = body as {
      action:        "join" | "leave" | "offer" | "answer" | "candidate";
      roomId:        string;
      signal?:       unknown;        // RTCSessionDescriptionInit or RTCIceCandidateInit
      targetUserId?: string;
    };

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, display_name, avatar_url, color")
      .eq("id", user.id)
      .single();

    if (!profile) return new Response("Profile not found", { status: 404 });

    // Validate room belongs to tenant (room = standup ID)
    if (action === "join" || action === "offer") {
      const { data: standup } = await supabase
        .from("standups")
        .select("id, tenant_id, title")
        .eq("id", roomId)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (!standup) {
        return new Response(JSON.stringify({ error: "Room not found or access denied" }), {
          status: 404, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
    }

    // Broadcast signal via Supabase Realtime channel
    // Browser peers listen on the same channel and handle peer negotiation
    const channelName = `webrtc:${profile.tenant_id}:${roomId}`;

    await supabase.channel(channelName).send({
      type:    "broadcast",
      event:   action,
      payload: {
        from:           user.id,
        fromName:       profile.display_name,
        fromAvatar:     profile.avatar_url,
        fromColor:      profile.color,
        to:             targetUserId ?? "all",  // "all" = room broadcast
        signal,
        roomId,
        timestamp:      Date.now(),
      },
    });

    // On join: return ICE config + current participants
    if (action === "join") {
      // Get active participants from presence
      const { data: presences } = await supabase
        .from("chat_presence")
        .select("user_id, profiles(display_name, avatar_url, color)")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "online");

      return new Response(JSON.stringify({
        ice_servers:  ICE_SERVERS,
        room_id:      roomId,
        user_id:      user.id,
        channel_name: channelName,
        participants: presences ?? [],
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
