# ENVER Deal Hub Ultra

## 1) Audit of Existing Deal Architecture
- Existing canonical workspace route is `src/app/(dashboard)/deals/[dealId]/workspace/page.tsx`.
- Existing data aggregation is `src/features/deal-workspace/queries.ts` (`getDealWorkspacePayload`).
- Existing deal API surface already includes stage, contract, files, finance, handoff, production orchestration.
- Existing auth and scope controls are `src/lib/authz/api-guard.ts` + `src/lib/authz/permissions.ts`.
- Existing pricing truth is primarily `Estimate` for deals and `PricingSession` for generic entity usage (lead-hub already uses `LEAD_HUB`).

## 2) Reuse / Refactor Strategy
- Reuse existing deal route shell and auth guards.
- Add Deal Hub Ultra as a module (`src/modules/deal-hub`) and mount it in overview tab.
- Keep existing stage transition endpoint (`/api/deals/[dealId]/stage`) as source of stage changes.
- Use additive API routes for overview/health/next-actions/timeline/command-action.

## 3) Prisma Model Plan
- Additive only, no destructive replacements.
- New enums: `DealPriority`, `DealHealthStatus`.
- New optional `Deal` fields for orchestration (`ultraPriority`, `ultraHealthStatus`, `pricingSessionId`, `targetCloseDate`, etc.).
- New normalized tables: milestones, notes, risks, timeline events, finance profile, payment schedule, document links, file links.

## 4) Server / Service Architecture
- `deal-hub.repository.ts` for cross-domain reads.
- `deal-hub.service.ts` as orchestrator for overview view-model.
- `deal-health.service.ts` and `deal-next-actions.service.ts` as engines.
- `deal-timeline.service.ts` for event shaping.
- `deal-hub.mutations.ts` for command-action execution.

## 5) Page / Component Architecture
- Main entry component: `DealHubPage`.
- Top zone: header, command bar, overview card, health, next actions, risk panel.
- 3-column layout: stage/client/finance on left, section workspace center, milestones/activity/files on right.

## 6) State Management Plan
- React Query for overview/health/timeline API queries.
- Local section selection in hook (`useDealSections`).
- Command actions via mutation + targeted invalidation.

## 7) Section-by-Section UI Plan
- Implemented primary sections and adapters with placeholders for deep module integrations:
  pricing, contract, measurement, constructor, production, procurement, logistics, installation, finance, documents, communication, timeline.

## 8) Stage Gate Engine
- Implemented in `domain/deal.validation.ts`.
- Declarative stage requirements and missing-condition output.

## 9) Next Actions Engine
- Implemented in `server/deal-next-actions.service.ts`.
- Produces required/overdue/suggested actions with role-aware filtering.

## 10) Deal Health Engine
- Implemented in `server/deal-health.service.ts`.
- Signals: overdue payment, low margin, missing measurement/files, production blockers, stale activity, etc.

## 11) AI Integration Architecture
- `adapters/ai` with prompt builder + mapper + guidance service.
- AI guidance is advisory only; no direct truth override.

## 12) Migration Order
- Phase A: ship module + read APIs + overview embed.
- Phase B: move section panels from placeholders to module-specific CRUD APIs.
- Phase C: backfill new prisma models and wire writes.
- Phase D: extend role-tuned experiences and AI briefings.

## 13) Testing Plan
- Added unit tests for stage gates, health, next-actions under `src/modules/deal-hub`.
- Next: add integration tests around command-action and timeline API routes.
