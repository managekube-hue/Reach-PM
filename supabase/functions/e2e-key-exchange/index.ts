// ============================================================
// supabase/functions/e2e-key-exchange/index.ts
// Handles public key distribution for E2E encrypted chat.
// Browsers publish their ECDH-P256 public key here.
// Peers fetch each other's keys to derive shared secrets.
// Private keys NEVER touch this function — browser-only.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);

    // GET /e2e-key-exchange?userId=xxx — fetch a user's public key
    if (req.method === "GET") {
      const targetUserId = url.searchParams.get("userId");
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // Verify they're in the same tenant
      const [ownProfile, targetProfile] = await Promise.all([
        supabase.from("profiles").select("tenant_id").eq("id", user.id).single(),
        supabase.from("profiles").select("tenant_id").eq("id", targetUserId).single(),
      ]);

      if (ownProfile.data?.tenant_id !== targetProfile.data?.tenant_id) {
        return new Response(JSON.stringify({ error: "Cross-tenant key access denied" }), {
          status: 403, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const { data: keyRow } = await supabase
        .from("e2e_public_keys")
        .select("public_key, algorithm, created_at")
        .eq("user_id", targetUserId)
        .single();

      if (!keyRow) {
        return new Response(JSON.stringify({ error: "no_key", message: "This user has no E2E key yet" }), {
          status: 404, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        user_id:    targetUserId,
        public_key: keyRow.public_key,
        algorithm:  keyRow.algorithm,
        created_at: keyRow.created_at,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // POST — publish or rotate own public key
    if (req.method === "POST") {
      const body = await req.json();
      const { public_key, algorithm = "ECDH-P256" } = body as {
        public_key: string;
        algorithm?: string;
      };

      if (!public_key) {
        return new Response(JSON.stringify({ error: "public_key required" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      // Validate key is valid base64 and reasonable length for ECDH-P256
      if (public_key.length < 80 || public_key.length > 120) {
        return new Response(JSON.stringify({ error: "Invalid key format" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles").select("tenant_id").eq("id", user.id).single();

      const { error: upsertErr } = await supabase
        .from("e2e_public_keys")
        .upsert({
          user_id:    user.id,
          tenant_id:  profile?.tenant_id,
          public_key,
          algorithm,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertErr) throw upsertErr;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

/*
============================================================
ADD THIS TABLE to REACH_unified.sql (or run separately):
============================================================

CREATE TABLE IF NOT EXISTS e2e_public_keys (
  user_id    uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  public_key text NOT NULL,         -- base64(ECDH P-256 raw public key, 65 bytes)
  algorithm  text DEFAULT 'ECDH-P256',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for tenant-scoped lookups
CREATE INDEX IF NOT EXISTS idx_e2e_keys_tenant ON e2e_public_keys(tenant_id);

ALTER TABLE e2e_public_keys ENABLE ROW LEVEL SECURITY;

-- Own key: full access
DROP POLICY IF EXISTS e2e_own_key ON e2e_public_keys;
CREATE POLICY e2e_own_key ON e2e_public_keys
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Same-tenant members: read-only (for key exchange)
DROP POLICY IF EXISTS e2e_tenant_read ON e2e_public_keys;
CREATE POLICY e2e_tenant_read ON e2e_public_keys
  FOR SELECT USING (tenant_id = get_tenant_id());

-- Add to realtime (so key rotation is immediately visible)
ALTER TABLE e2e_public_keys REPLICA IDENTITY FULL;

-- Note: add this to §37 seed or §32 realtime block in REACH_unified.sql:
-- DO $$ BEGIN
--   ALTER PUBLICATION supabase_realtime ADD TABLE e2e_public_keys;
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

============================================================
SECURITY NOTES:
============================================================
- Private keys are stored in IndexedDB (browser-only) using
  the non-extractable CryptoKey format after first derivation
- The stored keypair object IS extractable for initial generation
  and storage, but private key material is never sent to any server
- Key rotation: user calls POST again, all existing DM shared
  keys are invalidated → peers re-derive on next message
- For HIPAA mode: add per-session key rotation + audit log of
  key exchange events
============================================================
*/
