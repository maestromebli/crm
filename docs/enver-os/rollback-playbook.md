# ENVER OS Rollback Playbook (Top-3 risky scenarios)

## 1) Lead conversion failures spike

Symptoms:
- Elevated `500` on `/api/leads/[leadId]/convert-to-deal`.
- Repeated idempotency claims without successful deal creation.

Actions:
1. Disable new contract envelope if enabled: `ENVER_FF_PLATFORM_CONTRACTS_V1=false`.
2. Keep idempotency enabled (safe by design), inspect structured logs for failing payloads.
3. Roll back last deploy and rerun smoke checklist.

## 2) Deal stage transitions blocked unexpectedly

Symptoms:
- Many `409` responses from `/api/deals/[dealId]/stage`.
- Business reports inability to move deals.

Actions:
1. Toggle policy feature to legacy mode: `ENVER_FF_DEAL_PRODUCTION_POLICY_V1=false`.
2. Verify existing stage and payment data integrity.
3. Re-enable gradually after root-cause fix.

## 3) Production launch instability

Symptoms:
- `/api/deals/[dealId]/production-launch` returns frequent `500`.
- Production flow is not created for eligible deals.

Actions:
1. Pause rollout to limited cohort only.
2. Roll back deployment affecting launch route.
3. Validate `createProductionFlowFromDealHandoff` path with one known-good deal.

## Rollback gates

- Do not promote rollout until smoke checklist passes.
- Keep canary cohort active for at least one business day before full rollout.
