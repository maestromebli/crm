# Development notes

## Database and Prisma

- Run migrations in development with the workflow your team agreed on (`prisma migrate dev` or `db push` for prototypes). Do not commit broken `schema.prisma` states: `pnpm run ci` runs `prisma validate` and `prisma generate`.
- Production deploys should apply migrations explicitly; avoid relying only on `db push` for shared environments.

## API routes

- Prefer consistent JSON shapes: success payloads should be easy for the client to branch on; errors should include a stable `error` string (and optional `code` when useful).
- For debugging and support, API handlers can attach `X-Request-Id` (see `src/lib/api/http.ts`). New routes should use the shared helpers when practical.

## Observability

- Log unexpected failures with enough context to trace (route name, ids), without logging secrets or full PII.
- Correlate work with `X-Request-Id` where the helper is used.

## AI and uploads

- Routes under `api/ai/*` must enforce auth and validate input (e.g. Zod). Treat file uploads as untrusted: size limits, type checks, and virus scanning are environment-specific—document expectations in deployment runbooks.

## Lead pricing UI

- The lead cost / pricing UI is frozen visually unless there is an explicit product decision to change it. Backend and domain logic may evolve (the “engine”), but avoid redesigning those screens without approval.
