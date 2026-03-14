// ============================================================
// supabase/functions/invite-member/index.ts
// FIXED version — references workspace_settings (not tenant_settings).
// Sends invite email via Resend. Creates invitation row.
// Enforces: domain restrictions, seat cap, role hierarchy,
// and configurable who_can_invite setting.
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

    const authHeader = req.headers.get("Authorization");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "") ?? ""
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, role = "member", projectId } = body as {
      email: string;
      role?: string;
      projectId?: string;
    };

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Validate role value
    if (!["admin", "member", "guest"].includes(role)) {
      return new Response(JSON.stringify({ error: "Role must be admin, member, or guest" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Get inviter profile + workspace settings + tenant in one query
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role, display_name")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const [settingsRes, tenantRes] = await Promise.all([
      supabase
        .from("workspace_settings")
        .select("allowed_email_domains, who_can_invite, plan_seats")
        .eq("tenant_id", profile.tenant_id)
        .single(),
      supabase
        .from("tenants")
        .select("name, slug")
        .eq("id", profile.tenant_id)
        .single(),
    ]);

    const settings = settingsRes.data;
    const tenant   = tenantRes.data;

    // ── Permission check ──────────────────────────────────────
    // who_can_invite: 'members' = anyone can, 'admins' = admin only
    const inviterIsAdmin  = profile.role === "admin";
    const inviterIsMember = profile.role === "member";
    const memberCanInvite = settings?.who_can_invite !== "admins";

    const canInvite = inviterIsAdmin || (inviterIsMember && memberCanInvite);
    if (!canInvite) {
      return new Response(JSON.stringify({ error: "Only admins can invite members in this workspace" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Members cannot invite admins (role hierarchy)
    if (!inviterIsAdmin && role === "admin") {
      return new Response(JSON.stringify({ error: "Members cannot invite admins" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Domain restriction ────────────────────────────────────
    const allowedDomains = settings?.allowed_email_domains ?? [];
    if (allowedDomains.length > 0) {
      const domain = email.split("@")[1];
      if (!allowedDomains.includes(domain)) {
        return new Response(JSON.stringify({
          error: `Only ${allowedDomains.join(", ")} domains allowed`,
        }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    // ── Seat cap ─────────────────────────────────────────────
    const seatLimit = settings?.plan_seats ?? null;
    if (seatLimit) {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id)
        .eq("is_deactivated", false);

      if ((count ?? 0) >= seatLimit) {
        return new Response(JSON.stringify({
          error: `Seat limit (${seatLimit}) reached. Upgrade your plan.`,
        }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }
    }

    // ── Check for existing active invite ─────────────────────
    const { data: existing } = await supabase
      .from("invitations")
      .select("id, expires_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        error: "An active invitation already exists for this email",
      }), { status: 409, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // ── Create invitation ─────────────────────────────────────
    const { data: invite, error: inviteErr } = await supabase
      .from("invitations")
      .insert({
        tenant_id:  profile.tenant_id,
        email,
        role,
        invited_by: user.id,
        project_id: projectId ?? null,
      })
      .select()
      .single();

    if (inviteErr) throw inviteErr;

    // ── Send email via Resend ─────────────────────────────────
    const appUrl    = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://reach.app";
    const inviteUrl = `${appUrl}/invite/accept?token=${invite.token}`;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@reach.app",
          to:      email,
          subject: `${profile.display_name ?? "Someone"} invited you to ${tenant?.name} on REACH`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
              <div style="margin-bottom:24px;">
                <span style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">REACH</span>
              </div>
              <h2 style="font-size:22px;font-weight:600;margin-bottom:8px;">
                You're invited to ${tenant?.name}
              </h2>
              <p style="color:#555;line-height:1.6;">
                ${profile.display_name ?? "A teammate"} invited you to join
                <strong>${tenant?.name}</strong> as a <strong>${role}</strong>.
              </p>
              <a href="${inviteUrl}"
                 style="display:inline-block;margin-top:24px;background:#3ECFCF;color:#080809;
                        padding:12px 28px;border-radius:8px;text-decoration:none;
                        font-weight:600;font-size:14px;">
                Accept Invitation →
              </a>
              <p style="margin-top:32px;color:#999;font-size:12px;line-height:1.5;">
                This invitation expires in 7 days.<br>
                If you didn't expect this, you can safely ignore it.
              </p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        // Log but don't fail — invitation row is created, link works
        console.error("Resend email failed:", await emailRes.text());
      }
    }

    // ── Audit log ─────────────────────────────────────────────
    await supabase.rpc("write_audit_log", {
      p_action:      "member.invited",
      p_target_type: "invitations",
      p_target_id:   invite.id,
      p_old_value:   null,
      p_new_value:   { email, role, project_id: projectId },
    });

    return new Response(JSON.stringify({
      success:   true,
      invite_id: invite.id,
      token:     invite.token, // return token for testing without email
      invite_url: inviteUrl,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
