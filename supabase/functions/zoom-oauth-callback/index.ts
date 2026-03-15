// supabase/functions/zoom-oauth-callback/index.ts
// Part 14.1 / 20.4 — Zoom OAuth callback, stores token, marks zoom_connected on profile
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const appUrl = Deno.env.get("APP_URL") ?? ""

  if (!code) {
    return Response.redirect(`${appUrl}/settings?error=no_code`, 302)
  }

  const creds = btoa(`${Deno.env.get("ZOOM_CLIENT_ID")}:${Deno.env.get("ZOOM_CLIENT_SECRET")}`)

  const tokenRes = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: Deno.env.get("ZOOM_REDIRECT_URI")!,
    }),
  })
  const tokens = await tokenRes.json()

  const authHeader = req.headers.get("Authorization") ?? ""
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))

  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("id", user.id).single()

    await supabase.from("integration_tokens").upsert({
      user_id: user.id,
      tenant_id: profile?.tenant_id,
      provider: "zoom",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: "user_id,provider" })

    // Part 20.4 — mark zoom_connected flag on profile
    await supabase.from("profiles").update({ zoom_connected: true }).eq("id", user.id)
  }

  return Response.redirect(`${appUrl}/settings?success=zoom`, 302)
})
