# ENVER OS Canonical Workflow Governance (v1)

Canonical source of truth:
- `src/lib/workflow/canonical-governance.ts`
- API exposure: `GET /api/crm/workflow-governance`

## Value stream

`Lead -> Deal -> Production -> Procurement -> Finance`

## Domain states

- Lead: `NEW -> QUALIFIED -> PROPOSAL_READY -> CONVERTED`
- Deal: `OPEN -> CONTRACT_SIGNED -> PAYMENT_70 -> HANDOFF_READY -> WON`
- Production: `QUEUED -> ACTIVE -> DONE`
- Procurement: `NOT_STARTED -> REQUESTED -> ORDERED -> FULFILLED`
- Finance: `PENDING -> INVOICED -> PARTIALLY_PAID -> PAID`

## Cross-domain gates

- `LEAD.CONVERTED -> DEAL.OPEN`: lead conversion gate.
- `DEAL.PAYMENT_70 -> PRODUCTION.QUEUED`: payment precondition.
- `PRODUCTION.ACTIVE -> PROCUREMENT.ORDERED`: materials commitment.
- `DEAL.CONTRACT_SIGNED -> FINANCE.INVOICED`: invoicing gate.

## Governance rules

- Transition rules are additive and versioned (`v1`).
- Backward compatibility: existing stage logic remains active while `v1` is consumed progressively.
- Any new transition requires ADR + update of canonical governance file.
