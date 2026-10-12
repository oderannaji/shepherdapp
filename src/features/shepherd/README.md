# Shepherd feature modules

Build each feature here, with one shared source for people, attendance rules and demo state.

| Module      | Owns                                                                                                                              | Public exports                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `follow-up` | My people, search/filter UI, contact details, conversation notes and callbacks                                                    | `FollowUp`, `ContactDetail`           |
| `recovery`  | Recovery priorities, filters and the weekly caller view                                                                           | `Recovery`                            |
| `expected`  | Team feed, post cards, list/result editor and leaderboard                                                                         | `Expected`                            |
| `admin`     | Admin navigation and section views for people, imports, duplicates, assignments, weekly Recovery, reconciliation, users and audit | `Admin`                               |
| `shared`    | Domain types/rules, fictional seeds, one demo provider and shared display components                                              | Explicit exports in `shared/index.ts` |

`Shell.tsx` owns the common navigation and account controls. File routes in `src/routes` compose the shell and public feature exports. Generic buttons, dialogs and other design-system controls remain in `src/components/ui`.

## Adding a feature

1. Find the existing owner above before adding a rule, state field or component.
2. Put feature-only components and helpers inside that module. Keep its public `index.ts` small; internal components such as `ExpectedEditor` stay private to the module.
3. Import another module through its public entry point: `import { Expected } from "../expected"`. Internal files use local imports such as `./PostCard`. ESLint rejects imports into another module's implementation files.
4. Add meaningful feature tests beside the behaviour they verify. Shared domain tests remain beside `shared/model.ts`. Run tests, TypeScript, lint and build, then exercise the changed user journey in the browser.
5. Update this map and the public exports if ownership changes.

## Shared ownership

- `shared/model.ts` is the single home for attendance streaks, deduplication, merge references, Expected totals and editing rules.
- `shared/data.ts` contains the fictional people, posts and users; it is internal to shared state and its tests.
- `shared/store.tsx` owns the single `DemoProvider` and `useDemo`. Mount the provider once in the root route so state survives navigation.
- `shared/ui.tsx` contains the reusable avatar, status, attendance strip, person card, headings and empty state.

Shared code must not import feature screens. Admin composes its own sections and the public Expected screen; it uses the same provider and rules as the volunteer screens. Changes still reset on refresh, and the demo role selector does not enforce real permissions.
