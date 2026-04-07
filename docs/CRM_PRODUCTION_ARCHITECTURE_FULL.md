# CRM production architecture — full redesign (evolutionary)

**Version:** 1.1  
**Status:** Architecture specification — **no application code** in this document  
**Source of truth for “today”:** `prisma/schema.prisma` (Lead, Deal, DealContract, Attachment, FileAsset, ReadinessEvaluation, DealHandoff, ActivityLog, AutomationRule/Run, PermissionKey, etc.)  
**Companion docs:** [DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md](./DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md) v1.2, [ARCHITECTURE_IMPLEMENTATION_MAP.md](./ARCHITECTURE_IMPLEMENTATION_MAP.md), [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md)

**Non‑negotiable constraint:** This is an **evolution** of the existing system. New tables and columns are **additive first**; legacy columns (`DealContract.content`, `signedPdfUrl`, `diiaSessionId`) remain until phased retirement with telemetry.

**Terminology reconciliation (template vs v1.1):**

| Your template name | Implementation target | Why |
|--------------------|----------------------|-----|
| **SignatureCallbackLog** | Table **`SignatureProviderEvent`** (append-only webhook/callback log) | Same purpose; unique `providerEventId` = idempotency. |
| **SignedArtifact** | **Not** a second blob store. **Signed file = `Attachment`** with `source = SIGNATURE_OUTPUT`, linked from **`SignatureRequest.completedAttachmentId`**. | Avoids duplicate legal truth, sync bugs, and split audit. “SignedArtifact” in UX/API = **that `Attachment` identity**. |

---

==================================================
SECTION 1 — CRITICAL REVIEW OF CURRENT SCHEMA
==================================================

### 1.1 What is correct and should stay

**Why:** These choices already match manufacturing/sales CRM reality; replacing them wastes migration effort.

| Area | Evidence in schema | Stay because |
|------|-------------------|--------------|
| **Deal as workspace hub** | `Deal` ↔ `Client`, `Pipeline`/`PipelineStage`, optional `Lead`, `Order[]` | All document/signature/readiness work anchors on a single commercial thread. |
| **`DealContractStatus`** | Rich enum from `DRAFT` … `SUPERSEDED` | Maps to legal and UX language; extend per-version, do not replace with stringly types. |
| **`AttachmentCategory`** | Enum aligned to factory/sales artifacts | Taxonomy is already domain-specific (drawings, tech cards, payment proof). |
| **Polymorphic `Attachment`** | `entityType` + `entityId` + index | Supports LEAD/DEAL/HANDOFF/ORDER without premature supertype table explosion. |
| **`FileAsset` + `Attachment` version fields** | `version`, `isCurrentVersion`, optional `fileAssetId` | Correct split: **logical grouping** vs **immutable version row** (needs constraints + linkage completion). |
| **`DealHandoff` vs `workspaceMeta`** | Separate model with `status`, `manifestJson` | Handoff is a compliance gate; must not be only JSON in deal meta. |
| **`ReadinessEvaluation` append-only** | `outcome`, `allMet`, `checksJson`, `evaluatedAt` | Audit/AI need “what we thought at time T”. |
| **`ActivityLog`** | `entityType`, `type`, `source`, `data` | Backbone for human + integration audit. |
| **`AutomationRule` / `AutomationRun`** | `trigger` string, `graphJson`, run status | Right shape for n8n-style evolution; avoid big-bang enum migration on `trigger`. |
| **`DealStageHistory`** | From/to stage, `changedById`, `changedAt` | Required for “workflow not only manual” analytics — automation-driven moves must write here too. |

### 1.2 What is dangerous or insufficient

**Why:** These gaps create legal, operational, or security failure modes in production.

| Area | Problem | Consequence |
|------|---------|-------------|
| **`DealContract` 1:1 + `version` int** | Single `content` JSON; no immutable history | Cannot prove **which text** was signed; concurrent edits and rescinds are ambiguous. |
| **`signedPdfUrl` + `diiaSessionId` on root** | Session ≠ artifact; one slot only | Multiple Diia attempts, partial signers, expiry/resend are not modeled; support cannot reconcile provider state. |
| **Attachment vs FileAsset semantics** | Many `Attachment` rows have `fileAssetId = null` | “Current file” and “required file” logic becomes heuristic; duplicates and orphans. |
| **No FK `Attachment` → contract version** | Contract PDFs indistinguishable from generic `CONTRACT` uploads | Readiness and “active legal document” cannot be computed reliably. |
| **URL-only `fileUrl`** | No `contentHash`, optional storage key | Repudiation, accidental overwrite, CDN swap, and malware risk. |
| **`ReadinessEvaluation` only** | Rules live in code; `checksJson` opaque | Ops cannot tune gates per pipeline/product line without deploy; overrides lack workflow. |
| **`PermissionKey` module-only** | No contract/signature/file atoms | Violates least privilege: user who can “see deal” can often see or act on more than policy allows. |
| **`ActivityEntityType` lacks CONTRACT** | Contract events folded under `DEAL` | Reporting noise; harder to alert on signature fraud patterns. |
| **`AutomationRunStatus.SKIPPED` as silent path** | No compensating human task | Shadow processes outside CRM (WhatsApp/email). |

### 1.3 What will break at scale

1. **Litigation / compliance:** In-place edits to contract JSON after “sent” without version rows.  
2. **Concurrency:** Two “current” `Attachment` rows for same `FileAsset` without **partial unique** index (`WHERE fileAssetId IS NOT NULL AND isCurrentVersion`).  
3. **Data integrity:** Orphan attachments when parent entity deleted — need explicit `onDelete` policy + soft delete strategy per entity.  
4. **Integration load:** Diia webhooks without **idempotent** event store → double application of state.  
5. **Operational truth:** Payment/handoff/readiness split across `workspaceMeta`, `DealHandoff.manifestJson`, attachments → contradictory “ready for production”.  

