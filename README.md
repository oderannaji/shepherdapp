# Shepherd

A modular church-care app for Dominion City Manchester. Connected mode is the default: real accounts, protected administrator/volunteer dashboards, people and follow-up, Expected lists, attendance, Recovery and administration. The original fictional demo is available only when explicitly requested with `VITE_APP_MODE=demo`.

## Run from Mac Terminal

Open the folder containing `package.json`, then run:

```bash
bun install --frozen-lockfile
bun run setup
bun run dev --port 3000 --strictPort
```

`setup` asks for the public Supabase connection values and creates an ignored `.env.local`. It preserves an existing file. Set `VITE_APP_MODE=connected` in that file if you previously selected demo mode. Use only a publishable/anon key; never a service-role key. Keep Terminal open and open the local address printed by Vite. Volunteers sign in at `/`; administrators use `/admin/overview` and complete authenticator verification.

See [Supabase setup](SUPABASE-SETUP.md), the [launch checklist](docs/launch-checklist.md), and [hosting and email preparation](docs/hosting-and-email.md). The first real administrator login, production email and website deployment still need completion.

## Demo routes

- `/`: My people, search, due-date and outcome filters.
- `/people/$id`: Contact detail, notes, outcomes and callbacks; safe demo call/WhatsApp previews.
- `/recovery`: Four-Sunday history, priority filters, permanent vs weekly callers.
- `/expected`: Shared team feed, personal lists, preview/publish, arrivals, explicit absent/unchecked states, results and leaderboard.
- `/admin/$section`: `overview`, `people`, `import`, `duplicates`, `assignments`, `recovery`, `sunday`, `reconciliation`, `users`, `audit`.

## Components and demo state

`src/features/shepherd` contains separate `follow-up`, `recovery`, `expected`, and `admin` modules. Each exposes a public `index.ts`; routes use those entry points. `Shell.tsx` composes navigation, while `shared` owns common identity/status/attendance components, `data.ts` for fictional seeds, `model.ts` for attendance/scoring/identity rules, and the single `store.tsx` provider. See the [module ownership map](src/features/shepherd/README.md) when adding a feature.

Edits survive navigation only; refresh resets everything. Account access exposes role preview, reset and a simulated Expected/contact save failure. The service calendar is intentionally fixed to October 2026.

## Try the fictional demo journeys

Open a person, write a note, select an outcome/callback and save. Open Expected, select your list, tick Came, optionally explicitly mark Absent, preview totals, and post results. Use the following Sunday selector to create a new list: select multiple names or add guests, preview, then publish. Admin corrections require a reason. Lists with posted results are locked for volunteers. Read-only team posts hide sensitive absent details as “Result recorded”. Original list counts exclude late additions; overall church totals deduplicate person IDs. Caller scores may overlap, with shared/unresolved credit labelled.

Preview Admin with the clearly labelled role switcher. Import accepts a simple fictional CSV (first row headers, first column Name, second Phone; no quoted commas). Sample CSV is also available. Mapping, review and confirmation precede updates. Duplicate merging retains notes and updates Expected identity references; ambiguous attendance is reviewed in reconciliation. Assignments preview the resulting permanent workload. Walk-ins are separate from Expected counts. Invitations never send email.

## Connected workflows and launch status

Connected accounts cannot change their own role. Administrators can invite and manage accounts, create people/services, review imports, change assignments, merge duplicates and inspect audit history. Volunteers see their own people and current weekly Recovery assignments. Expected results lock after posting; administrator corrections require a reason. Attendance conflicts stay unresolved until reviewed, and unknown is never treated as absent.

The hosted schema and account-management endpoint are installed. Production email is paused until a sender domain is available; no real invitation was sent by the assistant. Hosting, first-account activation, backup restoration and real-user acceptance testing remain on the launch checklist. The current build targets Cloudflare Workers; it has not been deployed to a public website.

## Verification

`bun run test` runs domain, configuration, import and identity checks. `bun run test:integration` exercises real local Supabase permissions, account management, atomic saves and concurrency. The shared rule tests live in `src/features/shepherd/shared/model.test.ts`; feature-specific tests should live with their module. `bun run lint` checks public module imports as well as the existing lint rules. Use `node_modules/.bin/tsc --noEmit` for TypeScript checks and `bun run build` for the production build.

For browser verification, exercise notes, Expected results, imports and assignments at mobile and desktop widths. Demo state should survive client navigation and reset on refresh.
