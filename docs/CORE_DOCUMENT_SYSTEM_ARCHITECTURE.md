# Core Document System Architecture — CRM (Deal-Centric)

**Version:** 1.0  
**Role:** Principal architecture for files, contracts, signatures, and readiness — **production-grade**, not demo.  
**Scope:** All document work is anchored in **Deal Workspace**; files are **first-class**; contracts are **structured objects** with lifecycle and audit; **Diia.Signature** is an embedded flow, not a side portal.  
**Relation to codebase:** Evolves today’s `FileAsset` + `Attachment`, `DealContract`, `AttachmentCategory`, readiness checks — toward the model below.

**Operational grounding (v1.1):** This document describes an **ideal** shape (`Document`, `document_link`, `signature_artifact_id`, early `ContractTemplate`, etc.). For **what to ship first**, **nullable FKs**, **dual-write on `DealContract`**, **no separate signature blob table** (signed PDF = `Attachment`), and **phased migration 0–5**, use **[Document Core — Schema Review & Target Redesign](./DOCUMENT_CORE_SCHEMA_REVIEW_AND_REDESIGN.md) (v1.1)** as the binding plan; reconcile this file when those phases complete.

---

## Executive summary

| Layer | Decision |
|-------|----------|
| **Files** | Logical `Document` (or `File`) + immutable `DocumentVersion` + polymorphic `DocumentLink`; category is a **controlled vocabulary** with rules per pipeline/stage. |
| **Active version** | Exactly one `isCurrent = true` per logical document; signed outputs create a **new logical doc** or a **dedicated signed artifact** linked to contract version — see §1F / §2. |
| **Contract** | `Contract` (deal-scoped) + `ContractTemplate` + `ContractVersion` (content snapshot) + optional `ContractBlock` / `ClauseInstance`; PDF is a **rendered artifact**, not the source of truth. |
| **Signature** | State machine + external `ProviderSession` (Diia); CRM owns **intent, routing, status, audit**; provider owns **cryptographic proof**. |
| **Readiness** | Declarative **requirements** (per stage/template) evaluated against **current + signed** artifacts; blocks are **visible and explainable**. |

---

# SECTION 1 — FILE SYSTEM ARCHITECTURE

## 1A. File categories (strict structure)

Categories are **stable keys** in DB (`file_category.key`). Below: purpose, allowed anchor entities, requirement class, typical ACL, readiness impact.

| `key` | Purpose | Allowed entities (link targets) | Required / optional | Typical access | Affects production readiness |
|-------|---------|----------------------------------|---------------------|----------------|------------------------------|
| `client_documents` | ID, реквізити, дозволи (якщо застосовно) | DEAL, CLIENT | Often optional until contract/compliance | Sales + Legal (view), Sales (upload) | If policy says “KYC before production” → yes |
| `measurements` | Лист заміру, скани, експорт з ПЗ | DEAL | **Required** before handoff (configurable) | Sales, Measurement role | **Yes** — блокує технічну готовність |
| `photos` | Об’єкт до/після, референси | DEAL, LEAD | Optional / required per stage | Sales, Production (view) | Sometimes (e.g. “object photo before quote”) |
| `drawings` | Креслення, DWG/PDF | DEAL | **Required** for manufacturing handoff (typical) | Sales, Engineering | **Yes** |
| `technical_specs` | Специфікації, техкарти | DEAL | Required per product line | Engineering, Production | **Yes** |
| `proposals` | КП, комерційні пропозиції | DEAL | Required before contract (often) | Sales | Indirect (stage gate) |
| `contracts` | **Чернетки/генеровані** договори (editable track) | DEAL (+ ContractVersion) | One **active draft track** per deal policy | Sales, Legal | Indirect until signed |
| `signed_contracts` | Підписані пакети (immutable) | DEAL, CONTRACT_VERSION | **Required** for payment/production gates | Sales (view), Legal (view), restricted upload | **Yes** — підпис замінює чернетку як юридичний факт |
| `payment_proofs` | Підтвердження оплат | DEAL | Required per payment policy | Finance, Sales | **Yes** for production unlock |
| `handoff_files` | Пакет передачі в виробництво | DEAL, HANDOFF_PACKAGE | Required at handoff gate | Sales, Production | **Yes** |
| `production_files` | Виробничі документи, зміни | DEAL, PRODUCTION_JOB | Internal | Production, Engineering | Traceability, not always readiness “input” |
| `installation_files` | Схеми монтажу, акти | DEAL, ORDER | Required at install/acceptance | Install team | Post-production |
| `templates` | Шаблони не прив’язані до угоди | SYSTEM_LIBRARY | N/A (admin) | Admin, Legal | No |

