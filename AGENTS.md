# AGENTS.md

## Workflow

- Never commit directly to `main`.
- Never merge directly to `main`.
- For any code or documentation change, create or reuse a dedicated feature branch.
- Commit changes on that feature branch.
- Push the feature branch to `origin`.
- Open a pull request for review instead of merging locally into `main`.
- If PR creation fails because of permissions or tooling, stop and report that clearly rather than merging straight to `main`.

## Safety

- Before switching branches or pulling, check `git status --short`.
- Do not discard user changes unless explicitly requested.
- If the worktree is dirty and the requested action risks losing changes, stop and ask.

## Verification

- Run the narrowest relevant verification before pushing:
  - frontend/app changes: `npm run build`
  - type-sensitive changes: `npm run typecheck`
- Include the verification performed when handing work back.
