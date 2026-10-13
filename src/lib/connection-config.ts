export function readConnection(env: Record<string, string | undefined>) {
  const mode = env["VITE_APP_MODE"] || "demo";
  if (mode === "demo") return { mode: "demo" as const };
  if (mode !== "connected")
    return { mode: "invalid" as const, error: "VITE_APP_MODE must be demo or connected." };
  const url = env["VITE_SUPABASE_URL"] || "";
  const key = env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "";
  try {
    const parsed = new URL(url);
    const local = ["127.0.0.1", "localhost"].includes(parsed.hostname);
    if (
      !(parsed.protocol === "https:" || (local && parsed.protocol === "http:")) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error();
    let publicKey = key.startsWith("sb_publishable_") && key.length > 20;
    if (!publicKey && key.split(".").length === 3) {
      const payload = JSON.parse(atob(key.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
      publicKey = payload.role === "anon";
    }
    if (!publicKey) throw new Error();
    return { mode: "connected" as const, url: parsed.origin, key };
  } catch {
    return {
      mode: "invalid" as const,
      error:
        "Set a valid Supabase URL and publishable (or legacy anon) key. Never use a service-role or secret key in the app.",
    };
  }
}
