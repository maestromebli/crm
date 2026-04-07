# Document Core — Schema Review & Target Redesign (Grounded in Current DB)

**Version:** 1.2 (Section 11 + design audit rows — see [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md))  
**Audience:** Product, engineering, legal/ops  
**Source of truth:** `prisma/schema.prisma` as of this review (Deal, DealContract, Attachment, FileAsset, ReadinessEvaluation, DealHandoff, ActivityLog, AutomationRule, PermissionKey, enums).  
**Scope:** Production-grade evolution — **not** a greenfield rewrite; **compatible migration** from current shapes.

---

## SECTION 1 — REVIEW OF CURRENT SCHEMA

### 1.1 What is already good and should stay

| Area | Why keep |
|------|-----------|
| **Deal** as hub | Correct anchor for workspace; relations to `Client`, `Pipeline`/`PipelineStage`, `Lead`, `Order` are sound. |
| **DealContractStatus** enum | Rich enough for a first-class lifecycle; maps cleanly to UX and automation triggers. |
| **AttachmentCategory** | Practical manufacturing/sales taxonomy; can be extended or normalized via config without throwing away enum immediately. |
| **Polymorphic Attachment (`entityType` + `entityId`)** | Already supports Lead/Deal/Handoff-shaped use cases; indexes exist. |
| **FileAsset + Attachment versioning** | Right *direction*: logical grouping (`FileAsset`) + version rows (`Attachment.version`, `isCurrentVersion`). |
| **DealHandoff** separate from `workspaceMeta` | Good separation for structured handoff state vs ad-hoc flags. |
| **ReadinessEvaluation** as append-only history | Valuable for audit and AI; “snapshot” pattern is correct for *what happened when*. |
| **ActivityLog** | Core audit backbone; `source` + `data` JSON is acceptable for variable payloads. |
| **AutomationRule / AutomationRun** | Right placeholders; string `trigger` + `graphJson` matches phased engine maturity. |
| **Pipeline / PipelineStage** | Must remain the canonical stage model for deal progression gates. |

### 1.2 What is risky or too simplified

| Area | Risk |
|------|------|
| **DealContract 1:1 + single `version` int** | Cannot represent **immutable version history**, parallel signature attempts, or “which version was signed” without ambiguity. `content` mutations overwrite interpretive history unless you never update in place (today you likely do). |
| **`signedPdfUrl` + `diiaSessionId` on root only** | Conflates **legal artifact** (signed PDF) with **provider session** (ephemeral). Multiple sessions / resends / supersession are not modeled. |
| **FileAsset scoped only to `dealId`** | Attachments can target `LEAD`, but `FileAsset` cannot own lead-scoped logical files without faking `dealId` or duplicating patterns. |
| **No explicit link Attachment ↔ ContractVersion** | Contract PDFs (draft/signed) are indistinguishable from “random CONTRACT category file” except by convention. |
| **URL-only storage (`fileUrl`)** | No `contentHash`, virus scan, storage key, or size guarantees at scale; dedupe and integrity are weak. |
| **Readiness as only `checksJson` snapshots** | Rules are **code-defined** today; product cannot reconfigure gates per pipeline/template without deploy. Overrides/approvals are not first-class. |
| **PermissionKey granularity** | Module-level only (`*_VIEW`, `SETTINGS_VIEW`) — cannot enforce “send for signature” vs “view signed PDF” separately. |
| **ActivityEntityType excludes CONTRACT** | Contract/signature events must piggyback `DEAL`; reporting and ACL filters become noisy. |

### 1.3 What will break at scale

1. **Contract edits after “sent”** without version rows → audit and litigation exposure.  
2. **Concurrent uploads** to same `FileAsset` without DB constraint on `isCurrentVersion` (partial unique index recommended).  
3. **Orphan Attachment** rows when `fileAssetId` null and entity deleted — need soft-delete or cascade policy per entity.  
4. **Automation** with only `SKIPPED` runs — ops will bypass CRM with email/WhatsApp (“shadow processes”).  
5. **JSON-only payment/handoff truth** split across `workspaceMeta`, `DealHandoff.manifestJson`, and attachments — inconsistent “source of truth” for readiness.

### 1.4 Entities that should remain

`User`, `Deal`, `Lead`, `Contact`, `Client`, `Pipeline`, `PipelineStage`, `DealStageHistory`, `Order`, `CalendarEvent`, `Permission`, `PermissionOnUser`, `ActivityLog`, `Attachment` (evolve), `FileAsset` (evolve), `DealHandoff` (evolve), `ReadinessEvaluation` (keep as history), `AutomationRule` / `AutomationRun` (evolve).

### 1.5 Entities that should split or expand

| Current | Change |
|---------|--------|
| **DealContract** | Becomes **contract root** (stable id per deal *or* per deal negotiation thread) + **`DealContractVersion`** (immutable rows). |
| **FileAsset** | **v1:** stay **deal-only**; lead files stay **`Attachment` polymorphic** (see §2.1). **Later:** optional `LeadFileAsset` / neutral `Document` if product requires. |
| **Attachment** | Remain **physical version** table; add nullable FKs to **`DealContractVersion`** and **`SignatureRequest`** (not a parallel artifact table). |

