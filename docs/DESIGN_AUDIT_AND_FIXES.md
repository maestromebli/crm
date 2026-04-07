# Design self-audit — weak points remediated (v1.2)

**Scope:** Prisma schema, SQL constraints, and architecture docs after a principal-level pass for **unsafe uniqueness**, **broken workflows**, and **missing entities**.

---

## 1. PostgreSQL NULL + `@@unique` (critical)

**Problem:** In PostgreSQL, `UNIQUE (a, b)` allows **multiple rows** where `b IS NULL` because `NULL` values are not considered equal to each other.

**Affected (prior design):**

- `AttachmentCategoryPolicy (category, pipelineId)` with `pipelineId` nullable → many “global” rows per category.
- `ReadinessRule (ruleSetId, ruleKey, stageId)` with `stageId` nullable → many “all stages” rows per key.

**Fix:**

- Removed misleading `@@unique` from Prisma for those cases; use `@@index` for lookups.
- Added **[prisma/sql/partial_uniques.sql](../prisma/sql/partial_uniques.sql)** with **partial unique indexes** that split `IS NULL` vs `IS NOT NULL` cases.

---

## 2. Readiness override workflow (broken flow)

**Problem:** `@@unique([dealId, ruleKey])` made it impossible to store **PENDING** request and later **APPROVED** outcome as separate auditable rows (or to revoke).

**Fix:**

- Enum **`ReadinessOverrideStatus`**: `PENDING`, `APPROVED`, `REJECTED`, `REVOKED`.
- Fields **`status`**, **`approvedAt`**.
- Replaced unique with **`@@index([dealId, ruleKey, status])`**.
- **Invariant:** at most one **active** `APPROVED` override per `(dealId, ruleKey)` enforced in **application** (optional future partial unique on `status = APPROVED`).

---

## 3. Contract approval graph (duplicate steps)

**Problem:** Two rows with same `(contractVersionId, stepOrder)` → ambiguous routing.

**Fix:** **`@@unique([contractVersionId, stepOrder])`** on `ContractApproval`.

---

## 4. Signature signer ordering (unsafe DB unique)

**Problem:** A proposed **`@@unique([signatureRequestId, sortOrder])`** would break **PARALLEL** signing where multiple signers legitimately share `sortOrder = 0`.

**Fix:** **No** composite unique on signer ordering; document **application-level** rules (and use `externalRef` / role for disambiguation if needed).

---

## 5. Missing tables (architecture vs schema)

**Problem:** Docs referred to payment milestones and an event/outbox; schema had neither.

**Fix:**

- **`DealPaymentMilestone`** — per-deal ordered tranches, optional `proofAttachmentId`, `confirmedAt` / `confirmedById`.
- **`DomainEvent`** — `type`, `payload`, optional `dealId`, **`dedupeKey` @unique** for idempotent automation ingestion, `processedAt` for workers.

---

## 6. Attachment lifecycle (audit + “current” row)

**Problem:** Hard deletes orphan historical references; partial unique on “current” should ignore tombstoned files.

**Fix:**

- **`Attachment.deletedAt`** — soft-delete for UI/lists; legal/signature rows remain addressable by id.
- Partial unique in SQL uses **`deletedAt IS NULL`** in the predicate.

---

## 7. Version row audit

**Problem:** `DealContractVersion` had only `createdAt`.

**Fix:** **`updatedAt`** with `@updatedAt`.

---

## 8. Permissions (schema vs safety)

**Problem:** Architecture demanded granular keys; `PermissionKey` + seed only had module-level `*_VIEW`.

**Fix:** Extended **`PermissionKey`** with deal/contract/file/readiness/handoff/production/payment atoms and mirrored them in **`prisma/seed.mjs`**.

**Remaining risk:** Keys do **nothing** until **every route** checks them — unchanged engineering obligation.

---

## 9. Documentation drift

**Fix:** [ARCHITECTURE_IMPLEMENTATION_MAP.md](./ARCHITECTURE_IMPLEMENTATION_MAP.md) §3.6 snippets aligned with schema + pointers to `partial_uniques.sql`. [DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md](./DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md) §11 extended with this audit. [ARCHITECTURE_REDESIGN_IMPLEMENTATION_STATUS.md](./ARCHITECTURE_REDESIGN_IMPLEMENTATION_STATUS.md) updated for v1.2.

---

## 10. Still deferred (not “fixed” by this pass)

| Item | Reason |
|------|--------|
| **`ContractTemplate` / clause library tables** | Admin + legal editor milestone; `templateKey` string on version remains sufficient for Phase 1. |
| **`ActivityEntityType.CONTRACT`** | Enum migration + broad `switch` updates across codebase. |
| **Dual-write contract API** | Application work, not schema-only. |
| **Webhook state machine** | Service logic + Diia contract. |

---

**Validate locally:** `pnpm exec prisma validate && pnpm exec prisma generate && pnpm exec tsc --noEmit`
