// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

import { readConnection } from "./src/lib/connection-config";

export default defineConfig({
  vite: {
    plugins: [
      {
        name: "shepherd-connection-check",
        configResolved(config) {
          const result = readConnection(config.env);
          const key = config.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
          const keyCheck = key
            ? readConnection({
                VITE_APP_MODE: "connected",
                VITE_SUPABASE_URL: "https://validation.supabase.co",
                VITE_SUPABASE_PUBLISHABLE_KEY: key,
              })
            : null;
          if (result.mode === "invalid" || keyCheck?.mode === "invalid")
            throw new Error(
              "Shepherd connection configuration is invalid. Use .env.example and only a public Supabase key.",
            );
        },
      },
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
