// supabase/functions/google-oauth-callback/index.ts
// Part 18.1 / 13 — Google OAuth callback, stores tokens in integration_tokens
// Adapted from Next.js API route to Deno Edge Function for Vite SPA
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid", "email", "profile",
].join(" ")

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const appUrl = Deno.env.get("APP_URL") ?? ""

  if (!code) {
    return Response.redirect(`${appUrl}/settings?error=no_code`, 302)
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI")!,
      grant_type: "authorization_code",
    }),
  })
  const tokens = await tokenRes.json()

  // Get Google profile
  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const gProfile = await profileRes.json()

  // Identify user from Authorization header (the SPA passes Bearer token in state or header)
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
      provider: "google",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: GOOGLE_SCOPES.split(" "),
      provider_email: gProfile.email,
    }, { onConflict: "user_id,provider" })
  }

  return Response.redirect(`${appUrl}/settings?success=google`, 302)
})
