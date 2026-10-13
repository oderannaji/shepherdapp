# Connect Shepherd to Supabase

This adds real sign-in, account permissions, people and durable follow-up notes to the existing app. The original fictional demo remains available. Recovery, Expected, attendance imports, invitations/password-reset screens, assignment changes and the other Admin sections still need backend work.

## Use your existing hosted project

Your project URL is `https://qcejhbyrqvzqxhufexnn.supabase.co`. No hosted schema or data has been changed by this implementation.

1. Review `supabase/migrations/20261013000100_shepherd_identity_follow_up.sql` with your project's existing schema. Back up an existing database before applying migrations. The migration creates new `shepherd_*` tables and a `shepherd_private` schema. It does not alter existing application tables. Apply it once through a reviewed Supabase migration or the SQL editor. Do not run `db reset` against a hosted database.
2. In Supabase Authentication settings, enable email/password login, disable public user registration, require email confirmation, and enable authenticator (TOTP) MFA. The local `config.toml` does **not** change these hosted settings. Create the first confirmed account using trusted administrative tooling; this version's sign-in form expects an existing password. Invitation acceptance and password reset screens are not yet implemented.
3. Use `supabase/bootstrap.example.sql` as a reviewed SQL-editor template to create the organisation and first administrator membership. Replace the example email with that confirmed account's email. Membership roles are stored in the database. Never grant a role through browser metadata. Additional confirmed users need active memberships; administrators can then add people and select their permanent owner in the app.
4. In the folder containing `package.json`, copy `.env.example` to `.env.local`. Set:

   ```dotenv
   VITE_APP_MODE=connected
   VITE_SUPABASE_URL=https://qcejhbyrqvzqxhufexnn.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   ```

   Find the publishable key in your Supabase project's API keys settings. A legacy `anon` key also works. These are public browser keys, protected by row-level security. **Never use a secret key, service-role key or database password in a `VITE_` variable.** The build rejects a private Supabase key in this field. Keep environment files out of Git.

5. Run `bun install --frozen-lockfile`, then `bun run dev`. Restart the server after changing environment values. Sign in and complete authenticator setup for an administrator. Add a person, assign an owner, save a note, refresh and confirm it remains.

Node and Bun are installed on your **Mac**. VS Code's terminal uses those installations. Run the commands from the Shepherd folder, not your home directory. Run `pwd` and `ls package.json` to check your location.

Cloud environment settings have the same three variable requirements saved. Enter the publishable key there, review/save the settings, then publish the environment to apply them. The project hostname is also saved as a network requirement. A saved draft does not connect the running app or apply the database migration.

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

## Permission and storage behaviour

- Anonymous and unconfirmed accounts cannot read contacts. Volunteers can read and update only their own assigned contacts. Database checks run on every request, including direct API requests. Deactivating membership blocks subsequent API access with an already-issued token.
- Administrators must have an active membership and an `aal2` session (verified MFA) before reading contacts or creating people. Cross-organisation access stays blocked.
- Follow-up saves atomically update the person's outcome, append an attributed note and write a minimal audit event. A request ID makes retries idempotent. A revision check rejects stale edits; the screen tells you to retain your draft and reload.
- Notes and dates live in Postgres. The browser stores the managed sign-in session, not a copy of the organisation's database. Sign-out clears the app's query cache. Screens poll for changes; revocation can take up to the next poll to disappear visually, while database access is denied immediately.
- Wrong-number and Do-not-contact outcomes suppress contact links. Opening a call or WhatsApp does not claim a conversation happened or send a message automatically. Callback dates use the database's London date.
- This is the first connected feature, not a completed production MVP. Backups/restore drills, deployment, monitoring, invitation/reset flows and the remaining feature backends are outstanding. Review those before operational use with real church records.
