<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Shepherd architecture

- Build features within `src/features/shepherd/follow-up`, `recovery`, `expected`, and `admin`. Each module exposes its supported exports through `index.ts`; routes and other modules must use that entry point.
- Keep components and helpers used only by a feature inside its module. The Admin screen composes its section components and reuses Expected through its public API.
- Keep all prototype state in the root DemoProvider, in memory only, so navigation preserves edits while refresh restores fictional data.
- Keep people/posts in `shared/data.ts`, the single DemoProvider in `shared/store.tsx`, and attendance, deduplication, merge and scoring calculations in `shared/model.ts` so later data integration cannot introduce inconsistent totals. Shared modules must not depend on feature screens.
- Read `src/features/shepherd/README.md` before adding a feature; update its ownership map when adding a module or public export. Generic UI controls stay in `src/components/ui`.
- Use file-based content routes with a shared Shepherd shell and dynamic admin section route so mobile and desktop navigation retain the same page identities.
- Treat the demo role switcher only as presentation state; real permissions and data access must be implemented independently when a backend is introduced.