### 1.4 What must be refactored (behavior + schema, phased)

| Item | Refactor |
|------|----------|
| Contract authoring | All **mutations** go through **version row**; root `DealContract` becomes pointer + cache during transition. |
| Signature | **`SignatureRequest`** graph; `diiaSessionId` **mirrored** then **dropped**. |
| File “truth” | Enforce **one current** per `FileAsset` where `fileAssetId` present; link contract PDFs via **`dealContractVersionId`**. |
| Readiness | **Rule tables** + **override workflow**; evaluator uses relational rules with **code fallback**. |
| Permissions | New **atomic keys** (enum or parallel string table) **wired in API guards** — keys alone change nothing. |

### 1.5 What must split into new entities

| New entity | Role |
|------------|------|
| **`DealContractVersion`** | Immutable revision; owns lifecycle status per attempt; links PDF attachments. |
| **`SignatureRequest` / `SignatureSigner` / `SignatureProviderEvent`** | Full signature lifecycle + idempotent callbacks. |
| **`DealDocumentRequirement`** | Required categories/counts per deal/stage/template. |
| **`AttachmentCategoryPolicy`** (+ joins) | Allowed entity types + who may upload + readiness weight. |
| **`ReadinessRuleSet` / `ReadinessRule`** | Configurable checks (`ruleKey` aligned to code). |
| **`ReadinessOverride`** | Approval + expiry for exceptions. |
| **`ReadinessCheckItem`** (new rows per evaluation) | Transparent, queryable line items (see §5) alongside legacy `checksJson`. |
| **`ContractTemplate`** (deferred until admin need) | Referential templates; **after** `templateKey` on version works. |
| **`ContractClause` / `DealContractVersionClause`** | When legal needs diff-by-clause, not only blob JSON. |
| **`ContractApproval`** | Multi-step internal approval with audit (can start as version columns + evolve to table). |
| **`DomainEvent` / outbox** (recommended) | Automation-first workflow without losing events. |

### 1.6 JSON vs relational (this CRM)

**Stay JSON (with rules):**

| Blob | Rule |
|------|------|
| **`DealContractVersion.content`** | Versioned editor graph; **immutable** after send/approve per policy; new edits → new revision. |
| **`ReadinessEvaluation.checksJson`** | Append-only snapshot; keep for backward compatibility. |
| **`ActivityLog.data`** | Event payload; document schema per `ActivityType`. |
| **`AutomationRule.graphJson`** | Until visual editor; version the graph. |
| **`DealHandoff.manifestJson`** | Until `HandoffManifestItem` migration; validate with strict schema. |

**Must become relational (compliance / query / ACL):**

| Need | Relational home |
|------|-----------------|
| Which file is **signed** legal PDF | `Attachment` + `SignatureRequest.completedAttachmentId` + `DealContractVersion.signedPdfAttachmentId` |
| Who approved internal contract | `ContractApproval` or version columns + `ActivityLog` |
| Which checks blocked production | `ReadinessRule` + `ReadinessCheckItem` (per run) + `ReadinessOverride` |
| Payment proof vs milestone | `DealPaymentMilestone` (phase 2 epic) + `PAYMENT_CONFIRMATION` attachments |

### 1.7 Focus deep-dive: six areas

**DealContract:** Status enum is good; **storage model** is not. **Why change:** Legal and Diia require binding **version + artifact + request** together.

**Attachment:** Already “version row”; missing **provenance** (`source`), **integrity** (`contentHash`), **contract/signature FKs**. **Why:** Readiness and “active document” are derived facts, not conventions.

**FileAsset:** Deal-scoped logical container is correct for **deal workspace** files. **Why keep deal-only in v1:** `dealId` is NOT NULL FK today; nullable `dealId` for “lead files” breaks referential story — lead files stay polymorphic `Attachment` until a deliberate `LeadFileAsset` epic.

**ReadinessEvaluation:** Keep as history; add **config + line items + overrides**. **Why:** Transparency for ops and auditors.

**Permission model:** `Permission` + `PermissionOnUser` is fine structurally; **keys** are too coarse. **Why:** Separation of duties for signature and financial confirmation.

**Automation model:** `trigger` string + `graphJson` is fine; need **event bus**, **dedupe keys**, **retry policy**, and **never SKIPPED without reason** surfaced to UI. **Why:** Event-driven workflow is primary; manual stage change is one input event among many.

---

==================================================
SECTION 2 — TARGET FILE SYSTEM ARCHITECTURE
==================================================

### 2.1 Roles: what `FileAsset` and `Attachment` become

| Layer | Becomes | Why |
|-------|---------|-----|
| **`FileAsset`** | **Logical document** in deal workspace: stable identity, `category`, `displayName`, ordered **versions**. | Users think “the drawing”, not “attachment row #3”. |
| **`Attachment`** | **Physical version** (blob metadata + integrity + provenance) + **links** to contract version / signature request. | Versioning, audit, and automation need row-level facts. |

### 2.2 Required new / extended structures

- **Columns on `Attachment`:** `source`, `contentHash`, `storageKey`, `virusScanStatus`, `validatedAt`/`validatedById`, `dealContractVersionId`, `signatureRequestId`, optional `supersededByAttachmentId`.  
- **New:** `DealDocumentRequirement`, `AttachmentCategoryPolicy` + `AttachmentCategoryPolicyEntityType` + `AttachmentCategoryPolicyPermission`.  
- **Constraint:** partial unique index — at most one `isCurrentVersion` per `fileAssetId` **where `fileAssetId IS NOT NULL`**. **Why:** legacy rows with null `fileAssetId` must not break migration.

