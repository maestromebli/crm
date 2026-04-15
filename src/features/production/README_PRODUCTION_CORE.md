# ENVER Production Core (v1)

This module implements a lightweight operations core after approved deal handoff.

## Main flow

Approved deal -> Intake -> Constructor workspace -> Approval -> One-click split -> Purchase + Production -> Installation -> Completed.

## Core engines

- `services/productionStatusEngine.ts`: current status, readiness percent, blockers, checklist.
- `services/getNextProductionAction.ts`: "one big next button" logic.
- `services/productionSplitEngine.ts`: one-click auto generation of purchase, warehouse, production and installation pre-tasks.
- `services/productionAutomation.ts`: automation triggers after critical events.

## UI structure

- Intake: `ProductionIntakePage.tsx`
- Approval: `ProductionApprovalPage.tsx`
- Production board: `ProductionBoardPage.tsx`
- Chief dashboard: `ProductionChiefDashboard.tsx`
- Order hub: `ui/order-hub/ProductionOrderHubPage.tsx`

## External constructor access

- `src/features/constructor/constructorAccess.ts` contains secure share-link primitives.
- `ConstructorWorkspacePage.tsx` is one-order scoped and integration-ready for token validation.

## AI layer

- `src/features/operations-ai/operationsAIEngine.ts` returns compact actionable risks/warnings.
- `OperationsAIWidget.tsx` presents short signals inside operational pages.
