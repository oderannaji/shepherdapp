# Connect Shepherd to Supabase

Connected mode provides real accounts, administrator/volunteer dashboards, people and follow-up, services, Expected lists, attendance reconciliation, Recovery, imports, duplicate merges, assignments and audit history. The fictional demo requires an explicit `VITE_APP_MODE=demo` setting. See `docs/launch-checklist.md` for remaining launch prerequisites.

## Use your existing hosted project

Your project URL is `https://qcejhbyrqvzqxhufexnn.supabase.co`. Migrations through `20261013000600` are applied, including the connected workflows and account-change concurrency guard. The organisation and requested administrator membership are prepared. Email verification and first-password setup are still pending; no real invitation email has been sent. See `docs/hosted-setup-status.md`.

1. All six migrations in `supabase/migrations` are recorded in this hosted project. Do not reapply them or rerun the bootstrap. For a new project, review and apply them in order. Back up an existing database before future migrations. Never run `db reset` against a hosted database.
2. The hosted project already has the required settings. For a new project, in Supabase Authentication settings, enable email/password login, disable public user registration, require email confirmation, and enable authenticator (TOTP) MFA. The local `config.toml` does **not** change these hosted settings. Create or invite the first account through trusted administrative tooling. Invitation links open a password setup screen. Existing users can select **Forgot password?** on the sign-in screen. Configure the exact app address as an allowed redirect URL; for Mac development add `http://localhost:3000/` and/or `http://127.0.0.1:3000/`, matching the address you actually use. Do not replace redirect URLs belonging to another application. No real invitation email has been sent by this setup.
3. This project already has its first organisation and administrator membership. For a new project only, use `supabase/bootstrap.example.sql` as a reviewed SQL-editor template to create them. Replace the example email with that confirmed account's email. Membership roles are stored in the database. Never grant a role through browser metadata. Administrators can invite accounts from Accounts, choose roles, disable access and assign people. Invitees verify their email and choose their own passwords; administrators do not distribute shared passwords.
4. In the folder containing `package.json`, copy `.env.example` to `.env.local`. Set:

   ```dotenv
   VITE_APP_MODE=connected
   VITE_SUPABASE_URL=https://qcejhbyrqvzqxhufexnn.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   ```

   Find the publishable key in your Supabase project's API keys settings. A legacy `anon` key also works. These are public browser keys, protected by row-level security. **Never use a secret key, service-role key or database password in a `VITE_` variable.** The build rejects a private Supabase key in this field. Keep environment files out of Git.

5. You can also create the local connection file interactively with `bun run setup`. Run `bun install --frozen-lockfile`, then `bun run dev --port 3000 --strictPort`. Restart the server after changing environment values. Sign in and complete authenticator setup for an administrator. Add a person, assign an owner, save a note, refresh and confirm it remains.

Node and Bun are installed on your **Mac**. VS Code's terminal uses those installations. Run the commands from the Shepherd folder, not your home directory. Run `pwd` and `ls package.json` to check your location.

The cloud environment now has the three app variables, and a read-only check reached this Supabase project successfully. The hosted schema, login settings and administrator membership are now prepared. `SUPABASE_ACCESS_TOKEN` is securely bound for administrative setup, restricted to `api.supabase.com`. The existing binding works; do not replace it unnecessarily. Never use that token in a `VITE_` variable or paste it into chat. Saving a configuration draft does not apply the database migration.

## Inspect the hosted project before applying changes

With `SUPABASE_ACCESS_TOKEN` securely available, run `bun run check:hosted -- your-admin-email@example.com`. This helper is deliberately bound to the supplied Shepherd project. It reads table metadata, checks whether the designated administrator exists, and reports only the login settings that need changes. It does not print credentials, user records or SMTP secrets, and it does not change the project. The command enables Node 24’s environment proxy support, which is required in this cloud environment; direct DNS access is unavailable. If unrelated public tables exist, review whether the project is shared before changing project-wide authentication settings.

After a reviewed migration and membership bootstrap, verify login using your own browser. Enter your own password there. The assistant does not need your password. The browser's publishable key alone cannot create schema, grant administrator membership or configure project authentication.

## Local development and integration tests

Docker is needed only for a local Supabase database, not when using your hosted project. Install/run Docker Desktop on a Mac before these commands. Keep Node 24 and Bun available.

```bash
bun install --frozen-lockfile
bun run db:start
bun run db:migrate:local
bun run test:integration
bun run db:fixtures
bun run dev:connected --host 127.0.0.1 --port 3001 --strictPort
```