**Enforcement:** `file_category` rows carry `allowed_entity_types[]`, `default_required`, `readiness_weight` (0–1 or enum), `retention_class`, `pii_class`.

---

## 1B. File entity model (database)

**Principle:** separate **logical document** (business identity) from **binary version** (immutable blob).

### Core tables

**`file_category`**
- `id`, `key` (unique), `label`, `description`
- `allowed_entity_types` (jsonb or enum[])
- `default_required` (bool)
- `readiness_impact` (enum: NONE | SOFT | HARD)
- `retention_policy_id` (nullable)

**`document`** (rename from “File” in UX copy — avoid confusion with OS files; code name `Document` or keep `File` with alias “Логічний файл”)
- `id` (uuid)
- `category_id` → `file_category`
- `title` / `display_name` (user-facing)
- `deal_id` (required for deal-scoped docs; nullable only for library/templates)
- `created_by_id`, `created_at`, `updated_at`
- `source` enum: `MANUAL_UPLOAD` | `GENERATED` | `INBOX` | `SYSTEM` | `IMPORT`
- `status` enum: see lifecycle §1C (aggregated or primary state)
- `is_required` (bool, can be overridden per link)
- `metadata` (jsonb: dimensions, page count, checksum policy, etc.)

**`document_version`**
- `id` (uuid)
- `document_id` → `document`
- `version_number` (int, monotonic per document)
- `storage_key` / `blob_uri` (S3-compatible)
- `mime_type`, `byte_size`, `content_hash` (sha256)
- `uploaded_by_id`, `created_at`
- `is_current` (bool) — **at most one true** per `document_id` (DB constraint partial unique index)
- `is_signed` (bool)
- `signature_artifact_id` (nullable → link to signature outcome record)
- `preview_storage_key` (nullable)
- `virus_scan_status` enum: PENDING | CLEAN | REJECTED | SKIPPED
- `processing_status` enum: UPLOADED | PROCESSING | READY | FAILED

**`document_link`** (polymorphic many-to-many — document can appear in multiple contexts)
- `id`
- `document_id`
- `entity_type` (DEAL, CONTRACT_VERSION, HANDOFF_PACKAGE, PRODUCTION_JOB, LEAD, CLIENT, …)
- `entity_id`
- `role` enum: PRIMARY | ATTACHMENT | EXHIBIT | APPENDIX | SYSTEM_OUTPUT
- `is_required_override` (nullable bool)
- `created_at`, `created_by_id`

**`document_metadata`** (optional normalized extension)
- `document_version_id` (1:1 or 1:n for extracted pages)
- `extracted_text` (tsvector / external index)
- `page_count`, `language`, `dimensions`
- `ai_labels` (jsonb), `human_validated_at`

**Indexes:** `(document_id, is_current) WHERE is_current`; `(entity_type, entity_id)`; `(deal_id)` on `document` if denormalized for performance.

**Migration from current CRM:** `FileAsset` → `document`; `Attachment` → `document_version` + `document_link` to DEAL; `category` maps from `AttachmentCategory` → new `file_category.key`.

---

## 1C. File lifecycle (states & transitions)

**Version-level states** (primary for automation):

| State | Meaning |
|-------|---------|
| `UPLOADED` | Blob stored; metadata incomplete |
| `PROCESSING` | Virus scan, PDF normalize, thumbnail |
| `ANALYZED` | AI/metadata extraction done (or skipped) |
| `LINKED` | At least one `document_link` exists |
| `VALIDATED` | Human or rule confirmed category/correctness |
| `REQUIRED` | Marked mandatory for a gate (derived or explicit) |
| `MISSING` | **Synthetic** — not a row; UI/Requirement engine shows “missing slot” |
| `REPLACED` | Previous version superseded (`is_current = false`) |
| `ARCHIVED` | Soft-hidden from default UI; retained for audit |
| `LOCKED` | No new versions except via legal/signature workflow |

**Typical transitions**

```
UPLOADED → PROCESSING → ANALYZED → LINKED → VALIDATED
                    ↘ FAILED (retry / quarantine)
LINKED → REPLACED (on new version upload)
VALIDATED → LOCKED (on “send for signature” or admin lock)
any non-ARCHIVED → ARCHIVED (retention / user with permission)
```

**“Missing”** is modeled as **`document_requirement` not satisfied** (see §1G), not a version row.

