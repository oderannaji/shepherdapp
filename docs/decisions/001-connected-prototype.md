# Keep the existing framework and connect one feature at a time

The uploaded specification proposes a production architecture. The user chose to organise the current prototype into feature modules and then asked to tackle its missing backend capabilities. Retain React/TanStack Start, Vite and the existing feature boundaries; a framework migration would not itself provide working authentication or data storage.

Add Supabase Auth and Postgres for the first connected slice. The root selects demo or connected mode explicitly. A connected configuration failure never falls back to fictional data. `identity` owns session, membership and MFA gates; `follow-up` owns protected reads and RPC saves. Other demo routes show a clear unfinished-module screen in connected mode. Reusable UI and domain rules remain shared.

Use a browser Supabase client with a public key, protected tables and database-enforced permissions. Private data is fetched after authentication and is not rendered into an unauthenticated server response. There is no service-role credential in the application. Database functions validate requests, enforce ownership, serialise follow-up writes, and write notes and audit events in the same transaction. The local test suite exercises real Auth, PostgREST and concurrent requests.

This approach preserves the demo and gives the remaining modules a working identity boundary. It does not implement invitation/reset screens, canonical attendance, recovery allocation, expected lists, CSV imports, duplicate merges, assignment history or production operations. Those will require their own migrations and access tests.
