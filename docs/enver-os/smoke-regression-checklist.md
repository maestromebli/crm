# ENVER OS Smoke Regression Checklist

Run after each platform rollout (internal cohort first).

## Lead -> Deal
- Create lead via `/api/leads` and verify response has `x-request-id`.
- Convert lead via `/api/leads/[leadId]/convert-to-deal`.
- Retry convert with same `x-idempotency-key` and verify duplicate-safe response.

## Deal Stage
- Change stage forward by one step using `/api/deals/[dealId]/stage`.
- Attempt invalid jump and verify guard blocks with `409`.

## Production Launch
- Launch production via `/api/deals/[dealId]/production-launch` (`POST`).
- Check status via `/api/deals/[dealId]/production-launch` (`GET`).

## Observability
- Confirm logs include `requestId` and `correlationId`.
- Confirm event health endpoint responds: `/api/crm/event-health`.

## Governance
- Confirm workflow governance endpoint responds: `/api/crm/workflow-governance`.
