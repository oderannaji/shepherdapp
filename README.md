# Shepherd

An interactive, fictional UI prototype for Dominion City Manchester. No real authentication, security enforcement, calling, messaging, production database or durable persistence is implemented.

## Routes

- `/`: My people, search, due-date and outcome filters.
- `/people/$id`: Contact detail, notes, outcomes and callbacks; safe demo call/WhatsApp previews.
- `/recovery`: Four-Sunday history, priority filters, permanent vs weekly callers.
- `/expected`: Shared team feed, personal lists, preview/publish, arrivals, explicit absent/unchecked states, results and leaderboard.
- `/admin/$section`: `overview`, `people`, `import`, `duplicates`, `assignments`, `recovery`, `sunday`, `reconciliation`, `users`, `audit`.

## Components and demo state

`src/features/shepherd` contains separate `follow-up`, `recovery`, `expected`, and `admin` modules. Each exposes a public `index.ts`; routes use those entry points. `Shell.tsx` composes navigation, while `shared` owns common identity/status/attendance components, `data.ts` for fictional seeds, `model.ts` for attendance/scoring/identity rules, and the single `store.tsx` provider. See the [module ownership map](src/features/shepherd/README.md) when adding a feature.

Edits survive navigation only; refresh resets everything. Account access exposes role preview, reset and a simulated Expected/contact save failure. The service calendar is intentionally fixed to October 2026.

## Try the journeys

Open a person, write a note, select an outcome/callback and save. Open Expected, select your list, tick Came, optionally explicitly mark Absent, preview totals, and post results. Use the following Sunday selector to create a new list: select multiple names or add guests, preview, then publish. Admin corrections require a reason. Lists with posted results are locked for volunteers. Read-only team posts hide sensitive absent details as “Result recorded”. Original list counts exclude late additions; overall church totals deduplicate person IDs. Caller scores may overlap, with shared/unresolved credit labelled.

Preview Admin with the clearly labelled role switcher. Import accepts a simple fictional CSV (first row headers, first column Name, second Phone; no quoted commas). Sample CSV is also available. Mapping, review and confirmation precede updates. Duplicate merging retains notes and updates Expected identity references; ambiguous attendance is reviewed in reconciliation. Assignments preview the resulting permanent workload. Walk-ins are separate from Expected counts. Invitations never send email.

## Backend integration points

Replace seed data and provider mutation methods with repository reads/writes. Add real authenticated session handling and server-enforced access controls separately; demo roles provide neither. Introduce canonical person/service attendance observations, import validation, transactional merge/assignment actions, concurrency/locking and durable audit records. Server reconciliation should resolve conflicts rather than silently choosing an observation. Add actual messaging integrations only with consent and safeguards.

## Verification

`bun run test` runs the existing attendance/identity rules and route checks. The shared rule tests live in `src/features/shepherd/shared/model.test.ts`; feature-specific tests should live with their module. `bun run lint` checks public module imports as well as the existing lint rules. Use `node_modules/.bin/tsc --noEmit` for TypeScript checks and `bun run build` for the production build.

For browser verification, exercise notes, Expected results, imports and assignments at mobile and desktop widths. Demo state should survive client navigation and reset on refresh.
