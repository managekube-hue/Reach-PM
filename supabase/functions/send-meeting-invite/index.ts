// supabase/functions/send-meeting-invite/index.ts
// Part 15.3 — sends email invites to meeting participants via Resend
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve(async (req) => {
  const { to_emails, join_url, title, scheduled_at } = await req.json()
  for (const email of (to_emails ?? [])) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL"),
        to: email,
        subject: `REACH Invite: ${title}`,
        html: `
          <h2>${title}</h2>
          ${scheduled_at
            ? `<p>${new Date(scheduled_at).toLocaleString()}</p>` : ""}
          <a href="${join_url}" style="display:inline-block;padding:12px 24px;
            background:#48B8FF;color:#1A1A2E;text-decoration:none;
            border-radius:8px;font-weight:bold;">Join Meeting</a>
          <p style="color:#888;font-size:12px">Or: ${join_url}</p>
        `,
      }),
    })
  }
  return new Response(JSON.stringify({ sent: to_emails?.length ?? 0 }),
    { headers: { "Content-Type": "application/json" } })
})
