# Implementation stack map — PostgreSQL → Prisma → API → UI → tasks

**Version:** 1.0  
**Grounded in:** `prisma/schema.prisma` (current), `src/app/api/**`, `src/components/deal-workspace/**`, `prisma/sql/partial_uniques.sql`  
**Companion:** [ARCHITECTURE_IMPLEMENTATION_MAP.md](./ARCHITECTURE_IMPLEMENTATION_MAP.md) (deeper SQL snippets), [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md)

**Reality check:** The **running backend** for this monorepo is **Next.js Route Handlers** (`src/app/api/...`). `apps/api` (NestJS) is an **empty shell** — Nest layout below is the **target** if you split services later, or mirror the same boundaries inside Next `lib/` modules.

---

## 1. PostgreSQL schema

### 1.1 Authoritative source

- **Full relational shape:** `pnpm exec prisma migrate diff` (from empty or from current DB) against `prisma/schema.prisma`, or apply **`pnpm prisma db push`** in dev.
- **Correctness constraints not expressible in Prisma:** run after migrations — **[prisma/sql/partial_uniques.sql](../prisma/sql/partial_uniques.sql)**  
  (category policy, readiness rules with nullable `stageId`, one current `Attachment` per `FileAsset`, excluding soft-deleted rows).

### 1.2 Enum types (document core additions)

Prisma maps these to PostgreSQL enums (names match Prisma defaults, quoted identifiers):

| Enum | Values (summary) |
|------|-------------------|
| `AttachmentSource` | MANUAL, GENERATED, INBOX_IMPORT, SYSTEM, SIGNATURE_OUTPUT |
| `VirusScanStatus` | PENDING, CLEAN, REJECTED, SKIPPED |
| `ReadinessImpact` | NONE, SOFT, HARD |
| `SignatureProvider` | DIIA |
| `SignatureRequestStatus` | DRAFT, SENT, IN_PROGRESS, COMPLETED, DECLINED, EXPIRED, CANCELLED |
| `SignatureSequence` | SEQUENTIAL, PARALLEL |
| `SignatureSignerRole` | CLIENT, COMPANY, WITNESS |
| `SignatureSignerStatus` | PENDING, VIEWED, SIGNED, DECLINED |
| `ContractApprovalStatus` | PENDING, APPROVED, REJECTED |
| `ReadinessOverrideStatus` | PENDING, APPROVED, REJECTED, REVOKED |

*(Existing enums: `DealContractStatus`, `AttachmentCategory`, `AttachmentEntityType`, `ReadinessOutcome`, `PermissionKey` extended, etc.)*

### 1.3 Tables — inventory (purpose + key columns)

| Table | Purpose | Key columns / FKs |
|-------|---------|-------------------|
| **DealContract** | Root per deal | `dealId` unique, `currentVersionId` → `DealContractVersion` |
| **DealContractVersion** | Immutable revision | `contractId`, `revision` unique, `lifecycleStatus`, PDF FKs → `Attachment`, `activeSignatureRequestId` unique → `SignatureRequest` |
| **ContractApproval** | Internal approval chain | `contractVersionId`, `stepOrder` **unique together** |
| **SignatureRequest** | Diia attempt | `contractVersionId`, `completedAttachmentId` unique → `Attachment` |
| **SignatureSigner** | Per signer | `signatureRequestId`, role/order/status |
| **SignatureProviderEvent** | Webhook log | `providerEventId` **unique** (idempotency) |
| **Attachment** | File version | `entityType`/`entityId`, `fileAssetId`, `dealContractVersionId`, `signatureRequestId`, `source`, `deletedAt`, self-supersede |
| **FileAsset** | Logical deal file | `dealId`, `category` |
| **DealDocumentRequirement** | Required files | `dealId`, `category`, optional `pipelineStageId` |
| **AttachmentCategoryPolicy** | ACL / readiness weight | `category`, nullable `pipelineId` — **partial uniques in SQL** |
| **AttachmentCategoryPolicyEntityType** | Allowed anchors | composite PK |
| **AttachmentCategoryPolicyPermission** | Upload permissions | composite PK |
| **ReadinessRuleSet** | Bundle per pipeline | `pipelineId` |
| **ReadinessRule** | Configurable check | `ruleSetId`, `ruleKey`, optional `stageId` — **partial uniques in SQL** |
| **ReadinessOverride** | Exception workflow | `dealId`, `ruleKey`, `status`, `approvedAt` |
| **ReadinessEvaluation** | Snapshot | `dealId`, `checksJson` |
| **ReadinessCheckItem** | Line items | `readinessEvaluationId`, `ruleKey`, `passed` |
| **DealPaymentMilestone** | Payment tranche | `dealId`, `sortOrder` unique, `proofAttachmentId` |
| **DomainEvent** | Outbox / idempotency | `dedupeKey` unique, `processedAt` |
| *(+ existing)* | Core CRM | User, Deal, Lead, Handoff, ActivityLog, Automation*, Order, Calendar, Permission* |