### 1.6 Fields to move out of JSON blobs (relational)

| Today | Move to |
|-------|---------|
| **`DealContract.content`** | Keep JSON for *flexible editor graph*, but add: `contractVersionId`, `variablesResolved` snapshot hash, `approvalStatus`, `submittedForSignatureAt`, `fullySignedAt` on **version** row; clause toggles as rows if legal requires diff-by-clause. |
| **`Deal.workspaceMeta.payment`** | **`DealPaymentMilestone`** or `PaymentProofRequirement` rows linked to Deal (amount, due, confirmedAt, confirmedBy, attachmentId). |
| **`DealHandoff.manifestJson`** | Prefer **`HandoffManifestItem`** rows (key, required, done, linkedDocumentId) *or* versioned JSON + hash on `DealHandoff` with strict schema validation. |
| **Readiness rules** | **`ReadinessRuleSet`** + **`ReadinessRule`** (`ruleKey` aligned to `evaluateReadiness` check ids; optional `pipelineId` / `stageId` / `templateKey`; **no** free-form expression engine in v1). |

### 1.7 Acceptable as JSON snapshots (with rules)

| Blob | OK if… |
|------|--------|
| **`ReadinessEvaluation.checksJson`** | Append-only; never edited; used for history/AI; **current** gate reads from rules engine + live data. |
| **`ActivityLog.data`** | Event-specific payload; schema per `ActivityType` documented. |
| **`AutomationRule.graphJson`** | Until visual editor ships; version the rule definition. |
| **`DealContract.content` (draft)** | While **version row** is immutable after publish/send; new edits = **new version**. |

### 1.8 Focus: DealContract, Attachment, FileAsset, ReadinessEvaluation, workspaceMeta, Permission, Automation

- **DealContract:** strong statuses, weak **versioning** and **signature** modeling.  
- **Attachment / FileAsset:** good skeleton; missing **integrity**, **source**, **contract link**, **lead-level** logical container parity.  
- **ReadinessEvaluation:** good **audit**; missing **configurable rules** and **override** workflow.  
- **workspaceMeta:** good **UX cache**; should not be sole source for payment/handoff **compliance**.  
- **PermissionKey:** must gain **document/contract/signature/handoff/readiness** atoms (or ABAC layer).  
- **AutomationRule:** keep **`trigger` string** for backward compatibility; **document a canonical subset** of values and map new code to it; optional **`DomainEvent`** log later — **do not** force a Prisma enum migration on existing `AutomationRule` rows in v1.

---

## SECTION 2 — TARGET FILE ARCHITECTURE

### 2.1 Decision: Attachment vs FileAsset

| Layer | Recommendation |
|-------|------------------|
| **Logical container (migratable v1)** | **`FileAsset` stays deal-scoped** (`dealId` **required** today). **Do not** add `leadId` to `FileAsset` in the first migration wave — it forces nullable `dealId` or fake deals and breaks the existing `Deal → FileAsset` relation. **Asymmetry (explicit):** lead-stage files remain **`Attachment` only** with `entityType=LEAD`, `entityId=leadId`, `fileAssetId=null`. Optional **Phase 3**: `LeadFileAsset` or neutral `Document` if product demands parity. |
| **Physical version** | **`Attachment` remains the version table** (`version`, `isCurrentVersion`, blob metadata). UX label “версія”; DB name unchanged. |
| **New linkage (concrete, no duplicate “artifact” entity)** | Add nullable **`dealContractVersionId`** → `DealContractVersion` for generated draft PDFs / rendered previews. Add nullable **`signatureRequestId`** → `SignatureRequest` for files produced by a signature flow. **Do not** introduce both `SignatureArtifact` and `Attachment` as parallel blob stores — **signed PDF = `Attachment` row** (e.g. `category=CONTRACT`, `source=SIGNATURE_OUTPUT`) referenced from `SignatureRequest.completedAttachmentId`. **No `AttachmentLink` table in v1** — add only if a later case requires one file version under two contracts (rare). |

**Polymorphic `entityId` (schema truth):** for **`AttachmentEntityType.HANDOFF`**, `entityId` **must** be **`DealHandoff.id`** (there is no separate `Handoff` table). Same pattern for `LEAD` / `DEAL` / `ORDER` / `EVENT` / `TASK` with their respective primary keys.

### 2.2 Category rules configuration

Add **`AttachmentCategoryPolicy`** (one row per `AttachmentCategory` or per category×pipeline):

- `category` → existing enum (FK via raw column + app validation, or small lookup table mirroring enum)  
- `allowedEntityTypes` → **child table** `AttachmentCategoryPolicyEntityType (policyId, entityType)` — Prisma has no native `enum[]` without PostgreSQL array type + migration pain; **avoid undocumented “array in JSON”** for ACL.  
- `readinessImpact` (NONE / SOFT / HARD)  
- `requiresValidation` bool  
- **Who may upload** → **`AttachmentCategoryPolicyPermission (policyId, permissionId)`** joining to existing `Permission` rows (after new keys exist) — **not** a vague “role set” string.

Keeps existing `AttachmentCategory` enum; policy **extends** behavior.

### 2.3 New / changed tables (files)

