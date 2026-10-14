# Shepherd launch checklist

Updated 14 October 2026. The connected workflows are implemented and tested; production launch still requires the operational items below.

## Implemented and verified

- [x] Connected mode is the default. Demo mode requires an explicit setting.
- [x] Separate volunteer and administrator sign-in entry points and dashboards.
- [x] Database membership checks, administrator MFA, ownership restrictions and immediate access revocation.
- [x] Administrator invitations, password-reset requests, role management and deactivation. Real emails require an explicit action in Accounts.
- [x] Persistent people, retry-safe creation, attributed notes, callbacks and contact suppression.
- [x] Permanent assignments and time-limited weekly Recovery callers.
- [x] Persistent services, Expected lists, guest profiles, original/late invitation counts and locked results.
- [x] Attendance register and CSV input; unknown attendance stays distinct from absent.
- [x] Conflicting observations require explicit reconciliation; church totals deduplicate people.
- [x] Recovery uses consecutive confirmed absences in the four most recent completed services.
- [x] Reviewed people imports, duplicate merges, retained notes and do-not-contact preferences.
- [x] Attributed, read-only audit history.
- [x] Revision checks prevent stale account, contact, list and attendance changes. Mutation retries are idempotent.
- [x] Local unit, database, authentication and browser journey checks completed; type check and production build verified.
- [x] Hosted migrations through `20261013000600` applied without resetting the existing database.
- [x] Hosted `account-admin` function deployed and unauthenticated/invalid-session requests rejected.

## Before a real trial / launch

- [ ] Download or pull the updated code; set the Mac's public connection values with `bun run setup`.
- [ ] First administrator verifies their email, chooses a password and enrols an authenticator. Account creation is not proof of successful sign-in.
- [ ] Choose/deploy the production website. Cloudflare Workers is recommended because the current build already targets it; a `workers.dev` address is sufficient initially.
- [ ] Add the actual website address to Supabase Auth redirects and the account function's allowed origins.
- [ ] Configure production email delivery and test invitation, resend and password recovery with real recipients. **Resend preparation is paused at the user's request: no sender domain yet.** Supabase's default sender is restricted and is not a production invitation service.
- [ ] Verify backups and exercise a restoration; confirm monitoring, support ownership, access-review and data-retention practices.
- [ ] Complete administrator and volunteer acceptance testing on the hosted website, including refresh persistence and denied access to another volunteer's data.

No synthetic contacts or test accounts were inserted into the hosted project. No real invitation email has been sent by the assistant. See [hosting and email preparation](hosting-and-email.md).