### 1.4 Indexes & constraints (reminder)

- `Attachment`: `@@index([entityType, entityId])`, `fileAssetId`, `dealContractVersionId`, `signatureRequestId`.
- **Partial unique** (SQL file): one `isCurrentVersion` per `fileAssetId` where not null and not soft-deleted.

---

## 2. Prisma models

**Single source of truth:** [`prisma/schema.prisma`](../prisma/schema.prisma)

**Models (exhaustive list):**  
`User`, `Account`, `Session`, `VerificationToken`, `Permission`, `PermissionOnUser`, `Lead`, `Order`, `Contact`, `Client`, `Pipeline`, `PipelineStage`, `Deal`, `ReadinessEvaluation`, `ReadinessCheckItem`, `DealHandoff`, `FileAsset`, `AutomationRule`, `AutomationRun`, `DealContract`, `DealContractVersion`, `ContractApproval`, `SignatureRequest`, `SignatureSigner`, `SignatureProviderEvent`, `DealStageHistory`, `CalendarEvent`, `Attachment`, `ActivityLog`, `DealDocumentRequirement`, `AttachmentCategoryPolicy`, `AttachmentCategoryPolicyEntityType`, `AttachmentCategoryPolicyPermission`, `ReadinessRuleSet`, `ReadinessRule`, `ReadinessOverride`, `DealPaymentMilestone`, `DomainEvent`.

**Commands:** `pnpm exec prisma validate` · `pnpm exec prisma generate`

---

## 3. NestJS modules (target layout)

Use when extracting **`apps/api`** or to mirror **service folders** under `src/lib/deal-api/` in Next.

| Module | Responsibility |
|--------|------------------|
| **PrismaModule** | Global `PrismaService` |
| **AuthModule** | JWT/session; `PermissionsGuard` using `PermissionKey` |
| **DealModule** | Deal CRUD, stage, `workspaceMeta` |
| **DealContractModule** | Contract root + versions; **dual-write** orchestration |
| **AttachmentModule** | Upload, list, validate, soft-delete, link to version/signature |
| **FileAssetModule** | Logical files under deal (optional merge into Attachment) |
| **SignatureModule** | `SignatureRequest` lifecycle, Diia client, webhook controller |
| **ReadinessModule** | Evaluate, `ReadinessEvaluation` + `ReadinessCheckItem`, rules, overrides |
| **HandoffModule** | `DealHandoff` + production gate |
| **PaymentModule** | `DealPaymentMilestone` CRUD + confirm |
| **PolicyModule** | `AttachmentCategoryPolicy` admin |
| **ActivityModule** | `ActivityLog` append |
| **AutomationModule** | Rules/runs + **DomainEvent** consumer worker |
| **DomainEventModule** | Enqueue / process outbox |

**Import graph (high level):**  
`SignatureModule` → `AttachmentModule`; `DealContractModule` → `AttachmentModule`; `ReadinessModule` → `DealContractModule`, `AttachmentModule`, `PaymentModule`; `HandoffModule` → `ReadinessModule`.

---

## 4. API endpoints

### 4.1 Convention (current repo)