| Action | Table / change |
|--------|----------------|
| **Keep** | `Attachment`, `FileAsset` |
| **Add columns** | `Attachment`: `source` enum (`MANUAL`, `GENERATED`, `INBOX_IMPORT`, `SYSTEM`, `SIGNATURE_OUTPUT`), `contentHash`, `storageKey` (nullable while URL-era), `virusScanStatus`, `validatedAt`, `validatedById`, `supersededByAttachmentId` optional; **`dealContractVersionId`**, **`signatureRequestId`** (nullable FKs, `onDelete SetNull`) |
| **Defer** | `FileAsset.leadId` / generic `Document` — **post–v1** epic (see §11). |
| **Add** | `DealDocumentRequirement` — `dealId`, `category`, `minCount`, optional `pipelineStageId`, optional `templateKey` string (matches today’s `DealContract.templateKey` pattern before `ContractTemplate` table exists). |
| **Constraint** | **Partial unique index** (PostgreSQL): at most one current version per `fileAssetId` **where `fileAssetId IS NOT NULL AND "isCurrentVersion" = true`**. Legacy rows with `fileAssetId=null` are **excluded** — otherwise migration breaks existing data. |

### 2.4 UI flows (exact)

| Upload surface | Categorization | Auto-link |
|----------------|----------------|-----------|
| **Deal Workspace → Files tab** | Default category from tab/section; user override if permitted | `entityType=DEAL`, `entityId=dealId`; create/update `FileAsset` |
| **Measurement / Proposal / Contract subtabs** | Force category default (`MEASUREMENT_SHEET`, `QUOTE_PDF`, `CONTRACT`) | Same + link to `contractVersionId` when generating contract PDF |
| **Drag-drop on workspace shell** | Modal if ambiguous | Same as Files |
| **Inbox (Telegram)** | AI suggestion + user confirm | **`AttachmentEntityType` has no `MESSAGE` today.** Migratable options: **(A)** extend enum with `CONVERSATION` or `INBOUND_MESSAGE` + `entityId=threadId` (requires Prisma migration + backfill strategy); **(B)** v1: store thread metadata only in `ActivityLog` / inbox table and create `Attachment` only **after** user binds `entityType=DEAL` or `LEAD`. Document chosen path in ADR; do not reference a non-existent enum value. |
| **System generate** | Set by generator | `source=GENERATED`; immutable version row after publish |

### 2.5 Workspace display

- **Grouped by category** (primary), secondary filter by **stage relevance**.  
- **Required strip** from **`DealDocumentRequirement`** evaluation.  
- **Missing**: synthetic rows (not DB Attachment).  
- **Outdated**: `isCurrentVersion=false` with banner “Активна: vN”.  
- **Badges**: map from `source` + `category` + links: manual / generated / inbox / signed artifact / replaced version.

### 2.6 Signed contract replacing draft

- **Draft PDF** = `Attachment` with `dealContractVersionId` set, `source=GENERATED` or `MANUAL`, `category=CONTRACT` (existing enum — **no new `SIGNED_CONTRACT` required in v1** if `source` distinguishes).  
- **Signed PDF** = new `Attachment`, `source=SIGNATURE_OUTPUT`, `signatureRequestId` set, `category=CONTRACT`; **`DealContractVersion.fullySignedAt`** + pointer **`signedPdfAttachmentId`** on version (or on root during transition). Draft PDF attachment rows become **immutable by app rule** (not DB trigger required in v1). **Do not** rely on two simultaneous `isCurrentVersion=true` on the same `FileAsset` for draft vs signed — use **separate `FileAsset` rows** (e.g. `displayName` “Договір (чернетка PDF)” vs “Договір (підписаний)”) or a **`purpose` enum on FileAsset** in a later phase; v1 minimum: distinguish via `Attachment.source` + link to version/request.

---

## SECTION 3 — TARGET CONTRACT ARCHITECTURE

### 3.1 Should DealContract remain the root?

**Yes**, as **`DealContract` = negotiation root** (1:1 with Deal is acceptable *if* every legal change flows through **version rows**). Alternative: 1:1 Deal ↔ `ContractCase` when multiple concurrent negotiations — YAGNI unless business demands.

### 3.2 Add DealContractVersion?

**Yes — required** for production lifecycle.

**`DealContract`** (root) — **migration rule: keep all existing columns** (`status`, `version`, `templateKey`, `content`, `signedPdfUrl`, `diiaSessionId`, …) **through Phase 1–2** so existing REST/UI/API does not break. Add nullable: **`currentVersionId`** → `DealContractVersion` (the row that mirrors “what API used to mean”).  
**`DealContractVersion`**: `id`, `contractId` FK → `DealContract`, `revision` int (monotonic per contract), **`lifecycleStatus` reuses `DealContractStatus`** (same enum — avoids a second open-ended enum and keeps queries simple), `templateKey`, `content` Json, `contentHash`, `renderedPdfAttachmentId`, `signedPdfAttachmentId`, `approvalStatus` enum/string, `approvedById`, `approvedAt`, `sentForSignatureAt`, `fullySignedAt`, `supersedesVersionId`, `createdById`, `createdAt`.

