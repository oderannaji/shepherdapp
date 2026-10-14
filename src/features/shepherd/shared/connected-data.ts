import type { SupabaseClient } from "@supabase/supabase-js";
export type Service = { id: string; service_date: string; title: string };
export type Contact = {
  id: string;
  full_name: string;
  phone_e164: string | null;
  owner_user_id: string;
  revision: number;
  outcome: string;
};
export type WorkspaceMember = {
  revision: number;
  user_id: string;
  display_name: string;
  role: "admin" | "volunteer";
  active: boolean;
  email: string;
  confirmed: boolean;
};
export type AttendanceRow = {
  version: string;
  person_id: string;
  full_name: string;
  status: "unknown" | "came" | "absent";
  conflict: boolean;
  observations: { source: string; status: string; actor_id: string }[];
};
export type ExpectedEntry = {
  person_id: string;
  attendance: "unknown" | "came" | "absent";
  late: boolean;
};
export type ExpectedList = {
  id: string;
  author_id: string;
  note: string;
  state: "published" | "results";
  revision: number;
  shepherd_expected_entries: ExpectedEntry[];
};
export async function readRows<T>(
  client: SupabaseClient,
  table: string,
  org: string,
  select = "*",
): Promise<T[]> {
  const rows: T[] = [];
  // Paginate instead of silently truncating at Supabase's default 1,000-row limit.
  for (let from = 0; ; from += 500) {
    const r = await client
      .from(table)
      .select(select)
      .eq("organisation_id", org)
      .order(table === "shepherd_memberships" ? "user_id" : "id")
      .range(from, from + 499);
    if (r.error) throw r.error;
    rows.push(...(r.data as T[]));
    if (r.data.length < 500) return rows;
  }
}
export async function readServices(client: SupabaseClient, org: string) {
  return (await readRows<Service>(client, "shepherd_services", org)).sort((a, b) =>
    b.service_date.localeCompare(a.service_date),
  );
}
export async function readPeople(client: SupabaseClient, org: string) {
  return (await readRows<Contact>(client, "shepherd_people", org)).sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
}
export function consecutiveAbsences(statuses: ("unknown" | "came" | "absent")[]) {
  let n = 0;
  for (const status of statuses) {
    if (status !== "absent") break;
    n++;
  }
  return n;
}
