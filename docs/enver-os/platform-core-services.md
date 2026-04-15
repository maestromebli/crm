# ENVER OS Platform Core Services (Phase A)

## Implemented services

- Request tracing: `src/lib/platform/request-context.ts`
  - standardizes `requestId` and `correlationId`.
  - works with response headers via `src/lib/api/http.ts`.
- Policy enforcement facade: `src/lib/platform/policy.ts`
  - consolidates permission checks through authz guard.
- Audit facade: `src/lib/platform/audit.ts`
  - writes activity logs with trace metadata (`requestId`, `correlationId`).
- Idempotency claims: `src/lib/platform/idempotency.ts`
  - uses `DomainEvent.dedupeKey` for safe retried requests.

## Pilot integration

- `POST /api/leads/[leadId]/convert-to-deal` now uses:
  - request context extraction,
  - policy facade,
  - optional idempotency key handling (`x-idempotency-key`),
  - standardized audit writes with tracing metadata.

## Compatibility notes

- Existing API contracts remain additive and backward-compatible.
- Idempotency behavior is opt-in (header-based), so legacy clients are unchanged.
- Cross-cutting services are introduced as wrappers over existing logic to avoid breakage.