**Status invariant (corrected):** **`DealContract.status` + `DealContract.version` remain denormalized caches** updated in the same transaction as the pointed `DealContractVersion` row until all callers read versions explicitly. **Do not** claim “version-only authority” until consumers are migrated — otherwise race conditions and stale dashboards. Target end-state: root = pointers + cache; version = audit truth.

### 3.3 Fields: root vs version

| On root | On version |
|---------|------------|
| `dealId` | `revision`, `content`, `contentHash` |
| Pointers to active versions | `renderedPdfAttachmentId`, approval timestamps |
| Optional denormalized `status` for dashboards | `templateKey` at generation time |
| | `SUPERSEDED`, `DECLINED`, `EXPIRED` per attempt |

### 3.4 Stop living only in content JSON

Promote to columns or side tables:

- **Approval**: `approvalStatus`, `approvedById`, `approvedAt`  
- **Signature linkage**: not `diiaSessionId` here — FK to **`SignatureRequest`**  
- **Variable values** used for PDF: snapshot JSON **on version** + hash  
- **Clause set**: either `ContractClauseInstance` rows or frozen JSON with schema validation

### 3.5 signedPdfUrl

**Deprecate as single source**; replace with **`Attachment` id** on version (`signedPdfAttachmentId`) and/or **`SignatureRequest.completedAttachmentId`**. Keep `signedPdfUrl` nullable during migration for backfill pointer.

### 3.6 templateKey evolution

- **Migratable order:** keep **`templateKey` string** on `DealContractVersion` (copy of today’s field) for **Phase 1**. Add **`ContractTemplate`** table only when editor/admin needs referential templates — then optional `templateId` FK. **Premature `ContractTemplate` before versioning** was a sequencing error in v1.0 of this doc.

### 3.7 Contract blocks/clauses

- **`ContractClause`** library table  
- **`DealContractVersionClause`**: versionId, clauseId, included, sortOrder, overriddenText nullable (legal controlled)

### 3.8 Lifecycle, approval, roles, workspace UI

- **States**: align with existing enum; add **per-version** `DECLINED`/`EXPIRED` without poisoning whole DealContract.  
- **Edit**: Sales until `PENDING_INTERNAL_APPROVAL` / `SENT` per policy; Legal always on locked blocks.  
- **Approve**: users with `contract.approve.internal`.  
- **Send**: `contract.send.signature` + approval satisfied.  
- **Workspace Contract tab**: left editor / right preview; header **“Версія N · Статус · Активна для підпису”**; list of prior versions read-only.

---

## SECTION 4 — TARGET SIGNATURE ARCHITECTURE (DIIA)

### 4.1 Beyond `diiaSessionId`

Add:

| Entity | Purpose |
|--------|---------|
| **`SignatureRequest`** | One send attempt for a specific `DealContractVersion`; fields: `provider` (e.g. DIIA), `providerRequestId` unique nullable, `status`, `expiresAt`, **`completedAttachmentId`** → `Attachment` (signed PDF), **`legacyDiiaSessionId`** nullable to absorb `DealContract.diiaSessionId` during migration |
| **`SignatureSigner`** | Company / client / order; status, viewedAt, signedAt, `externalRef` Json |
| **`SignatureProviderEvent`** | Append-only webhook/callback log (`providerEventId` **unique**, raw payload Json) |

**Removed from target (v1.1):** separate **`SignatureArtifact`** table — it duplicated `Attachment` and split audit. **Signed file is always `Attachment`.**

`DealContract` keeps **`diiaSessionId`** nullable until all traffic uses `SignatureRequest`; then drop in a later migration. **`activeSignatureRequestId`** optional on root or version — not both without invariant doc; **pick one FK location** (recommend: `DealContractVersion.activeSignatureRequestId`).

### 4.2 Behaviors

- **Sequence rules** on `SignatureRequest` (`SEQUENTIAL` / `PARALLEL`)  
- **Partial signing** → version stays `CLIENT_SIGNED` etc. until **fully_signed**  
- **Expiration / decline** → new `SignatureRequest` on **same or new version** (policy-driven)  
- **Resend** = new signer row or new request; never overwrite prior events  
- **Replace contract** = new `DealContractVersion` + cancel open requests (event logged)

### 4.3 Workspace UX

- **Status panel**: per signer stepper  
- **Resend**: button with reason + audit  
- **Replace**: wizard explains impact on signature  
- **“Version in signature”** banner tied to `SignatureRequest.contractVersionId`  
- **Active legal document** card = latest **fully signed** artifact; drafts collapsed

### 4.4 Diia as embedded flow

Deep link return → poll/webhook reconciliation → update `SignatureSigner` → on complete create **Artifact** + update version timestamps + emit `signature.completed`.

---

## SECTION 5 — TARGET READINESS ARCHITECTURE

### 5.1 Snapshots vs normalized

