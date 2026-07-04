# Web App Rules (Development Mode)

These rules apply to everything under `apps/web/`. They extend the
repository-wide `AGENTS.md`; when more specific, these win.

This is development mode: fast iteration is encouraged.

## Stack

- Next.js 16 (App Router) + TypeScript.
- Tailwind CSS 4 for styling.
- pnpm as the package manager (pinned via `packageManager` and corepack).
- `output: 'standalone'` for minimal Cloud Run containers.

## Dependencies

- Adding or upgrading dependencies (`pnpm add`, `pnpm up`, editing
  `package.json` deps) requires human approval.
- Keep versions pinned; do not float to `latest` implicitly.

## Before Commit

- Run `pnpm lint`.
- Run `pnpm build` and ensure it succeeds.

## Conventions

- Use the App Router (`src/app/`).
- Keep server and client components explicit.
- Do not hardcode secrets; read runtime config from environment variables
  injected by Cloud Run.