---

## 1D. Upload flows (exact behaviour)

### 1. Workspace tab (e.g. Measurement, Files, Contract)

| Step | Behaviour |
|------|-----------|
| Pre | Tab loads **category context** + **required checklist** for current stage |
| Upload | User picks files or uses dropzone scoped to **one category** (default) |
| Categorize | Default = tab category; user can change only if RBAC allows |
| Confirm | If inbox-origin or AI confidence &lt; threshold → **confirm modal** |
| Link | Auto `document_link` to `DEAL` + optional `CONTRACT_VERSION` if on contract tab |
| Naming | `display_name` = filename; system suggests rename if duplicate in same category+deal |
| Metadata | Async: hash, size, mime, PDF page count |

### 2. Drag & drop into workspace shell

- Drop target = **“inbox tray”** or category tiles; if ambiguous → **modal: choose category** (required).
- Same pipeline as (1); **no silent default** to OTHER for manufacturing categories.

### 3. Inbox (Telegram / chat)

| Step | Behaviour |
|------|-----------|
| Ingest | Create `document_version` with `source=INBOX`, `processing_status=UPLOADED` |
| Link | Temporary link to `conversation_id`; **not** yet DEAL |
| UI | Deal workspace shows **“Unlinked inbox files (N)”** banner |
| Confirm | User selects deal + category → creates `document_link` + optional split into new `document` |

### 4. System-generated (proposal PDF, contract PDF)

- Generator creates **new `document`** category `proposals` or `contracts`, `source=GENERATED`.
- `document_version` 1 with `is_current=true`; link to `CONTRACT_VERSION` or DEAL.
- **User confirmation** optional for auto-regenerated drafts; **mandatory** if overwriting **current editable** contract draft (policy).

### 5. Bulk upload

- Wizard: **category**, **deal** (or match column), **mapping preview**.
- Each file → new `document` or append version if “match key” (e.g. same title+category) — user chooses strategy upfront.

**AI category suggestion:** runs on `PROCESSING`; suggests top-3; if auto-apply, only when confidence ≥ configured threshold and category allowed for entity.

---

## 1E. File display UI (Deal Workspace)

**Layouts**

1. **By category** (primary) — sections with headers: Required / Optional.
2. **By stage relevance** — toggle “Показати тільки релевантне до стадії”.
3. **List vs grid** — grid for images/PDF thumbs; list for metadata-heavy.
4. **Version drawer** — click row → side panel: timeline of versions, who uploaded, signatures.

**Preview:** PDF.js / native image; **watermark** on sensitive categories for non-Legal roles.

**Badges**

| Badge | Rule |
|-------|------|
| Required | From requirement engine |
| Missing | Slot empty |
| Signed | `document_version.is_signed` |
| Outdated | Newer version exists but user views old (banner) |
| Active | `is_current` |
| Used in contract | `document_link` to `CONTRACT_VERSION` |
| Used in production | link to `PRODUCTION_JOB` or handoff package |

---

## 1F. Versioning rules

| Event | Result |
|-------|--------|
| New upload same logical doc | New `document_version`, `version_number++`, previous `is_current=false` |
| Who may replace | Role `document.replace` on deal; Legal-only for `contracts` after `sent_for_signature` |
| Signed contract PDF | **New** `document` under `signed_contracts` **or** same contract with **immutable version** flagged `is_signed=true` and **lock** prior editable versions |
| Active selection | Only `is_current=true` in default views; signed artifact becomes **canonical** for legal read model |

**Rule 5 (spec):** Signed documents **override** draft for compliance UI: deal header shows **“Підписано: v3”**; draft archived or read-only.

---

## 1G. Required files logic

**`document_requirement_set`** (per pipeline, stage, or contract template):
- `id`, `pipeline_id`, `stage_id` (nullable = global), `contract_template_id` (nullable)
- `rules` jsonb: `[{ "category_key": "drawings", "min_count": 1, "hard_block": true }]`

**Evaluation**

- **HARD:** blocks stage transition + production readiness + handoff submit.
- **SOFT:** warning + task + dashboard.

**UI:** persistent **“Документи: X/Y обов’язкових”** in workspace header; expandable list of missing slots with **one-click upload** deep link.

---

## 1H. File permissions (RBAC + context)

| Action | Typical roles |
|--------|----------------|
| Upload | `deal.doc.upload` (owner team) |
| Replace version | `deal.doc.replace` |
| Delete / archive | `deal.doc.archive` (manager+); **never** hard-delete signed |
| Approve validation | `deal.doc.validate` |
| Lock | `legal.doc.lock` |
| Export / download signed | `deal.doc.export`; watermarking for non-Legal |