### 2.3 File categories (strict taxonomy)

**Phase 1:** Keep existing **`AttachmentCategory`** enum as the canonical taxonomy. **Why:** Already encodes manufacturing reality; extending enum is cheaper than parallel `file_category` table until multi-tenant white-label.

**Mapping (examples):**

| Category | Primary use in workspace |
|----------|-------------------------|
| `MEASUREMENT_SHEET` | Measurement tab + readiness “technical input” |
| `QUOTE_PDF` | Proposal tab |
| `CONTRACT` | Contract tab (draft/signed distinguished by `source` + links) |
| `PAYMENT_CONFIRMATION` | Payment tab + readiness |
| `DRAWING`, `SPEC`, `TECH_CARD` | Production readiness / handoff |
| `HANDOFF` context | `entityType=HANDOFF`, `entityId=DealHandoff.id` |

### 2.4 File lifecycle states

**Version-level (primary):**

| State | Meaning |
|-------|---------|
| `UPLOADED` | Row created; blob URL or storage key set |
| `SCANNING` / virus enum | `virusScanStatus = PENDING` → CLEAN/REJECTED |
| `VALIDATED` | Human/rule confirmed category and binding |
| `CURRENT` | `isCurrentVersion=true` within `FileAsset` (if grouped) |
| `SUPERSEDED` | Newer version exists; old row immutable |
| `LINKED_TO_CONTRACT` | `dealContractVersionId` set |
| `SIGNATURE_OUTPUT` | `source=SIGNATURE_OUTPUT`, `signatureRequestId` set |

**Synthetic UI states (not DB):** `MISSING`, `REQUIRED_BUT_OUTDATED` (derived from requirements + current version + timestamps).

### 2.5 Upload flows

| Flow | Behavior | Auto-linking |
|------|----------|--------------|
| **1. Workspace Files tab** | Default `entityType=DEAL`, `entityId=dealId`; create/update `FileAsset` for deal-scoped docs | Category from section; inherit `AttachmentCategoryPolicy` |
| **2. Drag/drop shell** | Modal if category ambiguous; permission check before accept | Same as Files |
| **3. Inbox (e.g. Telegram)** | **No `MESSAGE` entity today** — ADR: (A) new enum + thread id, or (B) v1: store suggestion in `ActivityLog`/`InboxMessage`, create `Attachment` only after user binds to DEAL/LEAD | AI proposes category + entity; human confirms |
| **4. Generated** | Server creates `Attachment` with `source=GENERATED`, immutable after publish | Set `dealContractVersionId` when PDF is render of that version |

### 2.6 AI classification usage

**Why:** Reduce mis-filed drawings and invoices; never bypass ACL.

- **Input:** bytes or extracted text preview (policy-dependent).  
- **Output:** proposed `AttachmentCategory`, `entityType`, `entityId`, confidence.  
- **Enforcement:** User with `file.upload` confirms; or auto-only when `AttachmentCategoryPolicy` marks category as **auto-assignable** and confidence > threshold.  
- **Audit:** Log proposal + resolution in `ActivityLog` (`source=SYSTEM` or `AI_ASSIST`).

### 2.7 Versioning rules

- **Monotonic `version` int** per `FileAsset` (or per logical key if `fileAssetId` null — use `(entityType, entityId, category, fileName)` only as fallback; prefer creating `FileAsset`).  
- **Immutability:** After `VALIDATED` or after handoff submit (policy), block replace unless `file.replace` + break-glass reason.  
- **Supersede:** New row `isCurrentVersion=true`; old `false`; optional `supersededByAttachmentId` chain.

### 2.8 Active version logic

- **Within `FileAsset`:** exactly one `isCurrentVersion=true` among rows with that `fileAssetId` (DB partial unique).  
- **Across contract draft vs signed:** **Do not** force two currents on same `FileAsset`; use **separate `FileAsset`** rows or distinguish via `source` + `dealContractVersionId` / `signatureRequestId`. **Why:** avoids ambiguous “current” for legal.

### 2.9 Required file rules per stage

- **`DealDocumentRequirement`:** `dealId`, `category`, `minCount`, optional `pipelineStageId`, optional `templateKey`.  
- **Evaluation:** For each rule, count **current** attachments matching category and entity scope (DEAL vs HANDOFF).  
- **Why relational:** Ops must change gates without deploy.

### 2.10 File blocking logic for production

**Server-side (authoritative):**

- Readiness engine returns **hard blockers** from rules + missing attachments + contract/signature state.  
- **Handoff submit** and **production launch** mutations check same service — UI is advisory.  
- **Why:** prevents “click through” when API is bypassed.

### 2.11 File usage by phase (proposal / contract / handoff / production)

| Phase | Categories (typical) | Truth source |
|-------|---------------------|--------------|
| Proposal | `QUOTE_PDF`, `CALCULATION` | Attachments + optional workspaceMeta flags |
| Contract | `CONTRACT` + `dealContractVersionId` | Version + `source` |
| Handoff | Drawings/specs/tech + manifest | `DealHandoff` + `entityType=HANDOFF` attachments |
| Production | `TECH_CARD`, `INSTALL_SCHEME`, `ACCEPTANCE_ACT` | Order/deal linkage + readiness |

### 2.12 File UI representation

- **Grouped by category**; badges: `source` (manual / generated / inbox / signed).  
- **Required strip:** synthetic missing rows + deep links to upload.  
- **Outdated banner** when non-current version displayed.  
- **Contract tab:** show **bound version** and **signature state** next to file.

### 2.13 File permissions (granular)

See §8. **Minimum:** `file.upload`, `file.replace`, `file.delete`, `file.validate`, `file.download`, `file.view_metadata` (optional split from download).