| Component | Role |
|-----------|------|
| **`ReadinessEvaluation`** | **Keep** as append-only snapshot (what was computed when). |
| **`ReadinessRuleSet` + `ReadinessRule`** | **Add**, but **v1 must not be a generic “expression engine”.** Use **`ruleKey` string** aligned to existing code checks (`contract_signed`, `prepayment`, `measurement`, `technical_files`, `handoff_package`, … — same ids as in `evaluateReadiness` today) plus `pipelineId` / optional `stageId` / optional `sortOrder` / `hardBlock` bool. **Migratable:** seed one `ReadinessRuleSet` per deal pipeline that mirrors current TypeScript logic; evaluator reads table **or** falls back to code if row missing. |
| **`ReadinessOverride`** | **Add** — `dealId`, `ruleKey`, `reason`, `requestedById`, `approvedById`, `expiresAt` optional — **no FK to numeric rule id until rules stable** |

### 5.2 Source of truth per item

| Item | Source | Derived / manual |
|------|--------|------------------|
| Measurement | `workspaceMeta.measurementComplete` **or** validated Measurement attachment | hybrid: attachment truth overrides flag |
| Proposal | `workspaceMeta.proposalSent` + optional `QUOTE_PDF` requirement | derived |
| Contract signed | `DealContractVersion.status` / artifact | derived |
| Payment proof | relational milestones + `PAYMENT_CONFIRMATION` attachments | derived + manual confirm |
| Required files | `DocumentRequirement` vs current attachments | derived |
| Handoff | `DealHandoff.status` + manifest | hybrid |
| Approvals | contract approval columns | derived |

### 5.3 Override & UI

- **Who overrides**: Ops with `readiness.override.request`; **approve**: Manager/Legal with `readiness.override.approve`.  
- **Blocked state**: sticky bar “Виробництво заблоковано: …” with expandable reasons + deep links.  
- **Prevent launch**: API + UI disable on Handoff submit / production flag; server-side enforcement on any “production release” mutation.

---

## SECTION 6 — PERMISSIONS AND ACCESS MODEL

### 6.1 Why current PermissionKey is insufficient

`LEADS_VIEW` cannot express **download signed PDF** vs **view metadata**; **no separation** of duties for signature send vs contract edit.

### 6.2 Granular keys (recommended)

**Contract:** `contract.view`, `contract.create`, `contract.edit`, `contract.approve.internal`, `contract.send.signature`, `contract.cancel.signature`, `contract.view.signature.status`, `contract.export.signed`  

**Files:** `deal.file.upload`, `deal.file.replace`, `deal.file.delete`, `deal.file.validate`, `deal.file.lock`, `deal.file.export`  

**Handoff:** `handoff.submit`, `handoff.accept`, `handoff.reject`  

**Readiness:** `readiness.override.request`, `readiness.override.approve`  

**Production:** `production.release`, `production.release.block` (admin)  

**Automation:** `automation.manage`  

**AI:** `ai.action.approve` (if AI proposes mutations)

**Migratable path (corrected):** Prisma **`PermissionKey` is a closed enum** — every new key needs a generated migration and touches all seeds. **v1 recommendation:** add **only the minimum new enum values** you will actually enforce in API this quarter; **or** introduce parallel **`PermissionString` / `FineGrainedPermission` table** with `key String @unique` and migrate `PermissionOnUser`-style M:N without expanding `PermissionKey` yet. **Risk called out:** new keys in DB **do nothing** until NextAuth / route guards read them — document engineering task explicitly. **Do not** list 20 new keys without a rollout plan.

### 6.3 Roles mapping (example)

| Permission | Admin | Manager | Sales | Operations | Viewer |
|------------|:-----:|:-------:|:-----:|:----------:|:------:|
| contract.* (full) | ✓ | partial | edit draft | view | view |
| send signature | ✓ | ✓ | ✗ | ✗ | ✗ |
| file.upload | ✓ | ✓ | ✓ | ✓ | ✗ |
| file.delete | ✓ | ✓ | own? | ✗ | ✗ |
| handoff.accept | ✓ | ✓ | ✗ | ✓ | ✗ |
| readiness override approve | ✓ | ✓ | ✗ | ✗ | ✗ |
| production.release | ✓ | ✓ | ✗ | ✓ | ✗ |

(Fine-tune per tenant.)

---

## SECTION 7 — UI / UX (DEAL WORKSPACE)

### 7.1 Contract tab

- **Header**: version selector, status chip, “Активна для підпису” vs “Чернетка”.  
- **Blocks**: editor + preview; variables panel; approval panel; signature panel (embedded status).  
- **Warnings**: edit blocked when sent; mismatch deal value vs contract variables.

### 7.2 Files tab

- **Layout**: required strip → category sections → inbox unlinked (if any).  
- **Row**: name, version, badges (source), linked contract icon.  
- **Preview**: drawer PDF/image.  
- **Empty**: CTA upload per missing requirement.

### 7.3 Payment tab

- Milestone list with **attach proof** action; validation state.

### 7.4 Handoff tab

- Checklist from manifest rows; link to files; submit disabled with reasons.

### 7.5 Right sidebar

- **Document state** summary; **readiness** X/Y; **signature** progress; **next action** one-liner.

### 7.6 Sticky action bar

Context actions: **Upload proof**, **Request approval**, **Send to Diia**, **Open signed PDF**, **Submit handoff** — each gated by permissions + readiness.

---

## SECTION 8 — AUTOMATIONS AND DOMAIN EVENTS

### 8.1 Events (≥20)