**ABAC:** same role, stricter rules if `pii_class=HIGH` or category `signed_contracts`.

---

## 1I. File automations (examples)

1. Inbox file + deal mention → auto-link + `document.version.linked`.  
2. Missing required drawing → `task.create` assign engineering queue.  
3. `signed_contract` uploaded → refresh readiness + optional stage suggestion.  
4. New drawing version `is_current` → notify production channel + `production.file_updated`.  
5. Virus scan REJECTED → banner + activity + block link to handoff.

---

# SECTION 2 — CONTRACT SYSTEM

## 2A. Contract data model

**`contract`** (1 active negotiation thread per deal; supersession = new contract row or new major version — pick one; below: **one row per deal** with versions)

- `id`, `deal_id` (unique)
- `template_id` → `contract_template` (nullable after first fork)
- `status` (enum §2D)
- `approval_status` enum: NOT_REQUIRED | PENDING | APPROVED | REJECTED
- `signature_status` enum: NOT_STARTED | IN_PROGRESS | COMPLETED | DECLINED | EXPIRED
- `current_editable_version_id` → `contract_version` (nullable when fully locked)
- `locked_at`, `locked_reason`
- `created_at`, `updated_at`

**`contract_template`**
- `id`, `key`, `name`, `deal_type_tags[]`, `jurisdiction`, `locale`
- `engine` enum: HTML_DOCX | CLAUSE_COMPILER | EXTERNAL
- `base_structure` (jsonb) — block graph
- `is_active`, `version` (template semver)

**`contract_version`**
- `id`, `contract_id`, `version_number` (int)
- `origin` enum: GENERATED | MANUAL_EDIT | IMPORT | AMENDMENT
- `content_snapshot` (jsonb) — variables, clause IDs, free text blocks
- `rendered_pdf_document_version_id` (nullable) → `document_version`
- `status` (aligned with contract or sub-state)
- `created_by_id`, `created_at`
- **Immutable** after `sent_for_signature` (new legal change = **new** `contract_version`)

**`contract_block`** (optional normalization)
- `id`, `contract_version_id`, `block_key`, `block_type`, `content`, `sort_order`, `is_locked`

**`contract_variable`**
- `key`, `type`, `required`, `default`, `validation_regex`, `label`

**`contract_clause`** (library)
- `id`, `clause_key`, `body`, `locale`, `legal_reviewed_at`, `is_optional`

**`contract_clause_instance`**
- `contract_version_id`, `clause_id`, `included` bool, `order`

---

## 2B. Template system

- Templates selected by **deal type** + **product line** + **jurisdiction**.  
- **Variables** bound from Deal/Client/Quote (read-only panel).  
- **Editable regions:** blocks marked `editable_by_role: SALES`.  
- **Locked regions:** boilerplate / legal — only Legal admin or clause version bump.  
- **Optional sections:** toggles in editor; must serialize into `content_snapshot` for reproducibility.

---

## 2C. Contract editor UX

- **Split view:** left structured editor (blocks + variables); right **live preview** (same render pipeline as PDF).  
- **Variable panel:** validation errors inline.  
- **Clause toggles:** with legal tooltip “юридично переглянуто 2025-03-01”.  
- **Version compare:** diff on variables + clause set + block text (not pixel PDF diff as primary).  
- **Validation panel:** missing variables, conflicting amounts vs deal `value`.  
- **Approval panel:** who must approve before “Send to signature”.

---

## 2D. Contract lifecycle

| Status | Editable content | Client-visible |
|--------|------------------|----------------|
| `draft` | Yes | No |
| `generated` | Yes | No |
| `edited` | Yes | No |
| `approved_internal` | No (until unlock) | No |
| `sent_for_signature` | **No** (except cancel flow) | Link via provider |
| `viewed` | No | Yes |
| `client_signed` | No | Yes |
| `fully_signed` | **Locked** | Yes |
| `declined` | New version branch | No |
| `expired` | New version or resend | No |
| `replaced` | Archived version chain | History only |

---

## 2E. Contract automations

- Generate → `contract_version` + `DOCUMENT` category `contracts` + event `contract.version.created`.  
- Internal approval → unlock `sent_for_signature`.  
- Fully signed → spawn `signed_contracts` document, set prior contract PDF as **superseded** in UI.  
- Replaced → `contract.status=replaced`, archive prior versions, retain audit.

