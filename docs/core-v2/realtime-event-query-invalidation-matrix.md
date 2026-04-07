# Realtime Event -> Query Invalidation Matrix

This matrix defines selective UI refresh rules for System Level 2.
Goal: avoid global refetch and keep updates scoped to affected surfaces.

## Principles

- Prefer query-key invalidation over `router.refresh()`.
- Refresh only entity-scoped data (`leadId`, `dealId`, assignee scope).
- Keep polling fallback active when live transport is unavailable.
- Never bypass RBAC/data-scope in realtime payload routing.

## Event Routing Matrix

| Event (domain) | Affected surfaces | Targeted refresh |
|---|---|---|
| `LEAD_UPDATED` / `LEAD_STAGE_CHANGED` | Lead list, lead card, timeline strip | Invalidate lead detail key (`leadQueryKeys.detail(leadId)`), refetch list segment only for active filters |
| `LEAD_MESSAGE_CREATED` | Lead communication cards, timeline | Invalidate lead detail key + lead activity endpoint cache |
| `TASK_CREATED` / `TASK_UPDATED` / `TASK_COMPLETED` (lead) | Lead tasks card, dashboard priorities | Invalidate lead tasks query + dashboard priorities block |
| `TASK_CREATED` / `TASK_UPDATED` / `TASK_COMPLETED` (deal) | Deal tasks tab, deal right rail | Invalidate `dealQueryKeys.tasks(dealId)` |
| `DEAL_UPDATED` / `DEAL_STAGE_CHANGED` | Deals list, deal workspace header, timeline | Invalidate `dealQueryKeys.workspace(dealId)` + active deals list slice |
| `DEAL_HANDOFF_SUBMITTED` / `DEAL_HANDOFF_ACCEPTED` | Deal workspace, dashboard risk/next actions | Invalidate deal workspace key + executive dashboard loader |
| `DEAL_CONTRACT_UPDATED` / `SIGNATURE_STATUS_CHANGED` | Contract tab, signature stale widgets | Invalidate deal workspace key + stale-signature widgets |
| `PRODUCTION_LAUNCHED` / `PRODUCTION_DELAY_UPDATED` | Production widgets, risk center | Invalidate executive dashboard production block + production hub list |
| `CALENDAR_EVENT_CREATED` / `CALENDAR_EVENT_UPDATED` | Calendar overlays, daily schedule widgets | Invalidate calendar day-range queries + daily schedule block |
| `COMM_ALERT_CREATED` / `COMM_ALERT_ACKED` | Header NOC badge, critical alerts panel | Refetch `/api/settings/communications/alerts/summary` + critical alerts list |
| `AI_ACTION_EXECUTED` | Next actions, attention center, timeline | Invalidate executive `nextActions`, relevant entity timeline |
| `BEHAVIOR_SCORE_UPDATED` | Behavior card, weak managers, critical page | Invalidate executive behavior snapshot payload (`loadExecutiveDashboard`) |

## Cache Key Anchors

- Leads: `src/features/leads/lead-query-keys.ts`
- Deals: `src/features/deal-workspace/deal-query-keys.ts`
- Executive dashboard payload: `src/features/crm-dashboard/load-executive-dashboard.ts`
- Dashboard critical attention feed: `src/app/(dashboard)/dashboard/critical/page.tsx`

## Fallback Policy

- Use pulse polling (`/api/realtime/pulse`) every 20s for dashboard-level update hint.
- On pulse mismatch, user-triggered refresh is preferred.
- Keep current optimistic updates for tasks/deal workspace mutations.
