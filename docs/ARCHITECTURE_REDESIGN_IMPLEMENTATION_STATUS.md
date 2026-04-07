# Architecture redesign — implementation status

**Version:** 1.2 (post self-audit)

## In `prisma/schema.prisma`

- **Contract / signature / files:** `DealContract` + `DealContractVersion` (+ `updatedAt`), `ContractApproval` (**unique** version + step), `SignatureRequest` / `SignatureSigner` / `SignatureProviderEvent`, extended `Attachment` (+ **`deletedAt`** soft-delete), `ReadinessCheckItem`, `DealDocumentRequirement`, category policy joins, `ReadinessRuleSet` / `ReadinessRule`, **`ReadinessOverride`** with **`ReadinessOverrideStatus`** + **`approvedAt`**
- **Payment + automation backbone:** **`DealPaymentMilestone`**, **`DomainEvent`** (`dedupeKey` unique)
- **Permissions:** extended **`PermissionKey`** + **`prisma/seed.mjs`** (guards must still be wired in API)

## PostgreSQL: partial unique indexes (required for correctness)

Prisma **`@@unique` on nullable columns** does **not** match the intended invariants. After `db push` / migrate, apply:

**[prisma/sql/partial_uniques.sql](../prisma/sql/partial_uniques.sql)**

Covers: global vs pipeline-scoped **category policy**, global vs staged **readiness rules**, **one current Attachment per FileAsset** (excluding null `fileAssetId` and soft-deleted rows).

## Readiness override rule

- No `@@unique(dealId, ruleKey)` — use **status** + service rule: one active **`APPROVED`** per deal/key (respect `expiresAt`).

## Validation

`pnpm exec prisma validate` · `pnpm exec prisma generate` · `pnpm exec tsc --noEmit`

## Docs

- [IMPLEMENTATION_STACK_MAP.md](./IMPLEMENTATION_STACK_MAP.md) — PostgreSQL → Prisma → Nest → **Next API** → components → task phases
- [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md) — audit rationale
- [ARCHITECTURE_IMPLEMENTATION_MAP.md](./ARCHITECTURE_IMPLEMENTATION_MAP.md) — updated §3.6
- [DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md](./DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md) v1.2 §11

## Still application-layer

Dual-write contract PATCH, backfill versions, Diia webhook processor, readiness evaluator writing `ReadinessCheckItem`, permission guards on routes.