`db:start` starts only the local services used by this slice. `db:migrate:local` applies pending migrations to that local database. Tests use real Supabase Auth and PostgREST, not mocked permissions. Fixture creation refuses non-loopback endpoints and writes synthetic account credentials to ignored `.local/test-accounts.json`; read that file locally to sign in. It also creates ignored `.env.connected.local`. Each fixture/test run creates a separate fictional workspace. Never seed these fixtures into a hosted project. Stop local services with `bun run db:stop`; the CLI preserves local database data.

`dev:connected` uses the local fixture file when it exists. Use ordinary `bun run dev` with `.env.local` for your hosted project. Shell environment variables take precedence over files; do not export hosted `VITE_*` values when running local browser tests.

For the optional browser smoke test, install Python Playwright and its Chromium browser, then run `python scripts/browser-connected.py` while the local app is running on port 3001. On the prepared cloud machine, use `CHROMIUM_PATH=/usr/bin/chromium`. Run `db:fixtures` immediately before the browser test so its administrator has no previously enrolled MFA factor. Browser tests enrol a real local authenticator factor, create a person, save notes and exercise logout, mobile layout and conflicts.

Cloud-specific tooling and proxy instructions are saved in the environment startup configuration. They are not required on your Mac.

For invitation and recovery coverage, run `SUPABASE_HOME=/workspace/.cache/supabase node scripts/password-fixtures.mjs` in the cloud (omit the environment prefix on a Mac), then `CHROMIUM_PATH=/usr/bin/chromium python scripts/browser-passwords.py` while the local app runs. The helper creates only local accounts and writes generated links to ignored `.local/password-links.json`; never print or commit those links. The browser test verifies password creation after an invite, refresh during setup, a subsequent password login, recovery, expired callbacks and recovery with existing MFA. Reset-request email is captured by the local mail service, not sent externally.

## Permission and storage behaviour

- Anonymous and unconfirmed accounts cannot read contacts. Volunteers can read and update only their own assigned contacts. Database checks run on every request, including direct API requests. Deactivating membership blocks subsequent API access with an already-issued token.
- Administrators must have an active membership and an `aal2` session (verified MFA) before reading contacts or creating people. Cross-organisation access stays blocked.
- Follow-up saves atomically update the person's outcome, append an attributed note and write a minimal audit event. A request ID makes retries idempotent. A revision check rejects stale edits; the screen tells you to retain your draft and reload.
- Notes and dates live in Postgres. The browser stores the managed sign-in session, not a copy of the organisation's database. Sign-out clears the app's query cache. Screens poll for changes; revocation can take up to the next poll to disappear visually, while database access is denied immediately.
- Wrong-number and Do-not-contact outcomes suppress contact links. Opening a call or WhatsApp does not claim a conversation happened or send a message automatically. Callback dates use the database's London date.
- This is the first connected feature, not a completed production MVP. Backups/restore drills, website deployment, production email delivery, monitoring and real-user acceptance testing are outstanding. Review those before operational use with real church records.

Password changes require matching inputs of at least 12 characters. Existing authenticator factors must be verified before a password reset. Expired or reused links show an error rather than turning an already-signed-in account into a recovery session. The in-progress password step survives refresh in that tab; it stores only the account ID and step in session storage, not the password or an extra access token.

## Connected account management and workflow checks

The hosted `account-admin` Edge Function is deployed. Its server-side service key never enters the browser. It verifies caller identity, current administrator membership and MFA, and checks exact allowed origins. Current hosted origins cover port 3000 Mac development. Add the actual HTTPS website origin before online testing. Production email is paused until a sender domain is available; see `docs/hosting-and-email.md`.

For the additional local browser suite, start the local invitation endpoint in a separate terminal (these origins are public configuration, not credentials):

```bash
printf '%s\n' 'SHEPHERD_APP_ORIGINS=http://127.0.0.1:3001,http://localhost:3000,http://127.0.0.1:3000' > .local/functions.env
supabase functions serve account-admin --env-file .local/functions.env --no-verify-jwt
```

Then create fresh fixtures and run `CHROMIUM_PATH=/usr/bin/chromium python scripts/browser-workspace.py` in the cloud. It covers administrator MFA, service creation, volunteer isolation, Expected publication and locking, attendance reconciliation, Recovery, imports, assignments, access removal, local invitations and audit history. Local mail goes to the mail catcher. Run fixture-writing browser suites sequentially because they share ignored fixture files.

There are 37 unit tests and 26 backend test results (24 scenarios plus two parent tests). Three browser suites each cover five journeys. Type checking, connected production build and lint pass; lint retains seven existing Fast Refresh warnings. No local fixture data is copied to the hosted project.
