// supabase/functions/refresh-oauth-tokens/index.ts
// Part 15.4 — runs on cron, refreshes Google + Microsoft tokens expiring within 60 min
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )
  // Find tokens expiring in next 60 minutes
  const { data: expiring } = await supabase
    .from("integration_tokens").select("*")
    .lt("token_expiry", new Date(Date.now() + 3600000).toISOString())
  let refreshed = 0
  for (const t of expiring ?? []) {
    let newTokens: any = null
    if (t.provider === "google") {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: t.refresh_token,
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          grant_type: "refresh_token",
        }),
      })
      newTokens = await r.json()
    } else if (t.provider === "microsoft") {
      const r = await fetch(
        `https://login.microsoftonline.com/${Deno.env.get("AZURE_TENANT_ID")}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: t.refresh_token,
            client_id: Deno.env.get("AZURE_CLIENT_ID")!,
            client_secret: Deno.env.get("AZURE_CLIENT_SECRET")!,
            grant_type: "refresh_token",
          }),
        }
      )
      newTokens = await r.json()
    }
    if (newTokens?.access_token) {
      await supabase.from("integration_tokens").update({
        access_token: newTokens.access_token,
        token_expiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      }).eq("id", t.id)
      refreshed++
    }
  }
  return new Response(JSON.stringify({ refreshed }),
    { headers: { "Content-Type": "application/json" } })
})