1. `file.uploaded`  
2. `file.replaced`  
3. `file.validated`  
4. `file.quarantined`  
5. `file.required.missing`  
6. `file.required.satisfied`  
7. `contract.version.created`  
8. `contract.content.updated`  
9. `contract.approved.internal`  
10. `contract.sent.signature`  
11. `contract.signature.viewed`  
12. `contract.signature.partial`  
13. `contract.signature.completed`  
14. `contract.signature.declined`  
15. `contract.signature.expired`  
16. `contract.version.superseded`  
17. `readiness.evaluated`  
18. `readiness.blocked`  
19. `readiness.passed`  
20. `readiness.override.applied`  
21. `handoff.submitted`  
22. `handoff.accepted`  
23. `handoff.rejected`  
24. `production.release.blocked`  
25. `production.release.allowed`  

### 8.2 Automations (≥20) — trigger / condition / action / failure / UI

| # | Trigger | Condition | Action | Failure | UI |
|---|---------|-----------|--------|---------|-----|
| 1 | `file.required.missing` | stage ≥ payment | create task | log run FAILED | task link in deal |
| 2 | `contract.sent.signature` | — | notify client channel | retry 3× | banner “не надіслано” |
| 3 | `contract.signature.completed` | — | link **`Attachment`** (`completedAttachmentId`) + refresh readiness | alert admin | success toast |
| 4 | `contract.signature.expired` | — | notify sales + task | — | CTA “нова сесія” |
| 5 | `readiness.blocked` | handoff attempted | block API + message | — | inline blockers |
| 6 | `file.uploaded` | category=DRAWING | notify production | — | activity |
| 7 | `contract.approved.internal` | — | enable send button cache | — | — |
| 8 | `handoff.submitted` | readiness not passed | reject submit (server) | — | error |
| 9 | `readiness.passed` | — | post to Slack | silent fail | optional |
| 10 | `file.quarantined` | — | lock download | — | red badge |
| 11 | `contract.version.superseded` | — | archive old PDF links | — | history |
| 12 | `payment.proof.attached` | — | recalc readiness | — | checkmark |
| 13 | `signature.partial` | timeout SLA | remind signer | — | email log |
| 14 | `handoff.rejected` | — | task sales | — | activity |
| 15 | `production.release.blocked` | — | dashboard widget | — | ops queue |
| 16 | `file.replaced` | production started | change-order draft | — | warning |
| 17 | `ai.action.proposed` | — | hold for approval | — | panel |
| 18 | `contract.signature.declined` | — | notify + freeze version | — | banner |
| 19 | `readiness.override.applied` | — | log + notify compliance | — | audit |
| 20 | `automation.run.failed` | — | incident ticket | — | admin |

*(Extend similarly; treat trigger strings as a **documented vocabulary** aligned with domain events — **no** forced DB enum swap for existing `AutomationRule` rows in v1.)*

---

## SECTION 9 — MIGRATION PLAN (FROM CURRENT SCHEMA)

### 9.1 Unchanged (initially)

`User`, `Lead`, `Contact`, `Client`, `Pipeline`, `PipelineStage`, `DealStageHistory`, `Order`, `CalendarEvent`, `ReadinessEvaluation` (append-only, unchanged shape), most of `ActivityLog`.

### 9.2 Phased migration (corrected — avoids non-migratable “big bang”)

| Phase | DB | App behaviour |
|-------|-----|----------------|
| **0** | Add nullable FK columns only (`Attachment.dealContractVersionId`, `DealContract.currentVersionId`, etc.); create empty new tables | No behaviour change; deploy safe |
| **1** | Backfill: for each `DealContract`, insert **one** `DealContractVersion` copying `content`, `templateKey`, `lifecycleStatus=status`, `revision = version` (or `1` if inconsistent) | Dual-write: every PATCH contract updates **both** root and `currentVersionId` row |
| **2** | Add `SignatureRequest` / `SignatureSigner` / `SignatureProviderEvent`; copy `diiaSessionId` into **latest open or last** request row | New signature flows write here; legacy field mirrored |
| **3** | `DealDocumentRequirement` + optional `ReadinessRuleSet` seeded from current code | Readiness evaluator reads rules when present |
| **4** | Read APIs switch to version as source; root fields become read-only cache | Feature flag |
| **5** | Drop `DealContract.content` / `diiaSessionId` **only after** telemetry shows zero reads | Requires search repo for field usage |

### 9.3 Additive vs refactor

- **Additive (Phases 0–3):** new tables and nullable columns as above.  
- **Refactor (Phases 4–5):** narrowing root `DealContract` — **never** in Phase 1.

### 9.4 Attachment / FileAsset backfill caveats

- Rows with **`fileAssetId=null`** exist; partial unique index **must** exclude them.  
- **`signedPdfUrl`**: creating stub `Attachment` without byte copy **does not** prove integrity — record `fileUrl` = old URL, `source=SIGNATURE_OUTPUT` after human validation or re-download job.

### 9.5 Rollout

- Feature flags per phase; **rollback = stop writing new tables**, not delete rows.  
- Shadow readiness: compare `checksJson` from old evaluator vs rule-driven (optional column `ruleSetVersion` on `ReadinessEvaluation` later).

---

## SECTION 10 — FINAL RECOMMENDATIONS