Base: **`/api/deals/[dealId]/...`** — Next.js Route Handlers, session + permission checks in route or shared `lib/`.

### 4.2 Existing (keep / extend)

| Method | Path | Extend for |
|--------|------|------------|
| GET/PATCH | `/api/deals/[dealId]` | Include `currentVersion` summary when populated |
| PATCH | `/api/deals/[dealId]/stage` | Emit `DomainEvent` / automation hook |
| PATCH | `/api/deals/[dealId]/workspace-meta` | Prefer milestones table over JSON when migrated |
| GET/PATCH | `/api/deals/[dealId]/contract` | **Dual-write** to `DealContractVersion`; load `versions` |
| GET | `/api/deals/[dealId]/readiness-history` | Include `checkItems` when present |
| GET/PATCH | `/api/deals/[dealId]/handoff` | Server gate = readiness service |
| GET/POST | `/api/deals/[dealId]/attachments` | `source`, `fileAssetId`, soft-delete, link `dealContractVersionId` |
| GET | `/api/deals/[dealId]/activity` | No change to shape initially |

### 4.3 New routes to add (suggested)

| Method | Path | Handler responsibility |
|--------|------|-------------------------|
| GET | `/api/deals/[dealId]/contract/versions` | List `DealContractVersion` for deal’s contract |
| GET | `/api/deals/[dealId]/contract/versions/[versionId]` | Single version + signers summary |
| POST | `/api/deals/[dealId]/contract/versions` | Create revision (after policy checks) |
| POST | `/api/deals/[dealId]/contract/versions/[versionId]/signature-requests` | Create `SignatureRequest` + signers |
| GET | `/api/deals/[dealId]/contract/versions/[versionId]/signature-requests` | List requests for version |
| POST | `/api/webhooks/diia` | Verify signature → insert `SignatureProviderEvent` (idempotent) → update signers/request → create `Attachment` |
| GET | `/api/deals/[dealId]/readiness` | Current evaluation + blocker list from rules + live data |
| POST | `/api/deals/[dealId]/readiness/evaluate` | Recompute + write `ReadinessEvaluation` + `ReadinessCheckItem[]` |
| GET/POST | `/api/deals/[dealId]/readiness/overrides` | List / create override request |
| PATCH | `/api/deals/[dealId]/readiness/overrides/[overrideId]` | Approve / reject / revoke |
| GET/POST/PATCH/DELETE | `/api/deals/[dealId]/document-requirements` | `DealDocumentRequirement` CRUD |
| GET/POST/PATCH | `/api/deals/[dealId]/payment-milestones` | `DealPaymentMilestone` + confirm + link proof attachment |
| GET/POST | `/api/admin/attachment-category-policies` | Policy + joins (admin only) |
| POST | `/api/internal/domain-events/process` | Worker: claim `DomainEvent` rows (or use separate worker binary) |

**Permission mapping (examples):**  
`CONTRACT_SEND_SIGNATURE`, `FILE_UPLOAD`, `READINESS_OVERRIDE_APPROVE`, `HANDOFF_SUBMIT`, `PRODUCTION_LAUNCH`, `PAYMENT_CONFIRM` — enforce per route.

---

## 5. Frontend components

**Shell (existing):**  
[`DealWorkspaceShell.tsx`](../src/components/deal-workspace/DealWorkspaceShell.tsx), [`DealWorkspaceHeader.tsx`](../src/components/deal-workspace/DealWorkspaceHeader.tsx), [`DealStageProgress.tsx`](../src/components/deal-workspace/DealStageProgress.tsx), [`DealWorkspaceTabPanels.tsx`](../src/components/deal-workspace/DealWorkspaceTabPanels.tsx), [`DealRightRail.tsx`](../src/components/deal-workspace/DealRightRail.tsx), [`DealActionBar.tsx`](../src/components/deal-workspace/DealActionBar.tsx).

**Tabs:** [`deal-workspace-tabs.ts`](../src/components/deal-workspace/deal-workspace-tabs.ts) — ids: `overview` … `activity`.

### 5.1 Components to add or split out (by tab)

