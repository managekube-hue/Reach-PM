// supabase/functions/send-notification/index.ts
// Part 15.2 — sends email via Resend when notification prefs allow it
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { user_id, type, title, body, link } = await req.json()
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )
  // Get user email from auth.users via service role
  const { data: { user } } = await supabase.auth.admin.getUserById(user_id)
  const email = user?.email
  // Get notification preferences
  const { data: prefs } = await supabase.from("profiles")
    .select("notification_email, notification_types")
    .eq("id", user_id).single()
  const emailTypes = ["mention", "dm", "issue_assigned"]
  if (email && prefs?.notification_email && emailTypes.includes(type)) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL"),
        to: email,
        subject: title,
        html: `<p>${body ?? title}</p>
          <a href="${Deno.env.get("APP_URL")}${link ?? ""}">
          View in REACH</a>`,
      }),
    })
  }
  return new Response("ok")
})
