import { accountHandler } from "./handler.mjs";
import { accountClients } from "./api.mjs";
const clients = accountClients(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
Deno.serve(
  accountHandler({
    ...clients,
    origins: (Deno.env.get("SHEPHERD_APP_ORIGINS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }),
);
