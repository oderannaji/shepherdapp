# Run Shepherd on your computer

1. Install Node.js 24 LTS and Bun 1.4.3 (or a compatible newer Bun).
   Official installers: https://nodejs.org/en/download and https://bun.sh/docs/installation
2. Extract this ZIP. Open the shepherdapp folder in your code editor.
3. Open a terminal inside that folder and run:

   bun install --frozen-lockfile
   bun run dev --host 127.0.0.1 --port 3000 --strictPort

4. Keep that terminal open. Open the Local address printed by Vite in your browser.
   Stop the server with Ctrl+C. If port 3000 is busy, use --port 3001 instead.

Try the app

- Follow-up: search for a person, open their card, add a note and save.
- Recovery: view people needing a follow-up and filter by priority.
- Expected: open My list, record who came, preview totals and post results.
- Admin: use the clearly labelled Demo role control to select Admin. On mobile,
  open the account menu first. Then explore People, Import, Assignments and the other sections.

The prototype uses fictional data. Changes survive navigation but reset when you refresh.
No backend is needed for the demo. Real login and saved follow-up notes are available in connected mode; see SUPABASE-SETUP.md. Other feature backends and automatic messaging are still pending.

Find your code

- src/features/shepherd/follow-up: follow-up screens and contact detail
- src/features/shepherd/recovery: Recovery
- src/features/shepherd/expected: lists, editor and leaderboard
- src/features/shepherd/admin: Admin screens
- src/features/shepherd/identity: real login, membership and MFA
- src/features/shepherd/shared: shared rules, demo state and shared components
- src/features/shepherd/README.md: module ownership guide
- src/routes: app routes

Checks
bun run test
bunx --no-install tsc --noEmit
bun run lint
bun run build

The ZIP includes source and the dependency lockfile. Dependencies, generated builds,
Git metadata and cloud-specific tooling are excluded; installing dependencies is required.
