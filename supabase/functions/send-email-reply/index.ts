// supabase/functions/send-email-reply/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const authHeader = req.headers.get("Authorization") ?? ""
  const { data: { user }, error: authErr } =
    await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (authErr || !user) return new Response("Unauthorized", { status: 401 })

  const { to, subject, body, thread_id, in_reply_to, issue_id, provider } = await req.json()

  const { data: tokenRow } = await supabase
    .from("integration_tokens")
    .select("*").eq("user_id", user.id).eq("provider", provider ?? "google").single()

  if (!tokenRow) return new Response("No token", { status: 400 })

  if (tokenRow.provider === "google") {
    const rawMessage = [
      `To: ${to}`,
      `Subject: ${in_reply_to ? "Re: " : ""}${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      in_reply_to ? `In-Reply-To: ${in_reply_to}` : "",
      in_reply_to ? `References: ${in_reply_to}` : "",
      "",
      body,
    ].filter(Boolean).join("\r\n")

    const encoded = btoa(rawMessage)
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

    const sendRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: encoded,
          ...(thread_id ? { threadId: thread_id } : {}),
        }),
      }
    )
    const sent = await sendRes.json()
    return new Response(JSON.stringify({ message_id: sent.id }),
      { headers: { ...CORS, "Content-Type": "application/json" } })

  } else if (tokenRow.provider === "microsoft") {
    await fetch(
      `https://graph.microsoft.com/v1.0/me/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: (in_reply_to ? "Re: " : "") + subject,
            body: { contentType: "HTML", content: body },
            toRecipients: [{ emailAddress: { address: to } } ],
          },
          saveToSentItems: true,
        }),
      }
    )
    return new Response(JSON.stringify({ sent: true }),
      { headers: { ...CORS, "Content-Type": "application/json" } })
  }

  return new Response("Unknown provider", { status: 400 })
})
