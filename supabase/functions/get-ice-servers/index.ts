// supabase/functions/get-ice-servers/index.ts
// Spec Part 12.1 — Returns RTCIceServer[] from env-configured TURN/STUN servers
// Priority: Metered.ca → Twilio TURN → coturn env vars → Google STUN fallback
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  const iceServers: RTCIceServer[] = []

  // Option 1: Metered.ca managed TURN (METERED_API_KEY + METERED_DOMAIN)
  const meteredKey = Deno.env.get("METERED_API_KEY")
  const meteredDomain = Deno.env.get("METERED_DOMAIN")
  if (meteredKey && meteredDomain) {
    try {
      const resp = await fetch(
        `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (resp.ok) {
        const servers: RTCIceServer[] = await resp.json()
        iceServers.push(...servers)
      }
    } catch {
      // fall through to next option
    }
  }

  // Option 2: Twilio Programmable Video TURN (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN)
  if (iceServers.length === 0) {
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")
    if (twilioSid && twilioToken) {
      try {
        const creds = btoa(`${twilioSid}:${twilioToken}`)
        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Tokens.json`,
          {
            method: "POST",
            headers: { Authorization: `Basic ${creds}` },
            signal: AbortSignal.timeout(4000),
          }
        )
        if (resp.ok) {
          const data = await resp.json()
          if (Array.isArray(data.ice_servers)) {
            iceServers.push(...data.ice_servers)
          }
        }
      } catch {
        // fall through to next option
      }
    }
  }

  // Option 3: Self-hosted coturn (TURN_SERVER_URL + TURN_SERVER_USERNAME + TURN_SERVER_CREDENTIAL)
  if (iceServers.length === 0) {
    const turnUrl = Deno.env.get("TURN_SERVER_URL")
    const turnUsername = Deno.env.get("TURN_SERVER_USERNAME")
    const turnCredential = Deno.env.get("TURN_SERVER_CREDENTIAL")
    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential })
      // Also add STUN on the same host if using coturn convention
      const stunUrl = turnUrl.replace(/^turn:/, "stun:").split("?")[0]
      iceServers.push({ urls: stunUrl })
    }
  }

  // Fallback: public Google STUN only
  if (iceServers.length === 0) {
    iceServers.push({ urls: "stun:stun.l.google.com:19302" })
    iceServers.push({ urls: "stun:stun1.l.google.com:19302" })
  }

  return new Response(JSON.stringify({ iceServers }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  })
})
