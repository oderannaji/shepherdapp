import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { accountClients } from "../supabase/functions/account-admin/api.mjs";
import { makeFixtures, checked, totp } from "./local-fixtures.mjs";
import { accountHandler } from "../supabase/functions/account-admin/handler.mjs";

test("connected workspace permissions and durable workflows", async (t) => {
  const f = await makeFixtures();
  const { admin, org, users, person, colleaguePerson, outsiderPerson, status } = f;
  const owner = users.owner.client;
  const a = users.admin.client;
  const call = (client, action, payload, id = randomUUID()) =>
    client.rpc("shepherd_admin_action", {
      p_organisation_id: org,
      p_action: action,
      p_payload: payload,
      p_request_id: id,
    });
  const today = checked(await owner.rpc("shepherd_today"));
  const past = new Date(`${today}T12:00:00Z`);
  past.setUTCDate(past.getUTCDate() - 1);
  const servicePayload = { date: past.toISOString().slice(0, 10), title: "Integration Sunday" };
  await t.test(
    "volunteers and administrators without MFA cannot perform administrative actions",
    async () => {
      for (const client of [owner, a, users.outsider.client]) {
        assert.equal((await call(client, "create_service", servicePayload)).error?.code, "42501");
        assert.equal(
          (await client.rpc("shepherd_members", { p_organisation_id: org })).error?.code,
          "42501",
        );
      }
      const factor = checked(
        await a.auth.mfa.enroll({ factorType: "totp", friendlyName: "Workspace integration" }),
      );
      checked(
        await a.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: totp(factor.totp.secret),
        }),
      );
    },
  );
  await t.test("person creation retries do not create duplicate profiles", async () => {
    const payload = {
      p_organisation_id: org,
      p_full_name: "Retry safe person",
      p_phone_e164: "",
      p_owner_user_id: users.colleague.id,
      p_request_id: randomUUID(),
    };
    const id = checked(await a.rpc("shepherd_create_person_once", payload));
    assert.equal(checked(await a.rpc("shepherd_create_person_once", payload)), id);
    assert.equal(
      (await a.rpc("shepherd_create_person_once", { ...payload, p_full_name: "Changed request" }))
        .error?.code,
      "22023",
    );
    assert.equal(
      (await owner.rpc("shepherd_create_person_once", { ...payload, p_request_id: randomUUID() }))
        .error?.code,
      "42501",
    );
  });
  const service = checked(await call(a, "create_service", servicePayload)).id;
  const future = checked(
    await call(a, "create_service", { date: "2099-01-04", title: "Future test" }),
  ).id;
  const adminPeople = () => a.from("shepherd_people").select("*").eq("organisation_id", org);
  const attendance = async () =>
    checked(await a.rpc("shepherd_attendance", { p_organisation_id: org, p_service_id: service }));
  const mark = async (person_id, status, action = "record_attendance", version) =>
    call(a, action, {
      service_id: service,
      reason: "Verified integration register",
      rows: [
        {
          person_id,
          status,
          version: version ?? (await attendance()).find((p) => p.person_id === person_id)?.version,
        },
      ],
    });
  const listId = randomUUID();
  let listRevision = 0;
  const save = (client, entries, extra = {}) =>
    client.rpc("shepherd_save_expected", {
      p_organisation_id: org,
      p_service_id: service,
      p_list_id: listId,
      p_revision: listRevision,
      p_request_id: randomUUID(),
      p_note: "My invitations",
      p_entries: entries,
      p_results: false,
      p_reason: "",
      ...extra,
    });
  const entry = { person_id: person, attendance: "unknown", late: false };
  await t.test(
    "Expected rejects another owner’s person, cross-organisation IDs and future results",
    async () => {
      for (const id of [colleaguePerson, outsiderPerson])
        assert.equal((await save(owner, [{ ...entry, person_id: id }])).error?.code, "42501");
      assert.equal(
        (await save(owner, [{ ...entry, attendance: "came" }], { p_service_id: future })).error
          ?.code,
        "22023",
      );
      assert.deepEqual(checked(await owner.from("shepherd_expected_lists").select("*")), []);
    },
  );
  await t.test(
    "Expected saves persist, retries are idempotent and stale edits are rejected",
    async () => {
      const request = randomUUID();
      checked(await save(owner, [entry], { p_request_id: request }));
      checked(await save(owner, [entry], { p_request_id: request }));
      assert.equal(
        (await save(owner, [entry], { p_request_id: request, p_note: "Changed" })).error?.code,
        "22023",
      );
      assert.equal((await save(owner, [entry])).error?.code, "40001");
      listRevision = 1;
      const fresh = f.makeClient();
      checked(
        await fresh.auth.signInWithPassword({
          email: users.owner.email,
          password: users.owner.password,
        }),
      );
      assert.equal(
        checked(await fresh.from("shepherd_expected_lists").select("*").eq("id", listId).single())
          .note,
        "My invitations",
      );
      assert.deepEqual(
        checked(
          await users.colleague.client
            .from("shepherd_expected_entries")
            .select("*")
            .eq("list_id", listId),
        ),
        [],
      );
    },
  );
  let guest;
  await t.test(
    "guest creation is scoped and retry-safe; late additions cannot inflate original totals",
    async () => {
      const id = randomUUID();
      const p = { p_organisation_id: org, p_full_name: "New guest", p_request_id: id };
      guest = checked(await owner.rpc("shepherd_add_guest", p));
      assert.equal(checked(await owner.rpc("shepherd_add_guest", p)), guest);
      assert.equal(
        (await save(owner, [entry, { ...entry, person_id: guest, late: false }])).error?.code,
        "22023",
      );
      checked(await save(owner, [entry, { ...entry, person_id: guest, late: true }]));
      listRevision = 2;
      assert.equal(
        (await save(owner, [entry, { ...entry, person_id: guest, late: false }])).error?.code,
        "22023",
      );
      assert.equal(
        (await save(owner, [{ ...entry, person_id: guest, late: true }])).error?.code,
        "22023",
      );
      const totals = checked(
        await owner.rpc("shepherd_team_totals", { p_organisation_id: org, p_service_id: service }),
      );
      assert.equal(totals.expected, 1);
      assert.ok(!JSON.stringify(totals).includes(users.colleague.email));
    },
  );
  await t.test(
    "posted results lock volunteer edits and require admin correction reasons",
    async () => {
      checked(
        await save(
          owner,
          [
            { ...entry, attendance: "came" },
            { ...entry, person_id: guest, late: true },
          ],
          { p_results: true },
        ),
      );
      listRevision = 3;
      assert.equal((await save(owner, [entry])).error?.code, "42501");
      assert.equal((await save(a, [entry])).error?.code, "42501");
      checked(
        await save(
          a,
          [
            { ...entry, attendance: "came" },
            { ...entry, person_id: guest, late: true },
          ],
          { p_results: true, p_reason: "Reviewed with volunteer" },
        ),
      );
      listRevision = 4;
    },
  );
  await t.test(
    "attendance preserves conflicts and unknowns, with explicit reconciliation and stale-write protection",
    async () => {
      checked(await mark(person, "absent"));
      let row = (await attendance()).find((p) => p.person_id === person);
      assert.equal(row.conflict, true);
      assert.equal(row.status, "unknown");
      const before = row.version;
      checked(await mark(person, "came", "resolve_attendance"));
      row = (await attendance()).find((p) => p.person_id === person);
      assert.equal(row.conflict, false);
      assert.equal(row.status, "came");
      assert.equal(
        (await mark(person, "absent", "record_attendance", before)).error?.code,
        "40001",
      );
      checked(await mark(person, "absent"));
      row = (await attendance()).find((p) => p.person_id === person);
      assert.equal(row.conflict, true);
      assert.equal(
        (await attendance()).find((p) => p.person_id === colleaguePerson).status,
        "unknown",
      );
      const own = checked(
        await owner.rpc("shepherd_attendance", { p_organisation_id: org, p_service_id: service }),
      );
      assert.ok(!own.some((p) => p.person_id === colleaguePerson));
      assert.deepEqual(own[0].observations, []);
    },
  );
  await t.test("imports are atomic and repeat requests never create duplicate people", async () => {
    const before = checked(await adminPeople()).length;
    const rows = [
      { full_name: "Imported One", phone_e164: "+447700900321", owner_id: users.owner.id },
    ];
    assert.ok(
      (
        await call(a, "import_people", {
          rows: [...rows, { full_name: "Bad", phone_e164: "123", owner_id: users.owner.id }],
        })
      ).error,
    );
    assert.equal(checked(await adminPeople()).length, before);
    const request = randomUUID();
    checked(await call(a, "import_people", { rows }, request));
    checked(await call(a, "import_people", { rows }, request));
    assert.equal(checked(await adminPeople()).length, before + 1);
    assert.equal((await call(a, "import_people", { rows })).error?.code, "22023");
  });
  await t.test(
    "weekly callers gain only their assigned person; permanent reassignment revokes old access",
    async () => {
      let p = checked(
        await a.from("shepherd_people").select("*").eq("id", colleaguePerson).single(),
      );
      checked(
        await call(a, "set_recovery_caller", {
          person_id: p.id,
          revision: p.revision,
          service_id: service,
          caller_id: users.owner.id,
          reason: "Weekly cover",
        }),
      );
      assert.equal(
        checked(await owner.from("shepherd_people").select("*").eq("id", p.id)).length,
        1,
      );
      checked(
        await owner.rpc("shepherd_record_follow_up", {
          p_person_id: p.id,
          p_revision: p.revision + 1,
          p_request_id: randomUUID(),
          p_outcome: "Reached",
          p_callback_on: null,
          p_note: "Weekly caller note",
        }),
      );
      p = checked(await a.from("shepherd_people").select("*").eq("id", person).single());
      checked(
        await call(a, "assign_person", {
          person_id: p.id,
          revision: p.revision,
          owner_id: users.colleague.id,
          reason: "New permanent owner",
        }),
      );
      assert.equal(
        checked(await owner.from("shepherd_people").select("*").eq("id", person)).length,
        0,
      );
      assert.equal(
        checked(await users.colleague.client.from("shepherd_people").select("*").eq("id", person))
          .length,
        1,
      );
    },
  );
  await t.test(
    "duplicate merges retain notes, preferences and contradictory attendance",
    async () => {
      const duplicate = checked(
        await a.rpc("shepherd_create_person", {
          p_organisation_id: org,
          p_full_name: "Duplicate",
          p_phone_e164: "",
          p_owner_user_id: users.owner.id,
        }),
      );
      checked(
        await owner.rpc("shepherd_record_follow_up", {
          p_person_id: duplicate,
          p_revision: 1,
          p_request_id: randomUUID(),
          p_outcome: "Do not contact",
          p_callback_on: null,
          p_note: "Retain this note",
        }),
      );
      checked(await mark(duplicate, "came"));
      const p = checked(await a.from("shepherd_people").select("*").eq("id", person).single());
      checked(
        await call(a, "merge_people", {
          person_id: person,
          revision: p.revision,
          duplicate_id: duplicate,
          duplicate_revision: 2,
          reason: "Confirmed same person",
        }),
      );
      assert.equal(
        checked(await a.from("shepherd_people").select("*").eq("id", duplicate)).length,
        0,
      );
      assert.equal(
        checked(await a.from("shepherd_people").select("*").eq("id", person).single()).outcome,
        "Do not contact",
      );
      assert.ok(
        checked(await a.from("shepherd_contact_attempts").select("*").eq("person_id", person)).some(
          (n) => n.note === "Retain this note",
        ),
      );
      assert.equal((await attendance()).find((r) => r.person_id === person).conflict, true);
    },
  );
  await t.test(
    "member access changes take effect immediately and cannot disable the acting administrator",
    async () => {
      assert.equal(
        (
          await call(a, "set_member", {
            user_id: users.admin.id,
            role: "volunteer",
            active: false,
            reason: "Self removal",
          })
        ).error?.code,
        "22023",
      );
      checked(
        await call(a, "set_member", {
          user_id: users.owner.id,
          role: "volunteer",
          active: false,
          reason: "Access ended",
          revision: 1,
        }),
      );
      assert.deepEqual(checked(await owner.from("shepherd_people").select("*")), []);
      assert.equal(
        (
          await call(a, "set_member", {
            user_id: users.owner.id,
            role: "admin",
            active: true,
            reason: "Old administrator screen",
            revision: 1,
          })
        ).error?.code,
        "40001",
      );
      assert.equal(
        (
          await owner.rpc("shepherd_add_guest", {
            p_organisation_id: org,
            p_full_name: "Blocked",
            p_request_id: randomUUID(),
          })
        ).error?.code,
        "42501",
      );
      checked(
        await call(a, "set_member", {
          user_id: users.owner.id,
          role: "volunteer",
          active: true,
          reason: "Restore fixture",
          revision: 2,
        }),
      );
      assert.equal((await owner.from("shepherd_audit_events").select("*")).data.length, 0);
      assert.ok(
        checked(await a.from("shepherd_audit_events").select("*").eq("organisation_id", org))
          .length > 10,
      );
    },
  );
  await t.test(
    "account endpoint rejects untrusted origins, volunteers, and revoked administrators",
    async () => {
      const handler = accountHandler({
        origins: ["http://127.0.0.1:3001"],
        ...accountClients(status.API_URL, status.ANON_KEY, status.SERVICE_ROLE_KEY),
      });
      const token = checked(await owner.auth.getSession()).session.access_token;
      const body = {
        organisation_id: org,
        action: "invite",
        email: `invited-${randomUUID()}@shepherd.test`,
        name: "Invited Volunteer",
        role: "volunteer",
      };
      const request = (jwt, origin = "http://127.0.0.1:3001") =>
        new Request("http://localhost/account-admin", {
          method: "POST",
          headers: {
            Origin: origin,
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      assert.equal((await handler(request(token, "https://untrusted.example"))).status, 403);
      assert.equal((await handler(request(token))).status, 403);
      const atoken = checked(await a.auth.getSession()).session.access_token;
      const response = await handler(request(atoken));
      assert.equal(response.status, 200, await response.text());
      const members = checked(await a.rpc("shepherd_members", { p_organisation_id: org }));
      const invited = members.find((m) => m.email === body.email);
      assert.equal(invited.role, "volunteer");
      assert.equal(invited.confirmed, false);
      checked(
        await admin
          .from("shepherd_memberships")
          .update({ active: false })
          .eq("organisation_id", org)
          .eq("user_id", users.admin.id),
      );
      assert.equal((await handler(request(atoken))).status, 403);
    },
  );
});
