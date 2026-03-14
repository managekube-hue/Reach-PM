// ============================================================
// supabase/functions/crdt-sync/index.ts
// Server-side drain of sync_queue on reconnect.
// Called by browser on window 'online' event.
// Also works as a scheduled endpoint (can be called from pg_cron
// via http extension if you want pure server-side drain).
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Pull all unsynced operations for this user
    const { data: queued, error: qErr } = await supabase
      .from("sync_queue")
      .select("*")
      .eq("user_id", user.id)
      .is("synced_at", null)
      .order("created_at", { ascending: true })
      .limit(500); // cap per drain to avoid timeout

    if (qErr) throw qErr;

    if (!queued?.length) {
      return new Response(JSON.stringify({ synced: 0, pending: 0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Collapse: group by table + record, last-write-wins per field ──
    const byRecord = new Map<string, {
      table:     string;
      recordId:  string;
      updates:   Record<string, unknown>;
      queueIds:  string[];
    }>();

    for (const op of queued) {
      const key = `${op.table_name}:${op.record_id}`;
      const existing = byRecord.get(key) ?? {
        table:    op.table_name,
        recordId: op.record_id,
        updates:  {},
        queueIds: [],
      };

      const payload = op.payload as Record<string, unknown>;

      // Support both {field, value} and flat {field1: v1, field2: v2} payloads
      if ("field" in payload && "value" in payload) {
        existing.updates[payload.field as string] = payload.value;
      } else {
        Object.assign(existing.updates, payload);
      }

      existing.queueIds.push(op.id as string);
      byRecord.set(key, existing);
    }

    // ── Apply each collapsed update ────────────────────────
    let synced = 0;
    const errors: string[] = [];
    const syncedQueueIds: string[] = [];

    for (const { table, recordId, updates, queueIds } of byRecord.values()) {
      // Security: verify record belongs to this tenant
      const { data: record } = await supabase
        .from(table)
        .select("tenant_id")
        .eq("id", recordId)
        .single();

      if (!record || record.tenant_id !== profile.tenant_id) {
        errors.push(`Skipped: ${table}:${recordId} (tenant mismatch)`);
        continue;
      }

      const { error: updateErr } = await supabase
        .from(table)
        .update(updates)
        .eq("id", recordId)
        .eq("tenant_id", profile.tenant_id);

      if (updateErr) {
        errors.push(`Failed: ${table}:${recordId} — ${updateErr.message}`);
        continue;
      }

      synced++;
      syncedQueueIds.push(...queueIds);
    }

    // ── Mark synced rows ───────────────────────────────────
    if (syncedQueueIds.length) {
      await supabase
        .from("sync_queue")
        .update({ synced_at: new Date().toISOString() })
        .in("id", syncedQueueIds);
    }

    // ── Check remaining ────────────────────────────────────
    const { count: remaining } = await supabase
      .from("sync_queue")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("synced_at", null);

    return new Response(JSON.stringify({
      synced,
      remaining: remaining ?? 0,
      errors,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