### 2.14 File automations (examples)

- On `file.uploaded` + category drawing → notify production queue.  
- On `file.quarantined` (virus) → lock download + task.  
- On requirement satisfied → emit `readiness.recalculate`.  
- Full list in §7.

---

==================================================
SECTION 3 — TARGET CONTRACT SYSTEM
==================================================

### 3.1 Compatibility with current `DealContract`

**Why:** Production CRM cannot freeze for a rewrite.

- **Retain** all existing columns through Phases 0–2.  
- **Add** `currentVersionId` nullable → `DealContractVersion`.  
- **Dual-write:** PATCH contract updates **root** and **pointed version** in one transaction.  
- **Read switch** in Phase 4 behind feature flag.  
- **Drop** `content` / `diiaSessionId` only in Phase 5 with telemetry.

### 3.2 `DealContract` (root)

**Purpose:** Stable id per deal negotiation thread (today 1:1 `dealId`).

**Fields (existing + new):**

| Field | Role |
|-------|------|
| `id`, `dealId` | Identity |
| `status`, `version` | **Denormalized cache** until Phase 4+ |
| `templateKey`, `content`, `signedPdfUrl`, `diiaSessionId` | Legacy; phased out |
| **`currentVersionId`** | Pointer to authoritative revision for new code |

### 3.3 `DealContractVersion` (NEW)

**Purpose:** Immutable(ish) revision; audit and Diia point here.

| Field | Why |
|-------|-----|
| `revision` | Monotonic per contract |
| `lifecycleStatus` | **Same enum `DealContractStatus`** — avoids parallel enum drift |
| `content`, `contentHash`, `templateKey` | Snapshot at generation/edit boundary |
| `renderedPdfAttachmentId`, `signedPdfAttachmentId` | Legal artifact linkage |
| `sentForSignatureAt`, `fullySignedAt` | Timeline |
| `activeSignatureRequestId` | **Single place** for “in flight” Diia |
| `supersedesVersionId` | Replace/supersede chain |

**Version lifecycle:** DRAFT → … → SENT → … → FULLY_SIGNED | DECLINED | EXPIRED | SUPERSEDED.

### 3.4 `ContractTemplate` (NEW, deferred)

**Why defer:** Versions can carry `templateKey` string today; referential template admin is not on critical path.

| Field | Purpose |
|-------|---------|
| `key` (unique), `name`, `schemaVersion` | Admin + renderer |
| Optional JSON | Clause placeholders |

### 3.5 `ContractClause` (NEW) + `DealContractVersionClause` (NEW)

**Why:** When legal requires “which clauses were on” per version, JSON diff is insufficient.

- **Library:** `ContractClause` (code, title, default text, product line applicability).  
- **Per version:** `DealContractVersionClause` — `included`, `sortOrder`, `overriddenText` nullable.

### 3.6 `ContractApproval` (NEW)

**Why:** Internal approval is a **workflow** with multiple actors; single `approvedById` on version is insufficient for enterprise.

| Field | Purpose |
|-------|---------|
| `contractVersionId` | What is being approved |
| `step` / `stepOrder` | Sequencing |
| `approverUserId` or `approverRoleKey` | Who must act |
| `status` | PENDING / APPROVED / REJECTED |
| `decidedAt`, `comment` | Audit |

**MVP alternative:** version columns + `ActivityLog` only — migrate to table when second approver exists in policy.

### 3.7 Fields moving out of JSON

| From | To |
|------|-----|
| Approval timestamps | `ContractApproval` or version columns |
| Variable snapshot for PDF | Version JSON + `contentHash` |
| “Who sent to Diia” | `SignatureRequest` + `ActivityLog` |

**Remain in JSON:** editor graph structure in `content` until block model matures.

### 3.8 Editable vs locked regions

**Policy by `lifecycleStatus`:**

- **Editable:** DRAFT, GENERATED, EDITED, PENDING_INTERNAL_APPROVAL (role-dependent).  
- **Locked:** APPROVED_INTERNAL and beyond for **commercial** fields; legal may retain break-glass with `contract.edit.locked`.  
- **Why:** Prevents silent post-approval tampering.

### 3.9 PDF generation

- Renderer reads **`DealContractVersion`** snapshot.  
- Output: new `Attachment` (`source=GENERATED`, `dealContractVersionId` set).  
- **Idempotency:** hash request `(versionId, templateKey, contentHash)` to avoid duplicate PDFs unless bump revision.

### 3.10 Replace / supersede logic

**Why:** New commercial terms invalidate old signature.

- New **version** row linked via `supersedesVersionId`.  
- **Cancel** open `SignatureRequest` on superseded version; log in `ActivityLog` + provider if API supports cancel.  
- **UI:** wizard explains impact; show “superseded” banner on old versions.

### 3.11 Workspace UI (contract)

- Header: **revision**, **lifecycle status**, **active signature** state.  
- Left: structured editor; right: PDF preview.  
- Version list: read-only history; compare (future) via clause rows or JSON diff.

---

==================================================
SECTION 4 — SIGNATURE SYSTEM (DIIA)
==================================================

### 4.1 Entities

| Entity | Purpose |
|--------|---------|
| **`SignatureRequest`** | One provider attempt for a **specific** `DealContractVersion` |
| **`SignatureSigner`** | Per-party state, order, timestamps |
| **`SignatureProviderEvent`** (= **SignatureCallbackLog**) | Idempotent append-only callback/webhook log |
| **SignedArtifact** | **Logical:** the `Attachment` referenced by `completedAttachmentId` — **no duplicate blob table** |

### 4.2 Lifecycle

`DRAFT` → `SENT` → `IN_PROGRESS` → `COMPLETED` | `DECLINED` | `EXPIRED` | `CANCELLED`.

