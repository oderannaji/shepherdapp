// Read-only hosted setup check. Never logs tokens, API keys, SMTP secrets or user records.
import { pathToFileURL } from "node:url";
const expectedProject = "qcejhbyrqvzqxhufexnn";
const requiredAuth = {
  external_email_enabled: true,
  disable_signup: true,
  mailer_autoconfirm: false,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
};
export async function managementRequest(path, body) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token)
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is missing. Add it in secure environment settings, then save/publish.",
    );
  let response;
  try {
    response = await fetch(`https://api.supabase.com/v1/projects/${expectedProject}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      "Could not reach Supabase management API. Run with node --use-env-proxy in this cloud environment and check applied network/access settings.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Supabase management API returned HTTP ${response.status}. No credential values have been logged.`,
    );
  return response.json();
}
export async function preflight(adminEmail) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail ?? ""))
    throw new Error(
      "Provide the first administrator email as the command argument. Do not provide a password.",
    );
  const [auth, result] = await Promise.all([
    managementRequest("/config/auth"),
    managementRequest("/database/query/read-only", {
      query: `select
      to_regnamespace('shepherd_private') is not null as shepherd_private_exists,
      to_regclass('public.shepherd_organisations') is not null as organisations_exist,
      to_regclass('public.shepherd_memberships') is not null as memberships_exist,
      to_regclass('public.shepherd_people') is not null as people_exist,
      to_regclass('public.shepherd_contact_attempts') is not null as attempts_exist,
      to_regclass('public.shepherd_audit_events') is not null as audit_exists,
      (select count(*) from pg_tables where schemaname='public' and tablename not like 'shepherd\\_%')::integer as other_public_table_count,
      (select count(*) from auth.users)::integer as auth_user_count,
      exists(select 1 from auth.users where lower(email)=lower($1)) as administrator_exists,
      exists(select 1 from auth.users where lower(email)=lower($1) and email_confirmed_at is not null) as administrator_confirmed;`,
      parameters: [adminEmail],
    }),
  ]);
  const database = result?.[0];
  if (!database || typeof database.people_exist !== "boolean")
    throw new Error(
      "Unexpected metadata response; stop and inspect the API contract before any write.",
    );
  return {
    project: expectedProject,
    readOnly: true,
    database,
    authSettingsToChange: Object.keys(requiredAuth).filter(
      (key) => auth[key] !== requiredAuth[key],
    ),
    passwordMinimumNeedsUpdate: !(auth.password_min_length >= 12),
    localRedirectsMissing: ["http://127.0.0.1:3000/", "http://localhost:3000/"].filter(
      (url) => !(auth.uri_allow_list ?? "").split(",").includes(url),
    ),
    sharedProjectReviewRequired: database.other_public_table_count > 0,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await preflight(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