---

# SECTION 3 — SIGNATURE FLOW (DIIA)

## 3A. Actors

- **Company signer** (authorized representative; may be multiple in sequence).  
- **Client signer** (contact on deal; identity verified via Diia flow).

## 3B. Signature UX (embedded CRM)

1. **Send for signature** — prerequisite: internal approval + required docs satisfied (configurable).  
2. **Signer status panel** — list: role, name, state, timestamp, reminders count.  
3. **Progress** — stepper: Підготовка → Надіслано → Переглянуто → Підписи → Завершено.  
4. **Retry / resend** — per signer; rate-limited; logged.  
5. **Cancel** — Legal role; invalidates provider session; contract → `declined` or `draft` per policy.  
6. **Replace contract** — only **before** send or via **superseding version** after cancel — never silent overwrite of sent package.

## 3C. States

`prepared` → `sent` → `viewed` → `partially_signed` → `fully_signed`  
Alt: `declined`, `expired` (with reason code).

## 3D. Diia integration UX

| Step | CRM | Provider |
|------|-----|----------|
| Start | Create `signature_session` record; store `deal_id`, `contract_version_id`, signers | Return `redirect_url` or embedded SDK token |
| Auth | User leaves CRM → Diia | Identity + signing |
| Return | Deep link ` /deals/:id/workspace?tab=contract&sig=... ` | Callback/webhook with status |
| Sync | Polling + webhook idempotent processor | Source of truth for crypto metadata |
| Errors | Mapped UX: timeout, declined, ID mismatch → **actionable** banner + support code |

**Idempotency:** `provider_event_id` unique; retries safe.

## 3E. Signed document handling

- Provider returns **signed PDF** (+ manifest) → stored as new **`document_version`** under `signed_contracts`, `is_signed=true`.  
- **Link** to `contract_version` and DEAL.  
- UI: **canonical** card “Підписаний договір” at top; drafts collapsed under “Історія чернеток”.

## 3F. Audit trail

**`signature_event`** (append-only):  
`id`, `signature_session_id`, `event_type`, `actor_type`, `actor_user_id`, `signer_external_id`, `contract_version_id`, `document_version_id`, `ip`, `user_agent`, `provider_payload` (jsonb), `occurred_at`.

**User-facing:** exportable **Certificate pack** (PDF list + event log) for legal.

---

# SECTION 4 — FILES + CONTRACT + WORKFLOW

## Connection to deal progression

| Trigger | Condition | Action |
|---------|-----------|--------|
| Proposal PDF generated | stage in {proposal} | Suggest / auto `DEAL_STAGE` move (policy) |
| Contract version created | first time | `contract.created` activity; optional task Legal |
| Contract `sent_for_signature` | success | Lock edits; notify client; SLA |
| Contract `fully_signed` | signed doc stored | Unlock payment milestones; readiness recalc; optional stage → payment |
| Payment proof uploaded | category `payment_proofs` + validated | Enable production readiness check |
| Required doc missing | handoff or production gate | Block transition; show **exact** list |
| Drawing replaced | `is_current` changed | Event `document.version.superseded` → notify production |

**Implementation pattern:** **event bus** (`document.*`, `contract.*`, `signature.*`) + **rules engine** (stage gates + readiness evaluator reading same requirement sets).

---

# SECTION 5 — EDGE CASES

| Case | Handling |
|------|----------|
| Duplicate file (same hash) | Prompt: link as new version vs reject duplicate; dedupe hint in UI |
| Wrong category | Allow recategorize if permissions; re-run requirement evaluation; audit log |
| Missing required | Synthetic UI slot; cannot complete gate; optional auto-task |
| Contract edited after send | **Blocked** by API; if provider bug — new version + incident workflow |
| Signature expired | Status `expired`; one-click “нова сесія” from same `contract_version` or new version if terms changed |
| Client declined | `declined` + reason; notify owner; version frozen |
| File replaced during production | Warning banner; **change order** record; production_ack required |
| Corrupted file | `processing_status=FAILED`; quarantine; user re-upload |
| User deletes critical file | Soft-delete only; signed **cannot** delete; restore window; Legal approval for hard delete |

---

# SECTION 6 — UX RULES

1. **Always** show aggregate document state in workspace header (draft / awaiting signature / signed).  
2. **Never** hide required missing slots — collapse optional, not required.  
3. **Always** show which version is **active**; signed canonical **above the fold**.  
4. **Clearly** separate **Чернетка** vs **Підписано** (tabs or sections).  
5. **Always** show **what blocks** next step (one sentence + link).  
6. **Minimize clicks:** upload → same screen validation → inline success.  
7. **Everything** primary lives in **Deal Workspace**; external tools are **exceptions** with return links.