### A. File architecture (final)

**`FileAsset`** = deal-scoped logical document (**v1**). **`Attachment`** = version row + **`source`** + FK **`dealContractVersionId`** / **`signatureRequestId`**; signed PDF is **an `Attachment`**, not a parallel blob table. **`DealDocumentRequirement`** + **`AttachmentCategoryPolicy`** (+ join tables for entity types and permissions).

### B. Contract architecture (final)

**`DealContract`** root (**columns retained through migration**) + **`DealContractVersion`** rows; **`currentVersionId`** pointer; root **`status`/`version`** = cache until Phase 4+. **`ContractTemplate` table** deferred until after versioning ships. PDF = **`Attachment`** linked to version.

### C. Signature architecture (final)

**`SignatureRequest`** (`completedAttachmentId` → `Attachment`) + **`SignatureSigner`** + **`SignatureProviderEvent`**; absorb **`diiaSessionId`** then drop. **No `SignatureArtifact` table.**

### D. Readiness architecture (final)

**Rules** normalized; **evaluation** snapshot stays; **overrides** explicit; **workspaceMeta** flags become secondary to relational/check-derived truth where compliance matters.

### E. Permissions (final)

Split **module view** from **document/signature** actions; add handoff/readiness/production keys; map to roles.

### F. Workspace UX (final)

Single deal hub: **Contract** (version-aware), **Files** (requirement-aware), **Payment** (proof-aware), **Handoff** (manifest-aware), **sidebar** aggregates blockers.

### G. Top 15 implementation modules (order)

1. Phase 0 nullable FKs + `DealContractVersion` table (empty + backfill script)  
2. Dual-write contract PATCH (root + version) + `currentVersionId`  
3. Attachment: `source`, `dealContractVersionId`, `signatureRequestId`; partial unique index (**`fileAssetId IS NOT NULL`**)  
4. `SignatureRequest` / `SignatureSigner` / `SignatureProviderEvent` + mirror `diiaSessionId`  
5. Wire signed PDF to `Attachment` + `completedAttachmentId`  
6. `DealDocumentRequirement` + UI required strip  
7. `ReadinessRuleSet` keyed by **`ruleKey` strings** matching `evaluateReadiness` + evaluator fallback  
8. Minimum viable **permission** keys **actually enforced** in API + auth layer audit  
9. Workspace contract header (version + cache status)  
10. Diia webhook + idempotency on `SignatureProviderEvent`  
11. **Defer** `ActivityEntityType.CONTRACT` until high ROI (each switch on `entityType` must migrate)  
12. `AutomationRule.trigger` **documented string vocabulary** + optional `DomainEvent` log  
13. Payment milestones table (extract from `workspaceMeta`)  
14. Handoff manifest: validated Json + optional rows later  
15. `AttachmentCategoryPolicy` + join tables; **defer** `ContractTemplate` admin UI  

### H. Top 15 risks to avoid

1. Mutating `DealContract.content` in place after send  
2. Letting `signedPdfUrl` be the only legal record  
3. No partial unique constraint → two “current” versions  
4. Readiness only in JSON with no override audit  
5. Coarse permissions → signature fraud / data leak  
6. Skipping webhook idempotency  
7. Losing history on template change without version bump  
8. File URL without integrity hash  
9. Handoff submit allowed when server readiness fails  
10. Automation silent failures  
11. CONTRACT events lost inside DEAL activity noise  
12. Lead files without logical container parity  
13. Large enum PermissionKey without migration strategy  
14. **Breaking** 1:1 DealContract without data migration  
15. UI showing “signed” without verified artifact link  
16. **Wrong partial unique index** (including `fileAssetId=null` rows) → migration fails or unique violations in prod  

---

## SECTION 11 — SELF-CRITIQUE (v1.0 design vs current schema) & corrections applied

This section records where the **original v1.0 text** was too generic, too risky, or **not directly migratable** from `schema.prisma`, and how **v1.1** fixes it.

