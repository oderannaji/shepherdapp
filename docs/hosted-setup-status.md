# Hosted setup — updated 14 October 2026

Project: `qcejhbyrqvzqxhufexnn`.

The user authorised connecting the existing project and designated its first administrator. A read-only preflight found no public application tables or authentication users before setup.

Applied and recorded in `supabase_migrations.schema_migrations`:

- `20261013000100`: Shepherd organisations, memberships, people, attributed follow-up history, audit events and transactional functions.
- `20261013000200`: Explicitly remove anonymous function grants. The hosted project's default privileges granted EXECUTE directly to `anon`, in addition to PUBLIC; the second migration handles both. Access checks inside the functions already rejected unauthorised writes, but the anonymous entry points are now denied as well.

Additional migrations are now recorded:

- `20261013000300`: services, Expected lists/entries, attendance observations and resolutions, weekly Recovery assignments, admin actions and audit reads.
- `20261013000400`: future-attendance validation, locked original invitation counts, guest creation and attendance concurrency checks.
- `20261013000500`: retry-safe person creation.
- `20261013000600`: account revision checks to prevent stale access changes from restoring revoked permissions.

The `account-admin` Edge Function is deployed and active. Its handler verifies the caller's real session and current MFA-protected administrator access. Requests without a session or with an invalid session returned 401; an unapproved origin returned 403. Its allowed origins currently cover the two port-3000 Mac development addresses. No real invitation was sent during these hosted checks.

Configured email/password login with public registration disabled, email confirmation required, authenticator MFA enabled and a minimum password length of 12. Preserved existing redirect settings and added the two documented port-3000 Mac development addresses.

Prepared one organisation and one active administrator membership. The account was created without a password and remains unconfirmed. No real email has been sent. The user must verify their address and choose their own password; account creation is not evidence of a successful user login. Do not bypass verification or set a password on their behalf.

Verification:

- All eleven hosted application tables have row-level security enabled.
- Anonymous clients cannot select people or execute any public Shepherd RPC functions. Authenticated execution remains available; internal identity, membership, ownership and MFA checks still apply.
- Direct authenticated updates to the people table are denied, so writes must use the validated transactional function.
- Actual anonymous HTTP requests to the people endpoint and follow-up/date functions returned 401 / permission denied.
- The local integration suite reproduced direct anonymous function grants before applying the second migration, then checked that they were removed. Local tests also verify that a prepared, unconfirmed account can accept an invitation, confirm its email, choose a password and sign in with it.

No contact data or test fixtures were seeded into the hosted project. User sign-in with the real administrator account is still unverified. GitHub access was restored on 13 October 2026, and the connected implementation is available on `oderannaji/shepherdapp`'s `main` branch. The user still needs to download or pull that version, configure the public Supabase connection values and start the app on their Mac before an expiring setup email can redirect there. Sending that email needs the user's explicit instruction.

Run `bun run check:hosted -- your-admin-email@example.com` for a read-only recheck. Tokens stay in secure environment settings. This command uses the environment's supported proxy route; never disable TLS verification.

The post-migration check found zero hosted contact records and the existing single administrator membership. Local tests and fixtures were not uploaded. The new services and Expected endpoints rejected actual anonymous HTTP requests with 401.

Verification completed locally: 37 unit tests, 26 backend test results (24 scenarios and two parent tests), and 15 browser journey checks across the follow-up, account/password and connected workspace suites. Type checking and connected production build passed. Lint has no errors and seven existing Fast Refresh warnings.

The first real administrator's activation/sign-in is still unverified. No production website has been deployed. Cloudflare Workers is recommended because the existing build targets it. The user chose to pause Resend activation until a sender domain is available. See `launch-checklist.md` and `hosting-and-email.md` for the remaining operational steps.
