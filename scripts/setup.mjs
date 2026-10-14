import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { access, writeFile } from "node:fs/promises";
import { readConnection } from "../src/lib/connection-config.ts";
try {
  await access(".env.local");
  console.log(
    ".env.local already exists. It has been preserved. Set VITE_APP_MODE=connected there to use real accounts.",
  );
} catch {
  const input = createInterface({ input: stdin, output: stdout });
  try {
    console.log("Connect this Mac to Shepherd. Only the public browser key is needed.");
    const url =
      (await input.question("Supabase URL [https://qcejhbyrqvzqxhufexnn.supabase.co]: ")).trim() ||
      "https://qcejhbyrqvzqxhufexnn.supabase.co";
    const key = (
      await input.question("Supabase publishable key (never a secret or service-role key): ")
    ).trim();
    const result = readConnection({
      VITE_APP_MODE: "connected",
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: key,
    });
    if (result.mode !== "connected" || /[\r\n]/.test(key))
      throw new Error("The URL or public key is invalid. No configuration was written.");
    await writeFile(
      ".env.local",
      `VITE_APP_MODE=connected\nVITE_SUPABASE_URL=${result.url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${result.key}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log("Connection saved locally. Run bun run dev, then open the address shown.");
  } finally {
    input.close();
  }
}