**Why:** Mirrors provider + business reality; supports multiple requests per version over time (resend).

### 4.3 Multiple signers + sequence

- **`SignatureSequence`:** SEQUENTIAL | PARALLEL.  
- **`SignatureSigner.sortOrder`** for sequential.  
- **Partial completion:** version may sit in `CLIENT_SIGNED` until `FULLY_SIGNED` — align with existing `DealContractStatus` semantics on **version**, not only root.

### 4.4 Expiration

- `SignatureRequest.expiresAt` from provider or policy.  
- Cron/worker moves to EXPIRED; **new request** required — **never** overwrite prior `SignatureProviderEvent` rows.

### 4.5 Decline handling

- Signer status DECLINED → request DECLINED → version DECLINED or contract-level cache updated.  
- **Why:** sales must see reason and next action (new version vs retry).

### 4.6 Resend logic

- **New** `SignatureRequest` (preferred) or new signers per policy — **append-only** audit.  
- Copy **same version** only if legal allows; else bump revision first.

### 4.7 Replacement logic

- Supersede **version** → cancel open requests tied to old version.  
- **SignedArtifact** (Attachment) remains immutable historical record.

### 4.8 Provider callbacks + audit

- Ingest webhook → insert **`SignatureProviderEvent`** with **unique** `providerEventId`.  
- Processor updates `SignatureSigner` then `SignatureRequest` then creates **`Attachment`** (`SIGNATURE_OUTPUT`) → `completedAttachmentId`.  
- **Concurrency:** row-level lock on `SignatureRequest` id during transition.

### 4.9 Exact workspace UX

| UX element | Behavior |
|------------|----------|
| **Status panel** | Stepper per signer; shows VIEWED/SIGNED; expiry countdown |
| **Progress tracking** | Poll + webhook-driven **SSE** or websocket “deal room” channel keyed by `dealId` |
| **Real-time** | On `SignatureProviderEvent` processed → push event to client; invalidate contract query |
| **Signed replaces draft** | **New** `Attachment` for signed PDF; version `signedPdfAttachmentId` updated; **draft PDF attachment** remains historical (immutable) |
| **Active legal doc card** | “Latest FULLY_SIGNED version” + download gated by `contract.export.signed` |

---

==================================================
SECTION 5 — READINESS SYSTEM
==================================================

### 5.1 Keep `ReadinessEvaluation`

**Why:** Historical truth for “what blocked us on Tuesday”.

### 5.2 Add `ReadinessRule` (+ `ReadinessRuleSet`)

- **`ruleKey`** string **aligned** to existing evaluator ids (`contract_signed`, `prepayment`, `measurement`, `technical_files`, `handoff_package`, …).  
- **No generic expression engine in v1** — avoids undeliverable product.  
- **Fallback:** if DB row missing, code path runs (migration-safe).

### 5.3 Add `ReadinessCheckItem` (per evaluation)

**Why:** `checksJson` alone is opaque to SQL and ops dashboards.

| Field | Purpose |
|-------|---------|
| `readinessEvaluationId` | Parent snapshot |
| `ruleKey` | Which rule |
| `passed` | Result |
| `hardBlock` | Did this block production |
| `detail` | Json: counts, attachment ids, human message |
| `evaluatedAt` | Same as parent or per-line timing |

**Dual-write period:** populate both `checksJson` and rows for new evaluations.

### 5.4 Each readiness check (conceptual catalog)

| ruleKey (example) | Source of truth | Blocking? |
|-------------------|-----------------|-----------|
| `contract_signed` | Latest `DealContractVersion.lifecycleStatus` + signed attachment | Hard for production |
| `prepayment` | `DealPaymentMilestone` + `PAYMENT_CONFIRMATION` | Configurable |
| `measurement` | `MEASUREMENT_SHEET` + optional workspaceMeta | Often hard |
| `technical_files` | DRAWING/SPEC/TECH_CARD counts | Hard |
| `handoff_package` | `DealHandoff.status` + manifest | Hard at gate |
| `internal_approval` | `ContractApproval` or version status | Hard before send |

*(Extend per pipeline in `ReadinessRule` rows.)*

### 5.5 Override logic

- **`ReadinessOverride`:** `dealId`, `ruleKey`, reason, **`status`** (`PENDING` → `APPROVED` / `REJECTED` / `REVOKED`), requester, approver, **`approvedAt`**, optional `expiresAt`. **No** DB unique on `(dealId, ruleKey)` — that blocked workflow; enforce at most one **active `APPROVED`** in the service.  
- **Why relational:** auditors ask “who overrode prepayment and when”.

### 5.6 UI

- Sticky **blockers** bar with expandable reasons + deep links (upload / contract / handoff).  
- **Explain:** show `ReadinessCheckItem` lines for last run.

### 5.7 Connection to production launch

- **Single service** `assertProductionGate(dealId)` used by handoff submit, order release, and automation actions.  
- **Why:** one brain, no drift between UI and worker.

---

==================================================
SECTION 6 — DATABASE ARCHITECTURE
==================================================

### 6.1 Strategy summaries

| Concern | Approach |
|---------|----------|
| **Versioning** | Monotonic `revision` on `DealContractVersion`; contract root cache fields |
| **Idempotency** | `SignatureProviderEvent.providerEventId` UNIQUE; **`DomainEvent.dedupeKey`** UNIQUE; automation run payload optional |
| **Audit** | `ActivityLog` + append-only evaluations/events; attachments immutable after signature |
| **Concurrency** | Transactions on dual-write; row locks on signature state transitions; optimistic UI with ETag/version |

### 6.2 Tables (catalog)

