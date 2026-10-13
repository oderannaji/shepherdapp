import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

// Deliberately reads local CLI status, never a supplied hosted URL or service key.
export function localBackend() {
  const cli =
    process.platform === "win32" ? "node_modules/.bin/supabase.cmd" : "node_modules/.bin/supabase";
  const raw = execFileSync(cli, ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const status = JSON.parse(raw);
  const url = new URL(status.API_URL);
  if (url.hostname !== "127.0.0.1" || url.port !== "54321")
    throw new Error("Fixtures require the local Shepherd database on port 54321.");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  return {
    status,
    admin: createClient(status.API_URL, status.SERVICE_ROLE_KEY, options),
    makeClient: () => createClient(status.API_URL, status.ANON_KEY, options),
  };
}
export function checked(result) {
  if (result.error) throw new Error(`${result.error.code ?? "api"}: ${result.error.message}`);
  return result.data;
}
export function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
export async function makeFixtures() {
  const backend = localBackend();
  const { admin, makeClient, status } = backend;
  const org = randomUUID();
  const otherOrg = randomUUID();
  const suffix = randomBytes(6).toString("hex");
  checked(
    await admin.from("shepherd_organisations").insert([
      { id: org, name: "Local test church" },
      { id: otherOrg, name: "Other test church" },
    ]),
  );
  const users = {};
  for (const [name, role, organisation, confirmed] of [
    ["owner", "volunteer", org, true],
    ["colleague", "volunteer", org, true],
    ["outsider", "volunteer", otherOrg, true],
    ["admin", "admin", org, true],
    ["unconfirmed", "volunteer", org, false],
  ]) {
    const email = `${name}-${suffix}@shepherd.test`;
    const password = randomBytes(24).toString("base64url");
    const created = checked(
      await admin.auth.admin.createUser({ email, password, email_confirm: confirmed }),
    );
    checked(
      await admin.from("shepherd_memberships").insert({
        organisation_id: organisation,
        user_id: created.user.id,
        display_name: `Test ${name}`,
        role,
        active: true,
      }),
    );
    const client = makeClient();
    if (confirmed) checked(await client.auth.signInWithPassword({ email, password }));
    users[name] = { id: created.user.id, email, password, client };
  }
  const person = randomUUID();
  const colleaguePerson = randomUUID();
  const outsiderPerson = randomUUID();
  checked(
    await admin.from("shepherd_people").insert([
      {
        id: person,
        organisation_id: org,
        full_name: "Local Test Contact",
        phone_e164: "+447700900123",
        owner_user_id: users.owner.id,
      },
      {
        id: colleaguePerson,
        organisation_id: org,
        full_name: "Colleague Only Contact",
        owner_user_id: users.colleague.id,
      },
      {
        id: outsiderPerson,
        organisation_id: otherOrg,
        full_name: "Other Church Contact",
        owner_user_id: users.outsider.id,
      },
    ]),
  );
  await mkdir(".local", { recursive: true });
  const accounts = Object.fromEntries(
    Object.entries(users).map(([name, { id, email, password }]) => [name, { id, email, password }]),
  );
  await writeFile(
    ".local/test-accounts.json",
    JSON.stringify({ org, otherOrg, person, colleaguePerson, outsiderPerson, users: accounts }),
    { mode: 0o600 },
  );
  await writeFile(
    ".env.connected.local",
    `VITE_APP_MODE=connected\nVITE_SUPABASE_URL=${status.API_URL}\nVITE_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\n`,
    { mode: 0o600 },
  );
  return { ...backend, org, otherOrg, person, colleaguePerson, outsiderPerson, users };
}
if (process.argv[1]?.endsWith("/local-fixtures.mjs")) {
  await makeFixtures();
  console.log(
    "Created synthetic local accounts in ignored .local/test-accounts.json and .env.connected.local. No hosted data changed.",
  );
}