---

# FINAL OUTPUT (consolidated)

## 1. Full file architecture

- **Logical:** `document` + `document_link` + `file_category`.  
- **Physical:** `document_version` (immutable blob + metadata + `is_current` + `is_signed`).  
- **Governance:** `document_requirement_set`, virus scan, RBAC, retention.  
- **UX:** category-first workspace, version timeline, badges, blocking header.

## 2. Contract system architecture

- **Structured source of truth:** `contract_version.content_snapshot` + clause library.  
- **PDF:** rendered artifact linked as `document_version`.  
- **Lifecycle:** status enums + lock on send/sign.  
- **Template:** variables, locked blocks, optional clauses, versioning.

## 3. Signature flow architecture

- **CRM-owned** session state + **provider-owned** crypto proof.  
- **Webhook + poll** reconciliation; **append-only** `signature_event`.  
- **Signed PDF** → `signed_contracts` **document** + immutable version.

## 4. Database tables (summary)

| Table | Role |
|-------|------|
| `file_category` | Controlled taxonomy + rules |
| `document` | Logical file |
| `document_version` | Immutable binary + flags |
| `document_link` | Polymorphic anchors |
| `document_metadata` | Search / AI extraction |
| `document_requirement_set` | Required docs rules |
| `contract` | Deal-scoped contract root |
| `contract_template` | Reusable definitions |
| `contract_version` | Immutable snapshots |
| `contract_block` / `contract_clause` / `contract_clause_instance` | Structure |
| `contract_variable` | Template schema |
| `signature_session` | Diia (or other) session |
| `signature_event` | Audit |
| `automation_rule` / `automation_run` | Document events (existing pattern) |

## 5. UI structure (Deal Workspace)

```
WorkspaceHeader: deal + document state + blockers
Tabs:
  Overview | … | Files (by category + requirements) | Contract (editor/preview) | Payment | Handoff | Production | Activity
Subpanels:
  Files: RequiredStrip | CategorySections | InboxUnlinked | VersionDrawer
  Contract: EditorSplit | Variables | Approval | SignatureProgress | History
```

## 6. Top 15 document-related automations

1. Inbox attachment ingested → task “Прив’язати до угоди”.  
2. Required doc missing 24h → escalate to manager.  
3. Contract generated → notify Legal if amount &gt; threshold.  
4. Internal approval granted → enable “Send to Diia”.  
5. Client viewed → SLA ping sales.  
6. Partially signed → remind next signer.  
7. Fully signed → create `signed_contracts` doc + readiness refresh.  
8. Payment proof uploaded → unlock production checklist item.  
9. Drawing superseded → notify production + log change order.  
10. Virus scan fail → block link + security ticket.  
11. Duplicate hash detected → suggest merge.  
12. Contract expiring (term) → renewal task (future).  
13. Handoff submitted without spec → auto-reject with reason.  
14. Signed doc downloaded → audit log (export tracking).  
15. AI miscategorization corrected → feedback to model + rule tweak ticket.

## 7. Top 10 risks

1. **Legal drift:** edited PDF outside system — mitigate: only signed provider artifacts trusted.  
2. **Wrong active version** in production — mitigate: DB constraint + UI canonical + API checks.  
3. **Webhook spoofing** — mitigate: signature verification, idempotency, IP allowlist.  
4. **PII leakage** in previews — mitigate: ABAC, watermark, download policies.  
5. **Requirement explosion** — unmaintainable rules — mitigate: template-scoped sets + versioning of rule packs.  
6. **User bypass** via email attachments — mitigate: culture + “official doc only in CRM” + inbox linking.  
7. **Storage cost** — mitigate: lifecycle to cold storage, dedupe by hash.  
8. **Diia downtime** — degrade: queue sessions, clear user messaging, retry policy.  
9. **Concurrent editors** on contract — mitigate: optimistic locking + “who is editing”.  
10. **Audit gap** if soft-delete abused — mitigate: retention locks on signed; exportable audit pack.

---

**Next implementation step for this repo:** map `AttachmentCategory` → `file_category`; extend `document_version` with virus scan + link table; add `document_requirement_set` + readiness evaluator input; add `signature_session` / `signature_event` before expanding Diia beyond placeholder `diiaSessionId`.