| Tab id | New / extended components | Data hooks |
|--------|---------------------------|------------|
| **overview** | `DealReadinessSummaryCard`, `DealBlockersBar` | `GET /readiness`, last evaluation |
| **contract** | `ContractVersionHeader`, `ContractVersionList`, `ContractEditorPanel`, `SignatureStatusStepper` | contract + versions + active `SignatureRequest` |
| **files** | `FileCategoryGroups`, `RequiredFilesStrip`, `AttachmentVersionBanner`, `UploadDropzone` | attachments + `DealDocumentRequirement` |
| **payment** | `PaymentMilestoneList`, `ConfirmPaymentDialog` | `DealPaymentMilestone` |
| **handoff** | `HandoffGateBanner` (server blockers) | readiness + handoff API |
| **production** | `ProductionLaunchGate` | readiness + `PRODUCTION_LAUNCH` permission |
| **activity** | *(optional)* filter chips for contract/signature | `ActivityLog` |
| **shared** | `PermissionGate` HOC / hook | user permissions from session |

**Feature layer:** extend [`features/deal-workspace/queries.ts`](../src/features/deal-workspace/queries.ts) and [`types.ts`](../src/features/deal-workspace/types.ts) for version/signature/readiness/milestone types.

---

## 6. Implementation tasks

### Phase A — Database & constraints

- [ ] Apply schema: `prisma db push` **or** create baseline migration + `migrate deploy`.
- [ ] Execute **[prisma/sql/partial_uniques.sql](../prisma/sql/partial_uniques.sql)** on the database.
- [ ] Run **`pnpm prisma db seed`** (new `PermissionKey` values).

### Phase B — Contract versions (dual-write)

- [ ] Backfill: one `DealContractVersion` per existing `DealContract`; set `currentVersionId`.
- [ ] Update [`contract/route.ts`](../src/app/api/deals/[dealId]/contract/route.ts): transaction updates root + current version.
- [ ] Add `GET contract/versions` routes.
- [ ] UI: version header + list in **contract** tab.

### Phase C — Attachments & requirements

- [ ] Persist `source`, `deletedAt`; filter deleted in list APIs.
- [ ] Optional: partial unique index job verified in staging.
- [ ] CRUD `DealDocumentRequirement`; **files** tab “required strip”.
- [ ] Link generated PDF to `dealContractVersionId` on upload/generate.

### Phase D — Signature (Diia)

- [ ] `SignatureRequest` / `SignatureSigner` create API.
- [ ] Webhook route + `SignatureProviderEvent` idempotency.
- [ ] On complete: create `Attachment` (`SIGNATURE_OUTPUT`), set `completedAttachmentId`, version timestamps.
- [ ] UI: `SignatureStatusStepper` + polling or SSE.

### Phase E — Readiness & overrides

- [ ] Seed `ReadinessRuleSet` / `ReadinessRule` per pipeline.
- [ ] Evaluator: write `ReadinessCheckItem` + keep `checksJson`.
- [ ] Overrides API + approve flow + UI.
- [ ] Handoff submit: call shared `assertProductionGate`.

### Phase F — Payments

- [ ] Migrate critical `workspaceMeta.payment` → `DealPaymentMilestone` (script).
- [ ] Milestones API + **payment** tab.
- [ ] Link `PAYMENT_CONFIRMATION` attachment to milestone.

### Phase G — Automation & events

- [ ] Emit `DomainEvent` on stage change, file upload, signature complete (minimal set).
- [ ] Worker or cron to process `processedAt IS NULL`.
- [ ] Connect `AutomationRule.trigger` strings to event types.

### Phase H — Permissions

- [ ] Middleware/helper: `requirePermission(key)` on each new route.
- [ ] Map roles → default permissions in seed or admin UI.

### Phase I — Nest (optional split)

- [ ] Scaffold modules per §3; move Prisma calls from Next routes behind HTTP **or** keep Next and only use Nest for long-running workers.

---

**Related:** [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) · [ARCHITECTURE_REDESIGN_IMPLEMENTATION_STATUS.md](./ARCHITECTURE_REDESIGN_IMPLEMENTATION_STATUS.md)