| Issue | Why it was weak | Correction in v1.1 |
|-------|-----------------|---------------------|
| **`FileAsset.leadId` / generic `Document`** | Current `FileAsset.dealId` is **required** with FK to `Deal`. Nullable `dealId` + `leadId` implies complex invariants and orphan risks. | **v1:** deal-only `FileAsset`; lead files = **`Attachment` + `entityType=LEAD`** only. |
| **`linkedSignatureArtifactId` + `SignatureArtifact`** | Introduces a **second blob model** beside `Attachment`, doubling migration and sync logic. | **Single `Attachment`**; `SignatureRequest.completedAttachmentId` + `Attachment.source=SIGNATURE_OUTPUT`. |
| **`AttachmentEntityType=MESSAGE` in UI table** | Enum **does not exist** in schema (`LEAD`, `CONTACT`, `CLIENT`, `DEAL`, `ORDER`, `HANDOFF`, `EVENT`, `TASK`). | Document **ADR options A/B**; no phantom enum. |
| **`AttachmentCategoryPolicy.allowedEntityTypes[]` / whoCanUpload “role set”** | Prisma has no clean “array of enums + roles” without **PostgreSQL enum[]** or join tables; text was hand-wavy. | **`AttachmentCategoryPolicyEntityType`** + **`AttachmentCategoryPolicyPermission`** join tables. |
| **Partial unique `isCurrentVersion` without `WHERE fileAssetId IS NOT NULL`** | Many `Attachment` rows have **`fileAssetId=null`** (pre–FileAsset era and lead files). | Index predicate **must** exclude null `fileAssetId`. |
| **“Version is authoritative; root status discarded”** | Existing API/UI reads **`DealContract.status`, `content`, `version`** today. Immediate authority flip **breaks consumers** without a phased read switch. | **Dual-write + cache** on root through Phase 4; **Phase 5** column drops only after telemetry. |
| **`ContractTemplate` before `DealContractVersion`** | Versions still need `templateKey` string from legacy row; template admin is **not** on critical path. | **Defer `ContractTemplate` table** until after versioning backfill. |
| **`ReadinessRule` with free “expression”** | No runtime engine exists; risk of undeliverable product. | **`ruleKey` aligned to `evaluateReadiness`** ids + seeded rows + code fallback. |
| **Long list of new `PermissionKey` values** | Enum expansion + seed + **no mention that auth ignores them today** | **Minimum keys + wire auth**, or parallel string permission table; explicit engineering dependency. |
| **`ActivityEntityType.CONTRACT` “optional”** | Prisma enum migration + **every** `switch (entityType)` in codebase. | Mark **defer**; stay `DEAL` + `data.contractVersionId` in `ActivityLog.data` until justified. |
| **Migration §9 “move content to version; root pointers only” in one step** | Would break running app between deploy and code deploy order. | **Phase table 0–5** with nullable columns first and explicit dual-write. |
| **Signed PDF stub `Attachment` from URL** | Legal integrity not proven; looked like full migration. | Note **integrity gap**; optional re-fetch/hash job. |
| **`HANDOFF` attachment target** | Schema has `AttachmentEntityType.HANDOFF` but no separate `Handoff` entity — **`DealHandoff.id`** must be `entityId`. | **§2.1** states **`entityId` = `DealHandoff.id`** explicitly. |
| **`AutomationRule` “replace string with enum”** | Existing rows use free `trigger` string; blind enum breaks data. | Keep string; **documented subset** + optional `DomainEvent` log later — no forced enum migration in v1. |
| **`@@unique([category, pipelineId])` / `@@unique([ruleSetId, ruleKey, stageId])`** | PostgreSQL UNIQUE treats **each `NULL` as distinct** → duplicate global policy rows and duplicate “all stages” rules. | **Drop** misleading Prisma uniques; enforce via **`prisma/sql/partial_uniques.sql`**. |
| **`ReadinessOverride` unique `(dealId, ruleKey)`** | Blocks **PENDING → APPROVED** workflow and audit history. | **`ReadinessOverrideStatus`** + **`approvedAt`**; index `(dealId, ruleKey, status)`; at most one active `APPROVED` in **service** (optional partial unique later). |
| **Missing payment / outbox tables** | Readiness + automation cite milestones and events; only JSON existed. | **`DealPaymentMilestone`**, **`DomainEvent`** (`dedupeKey`) added to schema. |
| **`ContractApproval` without step guard** | Duplicate `stepOrder` per version → ambiguous approval graph. | **`@@unique([contractVersionId, stepOrder])`**. |
| **`SignatureSigner` `(request, sortOrder)` unique** | **PARALLEL** Diia flows often use **same `sortOrder`** for multiple signers. | **No** DB unique on `(signatureRequestId, sortOrder)` — enforce in app if needed. |
| **`Attachment` hard delete** | Breaks FK history from contract version / signature. | **`deletedAt`** soft-delete; partial unique on “current” excludes deleted rows (see SQL file). |
| **`DealContractVersion` no `updatedAt`** | Weak audit for non-content mutations. | **`updatedAt`** added. |
| **Granular `PermissionKey` absent** | Architecture described keys; enum/seed had only module views. | **New enum values** + **seed** — still **must wire route guards** or they are inert. |

**Net:** v1.1 is **less encyclopedic** in places but **more shippable** and **maps to rows and migrations** you can actually run against the current database. **v1.2 (self-audit)** tightens PostgreSQL correctness, override workflow, and permission/audit primitives — see [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md).

---

**Related docs:** [CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md](./CORE_DOCUMENT_SYSTEM_ARCHITECTURE.md) (conceptual north star), [IMPLEMENTATION_STACK_MAP.md](./IMPLEMENTATION_STACK_MAP.md) (PostgreSQL → Prisma → API → UI → tasks), [ARCHITECTURE_IMPLEMENTATION_MAP.md](./ARCHITECTURE_IMPLEMENTATION_MAP.md) (PostgreSQL / Prisma / Nest / workspace UI / migration phases), [CRM_PRODUCTION_ARCHITECTURE_FULL.md](./CRM_PRODUCTION_ARCHITECTURE_FULL.md) (exhaustive §1–11 + workflows/events/risks), [DESIGN_AUDIT_AND_FIXES.md](./DESIGN_AUDIT_AND_FIXES.md) (weak points + schema/doc remediations), [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) (epics). This document **subordinates** conceptual doc to **current Prisma reality** and migration constraints.