**Unchanged core:** `User`, `Lead`, `Contact`, `Client`, `Pipeline`, `PipelineStage`, `Deal`, `DealStageHistory`, `Order`, `CalendarEvent`, `Permission`, `PermissionOnUser`, `ActivityLog`, `AutomationRule`, `AutomationRun`, `ReadinessEvaluation` (extended optional FK later).

**Evolving:**

| Table | Purpose | Key fields / relationships | Indexes / constraints |
|-------|---------|------------------------------|------------------------|
| **`DealContract`** | Root | +`currentVersionId` | unique `dealId`; index none extra |
| **`DealContractVersion`** | Revisions | FK `contractId`; optional PDF FKs to `Attachment`; `activeSignatureRequestId` | `@@unique([contractId, revision])`; index `contractId` |
| **`Attachment`** | Version/blob | +`source`, hashes, FKs, **`deletedAt`** | `(entityType, entityId)`; **partial unique** current per `fileAssetId` (exclude null + soft-deleted) |
| **`FileAsset`** | Logical file | unchanged deal scope | `dealId` |
| **`SignatureRequest`** | Diia attempt | FK `contractVersionId`; `completedAttachmentId` | index version; unique provider event id |
| **`SignatureSigner`** | Party | FK request | index request |
| **`SignatureProviderEvent`** | Callback log | FK request; UNIQUE `providerEventId` | index request |
| **`DealDocumentRequirement`** | Required files | FK deal, optional stage | index deal |
| **`AttachmentCategoryPolicy`** | Policy | category × pipeline nullable | **partial uniques** in SQL — plain `@@unique` allows duplicate `(cat, NULL)` |
| **`AttachmentCategoryPolicyEntityType`** | Allowed entities | composite PK | — |
| **`AttachmentCategoryPolicyPermission`** | Upload ACL | composite PK | — |
| **`ReadinessRuleSet`** | Bundle | FK pipeline | index pipeline |
| **`ReadinessRule`** | Rule | FK set; `ruleKey` | **partial uniques** in SQL for `stageId` NULL vs set |
| **`ReadinessOverride`** | Exception | FK deal | index `(dealId, ruleKey, status)`; service enforces one active approval |
| **`ReadinessCheckItem`** | Line items | FK evaluation | index evaluation |
| **`ContractTemplate`** | Admin templates | deferred | unique key |
| **`ContractClause`** | Library | deferred | code unique |
| **`DealContractVersionClause`** | Included clauses | FK version, clause | index version |
| **`ContractApproval`** | Approval chain | FK version | **unique** `(contractVersionId, stepOrder)` |
| **`DealPaymentMilestone`** | Payments | FK deal, optional proof `Attachment` | unique `(dealId, sortOrder)` |
| **`DomainEvent`** | Outbox | `type`, `payload`, `processedAt`, optional `dealId` | **`dedupeKey` unique** |

### 6.3 Edge cases explicitly handled

- **Lead files without FileAsset:** `entityType=LEAD`, `fileAssetId` null — requirements evaluated only when deal exists or lead-specific rules added later.  
- **HANDOFF attachments:** `entityId = DealHandoff.id`.  
- **Two currents bug:** prevented by partial unique for fileAsset scope only.  
- **Webhook duplicate:** `SignatureProviderEvent` insert conflict → no-op retry.

---

==================================================
SECTION 7 — WORKFLOW ENGINE (N8N STYLE)
==================================================

### 7.1 Model

| Piece | Implementation |
|-------|----------------|
| **Triggers** | Domain events (see §D) + `AutomationRule.trigger` string (documented vocabulary) |
| **Conditions** | JSON in `graphJson` nodes (field comparisons, stage slugs, categories) |
| **Actions** | HTTP webhook, internal API, email, task create, notify, stage move |
| **Execution** | `AutomationRun` row per execution; status SUCCESS/FAILED/SKIPPED **with reason** |
| **Retries** | Exponential backoff; max attempts on run row |
| **Dedup** | `idempotencyKey` in payload or `DomainEvent` unique key |
| **Queue** | Worker consumes outbox / job table — **do not** run long flows in HTTP request |

### 7.2 At least 25 workflows

| # | Workflow name | Trigger | Condition (sketch) | Action |
|---|---------------|---------|-------------------|--------|
| 1 | Gate: block production | `readiness.evaluated` | any hardBlock | notify ops + lock launch flag |
| 2 | Notify drawing uploaded | `file.uploaded` | category=DRAWING | Slack + assign engineer |
| 3 | Contract sent externally | `contract.sent_signature` | — | task follow-up in 48h |
| 4 | Signature completed | `contract.signature.completed` | — | refresh readiness + notify sales |
| 5 | Signature expired | `contract.signature.expired` | — | task + email client |
| 6 | Signature declined | `contract.signature.declined` | — | freeze version + notify manager |
| 7 | Internal approval pending SLA | `contract.approval.pending` | age > 24h | escalate |
| 8 | Prepayment missing | `readiness.blocked` | ruleKey=prepayment | finance task |
| 9 | Measurement missing | `readiness.blocked` | ruleKey=measurement | schedule measurement event |
| 10 | Handoff submitted | `handoff.submitted` | — | notify production queue |
| 11 | Handoff rejected | `handoff.rejected` | — | task sales + restore draft |
| 12 | Stage advanced | `deal.stage_changed` | toStage=production gate | run readiness |
| 13 | Lead converted | `deal.created` | fromLead | copy qualified attachments policy |
| 14 | File quarantined | `file.virus.rejected` | — | lock download + alert |
| 15 | Payment proof attached | `file.uploaded` | category=PAYMENT_CONFIRMATION | mark milestone candidate |
| 16 | Milestone confirmed | `payment.milestone.confirmed` | — | recalc readiness |
| 17 | Contract version superseded | `contract.version.superseded` | — | archive links in comms |
| 18 | Diia webhook failure | `integration.diia.error` | — | incident + retry queue |
| 19 | Readiness override requested | `readiness.override.requested` | — | manager approval task |
| 20 | Readiness override approved | `readiness.override.applied` | — | log compliance + notify |
| 21 | SLA deal stale | `deal.stale` | no activity 14d | task owner |
| 22 | AI low confidence classify | `file.classification.low_confidence` | — | human queue |
| 23 | Order released | `order.released_to_production` | readiness passed | notify plant |
| 24 | Calendar measurement done | `calendar.event.completed` | type=MEASUREMENT | suggest MEASUREMENT_SHEET requirement met |
| 25 | Automation run failed | `automation.run.failed` | — | pager duty / email admin |

