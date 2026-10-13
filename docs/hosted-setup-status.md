# Hosted setup — 13 October 2026

Project: `qcejhbyrqvzqxhufexnn`.

The user authorised connecting the existing project and designated its first administrator. A read-only preflight found no public application tables or authentication users before setup.

Applied and recorded in `supabase_migrations.schema_migrations`:

- `20261013000100`: Shepherd organisations, memberships, people, attributed follow-up history, audit events and transactional functions.
- `20261013000200`: Explicitly remove anonymous function grants. The hosted project's default privileges granted EXECUTE directly to `anon`, in addition to PUBLIC; the second migration handles both. Access checks inside the functions already rejected unauthorised writes, but the anonymous entry points are now denied as well.

Configured email/password login with public registration disabled, email confirmation required, authenticator MFA enabled and a minimum password length of 12. Preserved existing redirect settings and added the two documented port-3000 Mac development addresses.

Prepared one organisation and one active administrator membership. The account was created without a password and remains unconfirmed. No real email has been sent. The user must verify their address and choose their own password; account creation is not evidence of a successful user login. Do not bypass verification or set a password on their behalf.

Verification:

- All five hosted application tables have row-level security enabled.
- Anonymous clients cannot select people or execute the four Shepherd helper/RPC functions. Authenticated execution remains available; internal identity, membership, ownership and MFA checks still apply.
- Direct authenticated updates to the people table are denied, so writes must use the validated transactional function.
- Actual anonymous HTTP requests to the people endpoint and follow-up/date functions returned 401 / permission denied.
- The local integration suite reproduced direct anonymous function grants before applying the second migration, then checked that they were removed. Local tests also verify that a prepared, unconfirmed account can accept an invitation, confirm its email, choose a password and sign in with it.

No contact data or test fixtures were seeded into the hosted project. User sign-in with the real administrator account is still unverified. GitHub write access still returns 403, so the updated code has not been delivered to the Mac. Complete code delivery before sending an expiring setup email that redirects to the local app. Sending that email needs the user's explicit instruction.

Run `bun run check:hosted -- your-admin-email@example.com` for a read-only recheck. Tokens stay in secure environment settings. This command uses the environment's supported proxy route; never disable TLS verification.
