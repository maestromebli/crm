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

## Critical Lead Hub E2E

- Critical smoke coverage for Lead Hub is grouped in `pnpm run e2e:lead-hub:critical`.
- The suite currently includes:
  - stage transition from the `Нотатки` tab,
  - UI RBAC gate (no stage advance button action for viewer),
  - API RBAC gate (`PATCH /api/leads/{leadId}` returns `403` for viewer).
- Local run prerequisites:
  - `SCREENSHOT_BASE_URL`
  - `SCREENSHOT_EMAIL`
  - `SCREENSHOT_PASSWORD`
  - `SCREENSHOT_VIEWER_EMAIL`
  - `SCREENSHOT_VIEWER_PASSWORD`
- CI automation lives in `.github/workflows/e2e-lead-hub-critical.yml` and runs daily + manual. If secrets are missing, the workflow exits with a skip notice instead of hard-failing unrelated pipelines.
- On CI failures, inspect uploaded artifact `lead-hub-critical-playwright-*` (contains `playwright-report` and `test-results` with traces/screenshots/videos when available).
- Public Contracts Portal smoke coverage is grouped in `pnpm run e2e:contracts:portal-public` (invalid token guard for page + API routes).
- CI for this public portal suite lives in `.github/workflows/e2e-contracts-portal-public.yml` and uploads artifact `contracts-portal-public-playwright-*`.
- Contracts Portal happy-path smoke is grouped in `pnpm run e2e:contracts:portal-happy` and requires `SCREENSHOT_CONTRACT_PORTAL_TOKEN` (active test share-token).
  - Covers both signing session start and status transitions (`VIEWED_BY_CLIENT` -> `SENT_FOR_SIGNATURE`) plus `viewCount` increment validation.
  - Includes manager API sync check after portal actions (audit entries `portal_viewed` and `portal_sign_start`).
  - Includes manager-side post-effect check for `generate-documents` (expected `CONTRACT` + `SPEC` documents in `/api/contracts/{id}`).
- CI for this suite lives in `.github/workflows/e2e-contracts-portal-happy.yml` and uploads artifact `contracts-portal-happy-playwright-*`.
- Full nightly critical bundle is grouped in `pnpm run e2e:nightly:critical`.
- Nightly stability workflow: `.github/workflows/e2e-nightly-stability.yml` (all critical suites + retries + artifacts).
- Incident drill and SLO response playbook: `docs/ops/incident-drill-nightly-stability.md`.
