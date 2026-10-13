import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { makeFixtures, checked, totp } from "./local-fixtures.mjs";

test("real Supabase authentication, RLS and atomic follow-ups", async (t) => {
  const f = await makeFixtures();
  const { users, admin, makeClient, org, person, colleaguePerson, outsiderPerson } = f;
  const owner = users.owner.client;
  const payload = {
    p_person_id: person,
    p_revision: 1,
    p_request_id: randomUUID(),
    p_outcome: "Callback",
    p_callback_on: "2026-10-20",
    p_note: "Durable integration note",
  };
  await t.test("anonymous requests and public signup cannot access the workspace", async () => {
    const anonymous = makeClient();
    const read = await anonymous.from("shepherd_people").select("*");
    assert.ok(read.error);
    const rpc = await anonymous.rpc("shepherd_record_follow_up", payload);
    assert.ok(rpc.error);
    const signup = await anonymous.auth.signUp({
      email: `blocked-${randomUUID()}@shepherd.test`,
      password: "NotAnActualPassword123!",
    });
    assert.ok(signup.error);
    const unconfirmed = await anonymous.auth.signInWithPassword({
      email: users.unconfirmed.email,
      password: users.unconfirmed.password,
    });
    assert.ok(unconfirmed.error);
  });
  await t.test("volunteers only see their own people, including direct ID requests", async () => {
    assert.deepEqual(
      checked(await owner.from("shepherd_people").select("id")).map((x) => x.id),
      [person],
    );
    assert.deepEqual(
      checked(await owner.from("shepherd_people").select("id").eq("id", colleaguePerson)),
      [],
    );
    assert.deepEqual(
      checked(await owner.from("shepherd_people").select("id").eq("id", outsiderPerson)),
      [],
    );
    assert.equal(
      (await users.colleague.client.rpc("shepherd_record_follow_up", payload)).error?.code,
      "42501",
    );
    assert.equal(
      (await users.outsider.client.rpc("shepherd_record_follow_up", payload)).error?.code,
      "42501",
    );
  });
  await t.test(
    "clients cannot bypass RPC validation, rewrite history or promote themselves",
    async () => {
      assert.ok(
        (await owner.from("shepherd_people").update({ outcome: "Reached" }).eq("id", person)).error,
      );
      assert.ok(
        (
          await owner
            .from("shepherd_memberships")
            .update({ role: "admin" })
            .eq("user_id", users.owner.id)
        ).error,
      );
      assert.ok(
        (await owner.from("shepherd_contact_attempts").insert({ person_id: person })).error,
      );
      assert.ok((await owner.from("shepherd_audit_events").select("*")).error);
    },
  );
  await t.test(
    "validation rejects missing callbacks and oversized notes without partial writes",
    async () => {
      assert.equal(
        (await owner.rpc("shepherd_record_follow_up", { ...payload, p_callback_on: null })).error
          ?.code,
        "22023",
      );
      assert.equal(
        (await owner.rpc("shepherd_record_follow_up", { ...payload, p_note: "x".repeat(4001) }))
          .error?.code,
        "22023",
      );
      assert.equal(
        checked(await owner.from("shepherd_people").select("revision").eq("id", person).single())
          .revision,
        1,
      );
    },
  );
  await t.test(
    "a save survives a fresh login and stores an attributed note and audit record",
    async () => {
      checked(await owner.rpc("shepherd_record_follow_up", payload));
      const fresh = makeClient();
      checked(
        await fresh.auth.signInWithPassword({
          email: users.owner.email,
          password: users.owner.password,
        }),
      );
      const result = checked(
        await fresh.from("shepherd_people").select("*").eq("id", person).single(),
      );
      assert.equal(result.revision, 2);
      assert.equal(result.callback_on, "2026-10-20");
      const notes = checked(
        await fresh.from("shepherd_contact_attempts").select("*").eq("person_id", person),
      );
      assert.equal(notes.length, 1);
      assert.equal(notes[0].actor_id, users.owner.id);
      assert.equal(notes[0].note, payload.p_note);
      assert.equal(
        checked(await admin.from("shepherd_audit_events").select("*").eq("person_id", person))
          .length,
        1,
      );
      assert.deepEqual(
        checked(
          await users.colleague.client
            .from("shepherd_contact_attempts")
            .select("*")
            .eq("person_id", person),
        ),
        [],
      );
      checked(await fresh.auth.signOut({ scope: "local" }));
    },
  );
  await t.test(
    "parallel retries are idempotent and changed retry payloads are rejected",
    async () => {
      const results = await Promise.all([
        owner.rpc("shepherd_record_follow_up", payload),
        owner.rpc("shepherd_record_follow_up", payload),
      ]);
      results.forEach(checked);
      assert.equal(
        checked(await owner.from("shepherd_contact_attempts").select("*").eq("person_id", person))
          .length,
        1,
      );
      assert.equal(
        (await owner.rpc("shepherd_record_follow_up", { ...payload, p_note: "Changed retry" }))
          .error?.code,
        "22023",
      );
    },
  );
  await t.test("concurrent edits allow one writer and reject stale overwrite", async () => {
    const next = { ...payload, p_revision: 2, p_outcome: "Reached", p_callback_on: null };
    const results = await Promise.all([
      owner.rpc("shepherd_record_follow_up", { ...next, p_request_id: randomUUID() }),
      owner.rpc("shepherd_record_follow_up", { ...next, p_request_id: randomUUID() }),
    ]);
    assert.equal(results.filter((r) => !r.error).length, 1);
    assert.equal(results.find((r) => r.error).error.code, "40001");
    const result = checked(
      await owner.from("shepherd_people").select("*").eq("id", person).single(),
    );
    assert.equal(result.revision, 3);
    assert.equal(result.callback_on, null);
  });
  await t.test("revoked membership immediately blocks an existing session", async () => {
    checked(
      await admin
        .from("shepherd_memberships")
        .update({ active: false })
        .eq("organisation_id", org)
        .eq("user_id", users.owner.id),
    );
    try {
      assert.deepEqual(checked(await owner.from("shepherd_people").select("*")), []);
      assert.equal(
        (
          await owner.rpc("shepherd_record_follow_up", {
            ...payload,
            p_revision: 3,
            p_request_id: randomUUID(),
          })
        ).error?.code,
        "42501",
      );
    } finally {
      checked(
        await admin
          .from("shepherd_memberships")
          .update({ active: true })
          .eq("organisation_id", org)
          .eq("user_id", users.owner.id),
      );
    }
  });
  await t.test("administrators need actual MFA before reading or adding people", async () => {
    const a = users.admin.client;
    const create = {
      p_organisation_id: org,
      p_full_name: "Admin Created Contact",
      p_phone_e164: "",
      p_owner_user_id: users.owner.id,
    };
    assert.deepEqual(checked(await a.from("shepherd_people").select("*")), []);
    assert.equal((await a.rpc("shepherd_create_person", create)).error?.code, "42501");
    const enrolled = checked(
      await a.auth.mfa.enroll({ factorType: "totp", friendlyName: "Integration test" }),
    );
    checked(
      await a.auth.mfa.challengeAndVerify({
        factorId: enrolled.id,
        code: totp(enrolled.totp.secret),
      }),
    );
    assert.equal(
      checked(await a.from("shepherd_people").select("*").eq("organisation_id", org)).length,
      2,
    );
    const id = checked(await a.rpc("shepherd_create_person", create));
    assert.ok(id);
    assert.equal(
      (await a.rpc("shepherd_create_person", { ...create, p_owner_user_id: users.outsider.id }))
        .error?.code,
      "22023",
    );
    assert.equal((await owner.rpc("shepherd_create_person", create)).error?.code, "42501");
    assert.ok(
      (await a.rpc("shepherd_create_person", { ...create, p_phone_e164: "invalid" })).error,
    );
    assert.deepEqual(
      checked(await a.from("shepherd_people").select("*").eq("id", outsiderPerson)),
      [],
    );
  });
  await t.test("London dates follow the daylight-saving boundaries on the database", () => {
    const sql =
      "select ('2026-03-29 23:30:00+00'::timestamptz at time zone 'Europe/London')::date, ('2026-10-25 00:30:00+00'::timestamptz at time zone 'Europe/London')::date, ('2026-10-25 23:30:00+00'::timestamptz at time zone 'Europe/London')::date;";
    const result = execFileSync(
      "docker",
      ["exec", "supabase_db_shepherdapp", "psql", "-U", "postgres", "-d", "postgres", "-Atc", sql],
      { encoding: "utf8" },
    ).trim();
    assert.equal(result, "2026-03-30|2026-10-25|2026-10-25");
  });
});
