// Privileged auth operations stay on the server. The caller JWT also enforces
// current membership and actual MFA in Postgres; browser role claims are ignored.
export function accountHandler({ clientForToken, admin, origins }) {
  return async (request) => {
    const origin = request.headers.get("Origin");
    const allowed = origin && origins.includes(origin);
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (allowed)
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      });
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (!allowed) return reply(403, { error: "This app address is not allowed." });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    try {
      const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return reply(401, { error: "Sign in again." });
      const client = clientForToken(token);
      const identity = await client.auth.getUser(token);
      if (identity.error || !identity.data.user) return reply(401, { error: "Sign in again." });
      const raw = await request.text();
      if (raw.length > 4096) return reply(413, { error: "Request too large." });
      const body = JSON.parse(raw);
      const { organisation_id, email, name, role, action } = body;
      if (!/^[0-9a-f-]{36}$/i.test(organisation_id ?? "") || !["invite", "reset"].includes(action))
        return reply(400, { error: "Invalid request." });
      const permission = await client.rpc("shepherd_is_admin", {
        p_organisation_id: organisation_id,
      });
      if (permission.error || permission.data !== true)
        return reply(403, { error: "An active administrator account with MFA is required." });
      const members = await client.rpc("shepherd_members", { p_organisation_id: organisation_id });
      if (members.error) return reply(403, { error: "Could not verify workspace access." });
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      )
        return reply(400, { error: "Enter a valid email address." });
      const normalized = email.trim().toLowerCase();
      const existing = members.data.find((m) => m.email?.toLowerCase() === normalized);
      if (action === "reset") {
        if (!existing?.active || !existing.confirmed)
          return reply(400, { error: "Choose an active, confirmed member." });
        const reset = await client.auth.resetPasswordForEmail(normalized, {
          redirectTo: `${origin}/`,
        });
        if (reset.error)
          return reply(502, {
            error: "Email could not be sent. Check mail settings or try again later.",
          });
        return reply(200, { message: "Password-reset email requested." });
      }
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 140 ||
        !["volunteer", "admin"].includes(role)
      )
        return reply(400, { error: "Enter a name and valid role." });
      if (existing && (!existing.active || existing.confirmed))
        return reply(409, {
          error: "This member already exists. Manage their access or send a password reset.",
        });
      const invited = await admin.auth.admin.inviteUserByEmail(normalized, {
        redirectTo: `${origin}/`,
      });
      if (invited.error || !invited.data.user)
        return reply(502, {
          error:
            "Invitation could not be sent. Check email delivery settings and whether the address already has an account.",
        });
      const granted = await client.rpc("shepherd_grant_member", {
        p_organisation_id: organisation_id,
        p_user_id: invited.data.user.id,
        p_email: normalized,
        p_name: name.trim(),
        p_role: role,
      });
      if (granted.error)
        return reply(409, {
          error:
            "The invitation was sent, but membership could not be saved. Check Users before retrying; the recipient has no new workspace access yet.",
        });
      return reply(200, {
        message: "Invitation sent. The recipient will verify their email and choose a password.",
      });
    } catch {
      return reply(400, {
        error: "Could not complete this request. Check the connection and try again.",
      });
    }
  };
}
