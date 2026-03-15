// supabase/functions/sync-emails/index.ts
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
  if (authErr || !user)
    return new Response("Unauthorized", { status: 401 })

  const { provider, issue_id } = await req.json()

  const { data: tokenRow } = await supabase
    .from("integration_tokens")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider ?? "google")
    .single()

  if (!tokenRow)
    return new Response("No token", { status: 400 })

  const { data: profile } = await supabase
    .from("profiles").select("tenant_id").eq("id", user.id).single()

  let emails: any[] = []

  if (tokenRow.provider === "google") {
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX",
      { headers: { Authorization: `Bearer ${tokenRow.access_token}` } }
    )
    const list = await listRes.json()
    for (const m of (list.messages ?? []).slice(0, 20)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers: { Authorization: `Bearer ${tokenRow.access_token}` } }
      )
      const msg = await msgRes.json()
      const headers = msg.payload?.headers ?? []
      const get = (name: string) => headers.find((h: any) => h.name === name)?.value ?? ""

      emails.push({
        provider: "google",
        thread_id: msg.threadId,
        message_id: msg.id,
        subject: get("Subject"),
        from_email: get("From").match(/<(.+)>/)?.[1] ?? get("From"),
        from_name: get("From").match(/^([^<]+)/)?.[1]?.trim() ?? "",
        snippet: msg.snippet,
        is_read: !msg.labelIds?.includes("UNREAD"),
        provider_received_at: new Date(Number(msg.internalDate)).toISOString(),
        in_reply_to: get("In-Reply-To") || null,
      })
    }
  } else if (tokenRow.provider === "microsoft") {
    const listRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc",
      { headers: { Authorization: `Bearer ${tokenRow.access_token}` } }
    )
    const list = await listRes.json()
    for (const m of (list.value ?? []).slice(0, 20)) {
      emails.push({
        provider: "microsoft",
        thread_id: m.conversationId,
        message_id: m.id,
        subject: m.subject,
        from_email: m.from?.emailAddress?.address ?? "",
        from_name: m.from?.emailAddress?.name ?? "",
        snippet: m.bodyPreview,
        is_read: m.isRead,
        provider_received_at: m.receivedDateTime,
        in_reply_to: m.conversationId || null,
      })
    }
  }

  const rows = emails.map(e => ({
    ...e,
    tenant_id: profile?.tenant_id,
    user_id: user.id,
    issue_id: issue_id ?? null,
  }))

  if (rows.length > 0) {
    await supabase.from("email_threads").upsert(rows,
      { onConflict: "user_id,provider,message_id" })
  }

  return new Response(JSON.stringify({ synced: rows.length }),
    { headers: { ...CORS, "Content-Type": "application/json" } })
})
