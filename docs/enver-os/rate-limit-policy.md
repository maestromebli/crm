# ENVER OS Rate Limit Policy

This policy defines how API throttling is applied across ENVER Sales OS and how to keep it consistent during feature rollout.

## Goals

- Protect public/token endpoints from brute-force and enumeration.
- Protect auth and webhook channels from abuse spikes.
- Preserve API availability (fail-open on transient DB issues).
- Keep limits explicit per endpoint class (not one global number).

## Core implementation

- Shared helper: `src/lib/api/rate-limit.ts`
  - stores counters in `DomainEvent` (`platform.rate_limit.route`).
  - supports subjects: `user`, `ip`, `token`, `webhook`, `workspace`.
  - hashes subject values before storing bucket keys.
  - returns `429` with `Retry-After`.
- Auth integration:
  - `src/lib/auth/options.ts` applies limits on credentials sign-in (`email + ip` bucket).

## Endpoint classes and baseline limits

- `auth` (credentials sign-in)
  - target: repeated login attempts.
  - baseline: `20` requests / `15` minutes.
- `lead create and duplicate checks`
  - `leads:create`: `30` / `5` minutes per user.
  - `leads:check-phone`: `120` / `5` minutes per user.
- `uploads`
  - `lead-hub:upload`: `60` / `5` minutes per user.
- `webhooks`
  - instagram/telegram/viber/whatsapp inbound:
    - baseline `300` / `5` minutes per source subject.
  - instagram verify:
    - baseline `90` / `5` minutes.
- `portal and public token routes`
  - portal contracts view/sign/viewed:
    - baseline `20-60` / `5` minutes per token.
  - public constructor/proposal and token file downloads:
    - baseline `60-120` / `5` minutes per token.
  - client portal token routes:
    - baseline `40-120` / `5` minutes per token.
  - constructor workspace token routes:
    - baseline `80` / `5` minutes per token.

## Currently protected routes

- Leads and quick flow
  - `/api/leads`
  - `/api/leads/check-phone`
- Uploads
  - `/api/lead-hub/upload`
- Webhooks
  - `/api/integrations/instagram/webhook`
  - `/api/integrations/telegram/webhook`
  - `/api/integrations/viber/webhook`
  - `/api/integrations/whatsapp/webhook`
- Portal contracts
  - `/api/portal/contracts/[token]`
  - `/api/portal/contracts/[token]/sign`
  - `/api/portal/contracts/[token]/viewed`
- Public constructor/proposal
  - `/api/public/constructor/[token]`
  - `/api/public/constructor/[token]/deliver`
  - `/api/public/constructor/[token]/messages`
  - `/api/public/constructor/[token]/attachment`
  - `/api/public/proposal/[token]`
- Token-based downloads and client APIs
  - `/api/p/[token]/attachment/[attachmentId]`
  - `/api/c/[token]/attachment/[attachmentId]`
  - `/api/client/[token]/approvals`
  - `/api/client/[token]/messages`
  - `/api/client/[token]/attachment/[attachmentId]`
  - `/api/constructor/[token]/status`
  - `/api/constructor/[token]/questions`
  - `/api/constructor/[token]/file-packages`

## Operational rules

- New public or token endpoint MUST include `requireRouteRateLimitByRequest(...)`.
- New authenticated write endpoint SHOULD include `requireRouteRateLimit(...)` (subject `user`).
- Never expose raw token/email/IP values in bucket identifiers.
- Keep limits close to business semantics:
  - strict for auth/sign/start actions,
  - wider for read-heavy token file downloads.
- For incident response:
  - lower per-endpoint limits first,
  - avoid global throttling unless the platform is under active attack.

## Verification

- Static checks:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
- E2E smoke:
  - `tests/e2e/contracts-portal-public-rate-limit.spec.ts`
  - `tests/e2e/leads-quick-create-no-order-number.spec.ts` (requires seeded credentials via env vars).