---

==================================================
SECTION 8 — PERMISSIONS SYSTEM
==================================================

### 8.1 Why redesign

Module keys (`LEADS_VIEW`) cannot express **send Diia** vs **view signed PDF** vs **override readiness**. **Why:** SoD and GDPR-style minimization.

### 8.2 Granular actions (keys)

**Contract:** `contract.view`, `contract.create`, `contract.edit`, `contract.edit.locked`, `contract.approve.internal`, `contract.send.signature`, `contract.cancel.signature`, `contract.view.signature.status`, `contract.export.signed`  

**Files:** `file.upload`, `file.replace`, `file.delete`, `file.validate`, `file.download`, `file.view`  

**Payment:** `payment.view`, `payment.confirm`, `payment.override`  

**Readiness:** `readiness.view`, `readiness.override.request`, `readiness.override.approve`  

**Handoff:** `handoff.edit`, `handoff.submit`, `handoff.accept`, `handoff.reject`  

**Production:** `production.launch`, `production.view`  

**Deal:** `deal.move_stage` (optional separate from edit), `deal.view`, `deal.edit`  

**Implementation:** extend `PermissionKey` enum **or** parallel `StringPermission` table + join — **either way**, **wire every route**.

### 8.3 Role mapping (example)

| Key | Admin | Manager | Sales | Operations | Viewer |
|-----|-------|---------|-------|------------|--------|
| contract.send.signature | ✓ | ✓ | policy | ✗ | ✗ |
| contract.export.signed | ✓ | ✓ | ✗ | ✓ | ✗ |
| file.upload | ✓ | ✓ | ✓ | ✓ | ✗ |
| file.delete | ✓ | ✓ | limited | ✗ | ✗ |
| readiness.override.approve | ✓ | ✓ | ✗ | ✗ | ✗ |
| production.launch | ✓ | ✓ | ✗ | ✓ | ✗ |
| handoff.accept | ✓ | ✓ | ✗ | ✓ | ✗ |

**Why “policy” for Sales on send:** some orgs restrict Diia to managers — configurable via role template.

---

==================================================
SECTION 9 — UNIFIED DEAL WORKSPACE UX
==================================================

**Shell:** `layout` with **header** (title, client, owner, value), **stage bar** (pipeline-driven; automation can change stage — bar shows **reason** tooltip from last `DealStageHistory` / event).

### 9.1 Tabs

| Tab | Layout | Actions | States / blockers | AI |
|-----|--------|---------|-------------------|-----|
| **Overview** | KPI cards + next steps | Edit deal fields (ACL) | Readiness summary | Suggest next action |
| **Messages** | Thread list + composer | Send (integration) | If no unified inbox, link external | Summarize thread |
| **Qualification** | Checklist + lead link | Convert / link contact | Missing BANT-like fields | Suggest qualification score |
| **Measurement** | Events + files | Schedule event, upload sheets | Missing `MEASUREMENT_SHEET` | Extract dimensions from PDF |
| **Proposal** | Quote list + `QUOTE_PDF` | Generate/upload | Version outdated | Compare to historical quotes |
| **Contract** | Editor + PDF + versions | Edit, approve, send Diia | Signature/approval blockers | Clause suggestions (governed) |
| **Payment** | Milestones + proofs | Confirm payment (ACL) | Prepayment blocker | Match bank memo |
| **Files** | Category groups + required strip | Upload/replace/validate | Virus/quarantine | Classify + route |
| **Handoff** | Manifest + status | Submit / view rejection | Server readiness gate | Validate manifest completeness |
| **Production** | Order/release cards | Launch (ACL) | Hard readiness fails | ETA / risk flags |
| **Activity** | Timeline | Filter by type | — | Summarize week |

**Real-time:** subscribe to deal channel for signature + readiness + automation events.

---

==================================================
SECTION 10 — MIGRATION PLAN
==================================================

### 10.1 What stays

All existing tables listed in §1.1 remain; rows preserved.

### 10.2 What changes (additive first)

- **`DealContract`:** +`currentVersionId`.  
- **`Attachment`:** new columns + indexes + partial unique.  
- **`ReadinessEvaluation`:** optional `readinessRuleSetVersion` later.

### 10.3 What is added

`DealContractVersion`, `SignatureRequest`, `SignatureSigner`, `SignatureProviderEvent`, `DealDocumentRequirement`, category policy tables, readiness rules/overrides/check items, `ContractApproval`, clause tables (phased), payment milestones (phased), optional `DomainEvent`.

### 10.4 Migrating `DealContract` / `Attachment` / `FileAsset`

| Asset | Steps |
|-------|--------|
| **DealContract** | Phase 0: create `DealContractVersion` table; Phase 1: backfill one version per contract; dual-write; Phase 4: read from version; Phase 5: drop legacy columns |
| **Attachment** | Add nullable FKs; backfill `dealContractVersionId` only when confident; `signedPdfUrl` → stub `Attachment` **integrity warning** — validate or re-fetch |
| **FileAsset** | No forced merge; add partial unique for currents |

