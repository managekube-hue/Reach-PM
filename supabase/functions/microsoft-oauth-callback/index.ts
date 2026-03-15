// supabase/functions/microsoft-oauth-callback/index.ts
// Part 13.2 — Microsoft OAuth callback, stores tokens in integration_tokens
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const MS_SCOPES = [
  "offline_access", "User.Read",
  "Mail.Read", "Mail.Send", "Calendars.Read",
].join(" ")

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const appUrl = Deno.env.get("APP_URL") ?? ""

  if (!code) {
    return Response.redirect(`${appUrl}/settings?error=no_code`, 302)
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get("AZURE_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("AZURE_CLIENT_ID")!,
        client_secret: Deno.env.get("AZURE_CLIENT_SECRET")!,
        redirect_uri: Deno.env.get("AZURE_REDIRECT_URI")!,
        grant_type: "authorization_code",
        scope: MS_SCOPES,
      }),
    }
  )
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
      provider: "microsoft",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: MS_SCOPES.split(" "),
    }, { onConflict: "user_id,provider" })
  }

  return Response.redirect(`${appUrl}/settings?success=microsoft`, 302)
})
