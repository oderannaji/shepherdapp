import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { makeFixtures, checked, totp } from "./local-fixtures.mjs";
const f = await makeFixtures();
const redirectTo = "http://127.0.0.1:3001/";
const inviteEmail = `invited-${randomUUID()}@shepherd.test`;
const invite = checked(
  await f.admin.auth.admin.generateLink({
    type: "invite",
    email: inviteEmail,
    options: { redirectTo },
  }),
);
checked(
  await f.admin.from("shepherd_memberships").insert({
    organisation_id: f.org,
    user_id: invite.user.id,
    display_name: "Invited volunteer",
    role: "volunteer",
    active: true,
  }),
);
const recovery = checked(
  await f.admin.auth.admin.generateLink({
    type: "recovery",
    email: f.users.owner.email,
    options: { redirectTo },
  }),
);
const factor = checked(
  await f.users.admin.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Password recovery test",
  }),
);
checked(
  await f.users.admin.client.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp(factor.totp.secret),
  }),
);
const adminRecovery = checked(
  await f.admin.auth.admin.generateLink({
    type: "recovery",
    email: f.users.admin.email,
    options: { redirectTo },
  }),
);
await writeFile(
  ".local/password-links.json",
  JSON.stringify({
    invite: { url: invite.properties.action_link, email: inviteEmail },
    recovery: { url: recovery.properties.action_link, email: f.users.owner.email },
    adminRecovery: {
      url: adminRecovery.properties.action_link,
      email: f.users.admin.email,
      secret: factor.totp.secret,
    },
    newPassword: randomBytes(24).toString("base64url"),
  }),
  { mode: 0o600 },
);
console.log(
  "Prepared local invitation and recovery links in ignored .local/password-links.json. No email was sent.",
);
