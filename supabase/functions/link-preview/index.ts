// supabase/functions/link-preview/index.ts
// Spec Part 9.4 (adapted as Edge Function - C-01: no Next.js API routes)
// C-01: MessageInput calls supabase.functions.invoke('link-preview', { body: { url } })
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })

  try {
    const { url } = await req.json()
    if (!url) return new Response(JSON.stringify(null), { headers: { ...CORS, "Content-Type": "application/json" } })

    // Validate URL — reject non-http(s) and private/loopback hosts (SSRF prevention)
    let parsed: URL
    try { parsed = new URL(url) } catch {
      return new Response(JSON.stringify(null), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify(null), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    const host = parsed.hostname.toLowerCase()
    const isPrivate =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" ||
      host.startsWith("10.") || host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    if (isPrivate) {
      return new Response(JSON.stringify(null), { headers: { ...CORS, "Content-Type": "application/json" } })
    }

    // Fetch page HTML with a timeout
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReachBot/1.0)" },
      signal: AbortSignal.timeout(4000),
    })

    if (!resp.ok) {
      return new Response(JSON.stringify(null), { headers: { ...CORS, "Content-Type": "application/json" } })
    }

    const html = await resp.text()

    // Extract meta tags
    function extractMeta(name: string): string {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${name}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
      ]
      for (const p of patterns) {
        const m = html.match(p)
        if (m) return m[1]
      }
      return ""
    }

    function extractTitle(): string {
      return (
        extractMeta("title") ||
        html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
        ""
      )
    }

    const resolvedUrl = resp.url || url
    const hostname = new URL(resolvedUrl).hostname.replace("www.", "")

    const preview = {
      url: resolvedUrl,
      title: extractTitle().trim().slice(0, 120),
      description: extractMeta("description").trim().slice(0, 300),
      image: extractMeta("image") || null,
      domain: hostname,
    }

    return new Response(JSON.stringify(preview), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify(null), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