### 10.5 Downtime avoidance

- **Expand:** add nullable columns and tables.  
- **Dual-write:** app writes both paths.  
- **Contract:** feature-flag reads.  
- **Contract:** never drop columns in same release as code that still reads them.

### 10.6 History preservation

- Never delete old `Attachment` rows when superseding; set `isCurrentVersion=false`.  
- Keep all `SignatureRequest` / `SignatureProviderEvent` rows.  
- `ReadinessEvaluation` append-only forever.

---

==================================================
SECTION 11 — FINAL VALIDATION
==================================================

| Check | Result |
|-------|--------|
| Missing entities | Addressed: version, signature graph, rules, check items, approvals, policy tables; **`DealPaymentMilestone`**, **`DomainEvent`** in schema |
| Broken flows | Resend/expire/decline/supersede explicitly modeled; webhook idempotency |
| File lifecycle | Source, hash, scan, validate, supersede, **`deletedAt`**, partial unique (+ SQL file), required rules |
| Contract lifecycle | Version + approval (**unique step**) + PDF + supersede |
| Signature lifecycle | Request/signers/events/completed attachment (**no unsafe signer sortOrder unique**) |
| Readiness coverage | Rules + items + overrides (**status workflow**, no bogus `(deal, ruleKey)` unique) + single gate service |
| Permissions safety | Granular keys **in enum + seed** + route wiring still required |
| PostgreSQL NULL uniques | **Never** trust `@@unique` on `(x, nullable)` for global-vs-scoped rows — use **`prisma/sql/partial_uniques.sql`** |

**Self-critique (v1.2):** Implemented in repo — see [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md).

---

## A. Final architecture summary

**Unified Deal Workspace** is the **only** place where contract, files, signature, payment proofs, handoff, and production gates converge on **one `dealId`**. **Files** are **`FileAsset` + `Attachment`** with provenance and FKs to **contract version** and **signature request**. **Contracts** are **`DealContract` + `DealContractVersion`** with phased dual-write. **Diia** is **`SignatureRequest`** + **`SignatureSigner`** + **`SignatureProviderEvent`**, with **signed PDF = `Attachment`**. **Readiness** combines **`ReadinessRule`** + **`ReadinessCheckItem`** + **`ReadinessOverride`** with retained **`ReadinessEvaluation`**. **Workflow** is **event-driven**: stage change is one event among many; **automation** uses documented triggers + graph + outbox.

---

## B. Final database tables (inventory)

**Existing (keep):** User, Lead, Contact, Client, Pipeline, PipelineStage, Deal, DealStageHistory, DealContract, DealHandoff, Attachment, FileAsset, ReadinessEvaluation, ActivityLog, AutomationRule, AutomationRun, Order, CalendarEvent, Permission, PermissionOnUser (+ auth tables).

**New / extended (in schema):** DealContractVersion, SignatureRequest, SignatureSigner, SignatureProviderEvent, DealDocumentRequirement, AttachmentCategoryPolicy (+2 join), ReadinessRuleSet, ReadinessRule, ReadinessOverride (+ status), ReadinessCheckItem, ContractApproval, DealPaymentMilestone, DomainEvent, extended Attachment/DealContract/PermissionKey. **Still defer:** ContractTemplate, ContractClause, DealContractVersionClause (until legal/editor milestone).

---

## C. 25 automations

Listed in **§7.2**.

---

## D. 25 events (canonical domain event types)

| # | Event type |
|---|------------|
| 1 | `deal.created` |
| 2 | `deal.updated` |
| 3 | `deal.stage_changed` |
| 4 | `deal.stale` |
| 5 | `file.uploaded` |
| 6 | `file.replaced` |
| 7 | `file.deleted` |
| 8 | `file.validated` |
| 9 | `file.virus.rejected` |
| 10 | `file.classification.low_confidence` |
| 11 | `contract.version.created` |
| 12 | `contract.version.superseded` |
| 13 | `contract.approval.pending` |
| 14 | `contract.approval.resolved` |
| 15 | `contract.sent_signature` |
| 16 | `contract.signature.completed` |
| 17 | `contract.signature.declined` |
| 18 | `contract.signature.expired` |
| 19 | `readiness.evaluated` |
| 20 | `readiness.blocked` |
| 21 | `readiness.override.requested` |
| 22 | `readiness.override.applied` |
| 23 | `handoff.submitted` |
| 24 | `handoff.rejected` |
| 25 | `automation.run.failed` |

*(Extend: `payment.milestone.confirmed`, `order.released_to_production`, `integration.diia.error`, `calendar.event.completed`.)*

---

## E. Top 15 risks

1. Dropping `DealContract.content` before all readers migrated.  
2. Two current `Attachment` rows per `FileAsset` (missing partial unique).  
3. Treating `signedPdfUrl` as legal without `Attachment` integrity hash.  
4. Webhook double-processing without `SignatureProviderEvent` uniqueness.  
5. Readiness UI bypass — server not enforcing same rules as UI.  
6. Permission keys added but **not enforced** in API.  
7. `SKIPPED` automation runs hiding failures.  
8. Superseding contract without cancelling open `SignatureRequest`.  
9. Orphan attachments after entity delete (weak `onDelete` policy).  
10. NULL uniqueness surprises on `ReadinessRule` / policy tables.  
11. Lead vs deal file asymmetry confusing support (document clearly).  
12. Concurrent contract PATCH without transaction — root/version drift.  
13. AI auto-file to wrong entity — no human confirm.  
14. Storing PII in `AutomationRun.payload` without retention policy.  
15. **Manual stage** assumed as only progression — automations not writing `DealStageHistory`.

---

**End of document.**
