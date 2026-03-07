import { createClient } from "jsr:@supabase/supabase-js@2";

export function createAuthedClient(authHeader: string | null) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  }

  return createClient(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function parseJson<T>(raw: string | null): T {
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}
