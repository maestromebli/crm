# Estimate Module No-Regression Checklist

This checklist protects external behavior of the calculation workspace (`Розрахунок`).

## Hard invariants

- Keep existing routes and URL entrypoints for lead/deal estimate flows.
- Keep the visual composition and user interaction model of the estimate workspace.
- Do not create a second estimate editor or parallel calculation screen.
- Preserve API envelopes used by existing workspace clients.
- Preserve permission-based field visibility (`COST_VIEW`, `MARGIN_VIEW`).

## API contract checks

- `GET /api/deals/:dealId/estimates` returns `{ items: [...] }`.
- `GET /api/deals/:dealId/estimates/:estimateId` returns `{ estimate: ... }`.
- `PATCH /api/deals/:dealId/estimates/:estimateId` returns `{ ok: true, estimate: ... }`.
- `GET /api/leads/:leadId/estimates` returns `{ items: [...] }`.
- `PATCH /api/leads/:leadId/estimates/:estimateId` keeps validation semantics for line type and product name.
- Compare endpoints require `from` and `to` and keep stable diff payload shape.

## UX contract checks

- Estimate workspace tab stays reachable through current deal workspace tabs.
- Existing keyboard/data entry flow in tables remains unchanged.
- No forced migration of user actions to Smart Panel or alternative screens.
- Save/duplicate/set-active operations retain existing affordances.

## Rollout checks

- Event hooks may be added behind existing actions only.
- Internal performance optimizations must not alter visible behavior.
- Any change to workspace payload shape must include compatibility fallback.
