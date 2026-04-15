# ENVER OS Observability, SLO, RBAC/ABAC Baseline

## Observability baseline

Implemented:
- Structured logger: `src/lib/observability/logger.ts`
- Request and correlation tracing headers in API responses: `src/lib/api/http.ts`
- Request context helper: `src/lib/platform/request-context.ts`

Pilot usage:
- `src/app/api/leads/[leadId]/convert-to-deal/route.ts`
- `src/app/api/crm/event-health/route.ts`

## SLO baseline

SLO config source:
- `src/config/slo.ts`

Initial targets:
- API availability: 99.9%
- API latency p95/p99: 700ms / 1500ms
- Event outbox delay budget: 5 minutes
- Workflow error budgets for conversion and stage transitions

## RBAC + ABAC hardening

RBAC:
- canonical permissions in `src/lib/authz/permissions.ts`
- role policy matrix in `src/lib/authz/role-access-policy.ts`

ABAC:
- owner/team/scope logic in `src/lib/authz/data-scope.ts`

Enhancements added:
- `hasEffectiveAnyPermission` helper in `src/lib/authz/permissions.ts`
- policy facade helpers in `src/lib/platform/policy.ts`
- event health endpoint switched to centralized "any-of" permission enforcement.

## Rollout safety

- All changes are additive and backward-compatible.
- No destructive auth model migrations required.
- Existing endpoints continue to work with legacy payloads and permissions.
