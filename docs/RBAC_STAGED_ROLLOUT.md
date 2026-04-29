# RBAC Staged Rollout

This is the recommended staged rollout sequence for RBAC updates.

## Pre-rollout checklist

1. Validate code and guards:
   - `pnpm typecheck`
   - `pnpm security:route-guards`
   - `pnpm security:rbac-scenarios`
2. Capture baseline:
   - `pnpm audit:users`
   - `pnpm rbac:snapshot`
3. Generate dry-run diff:
   - `pnpm realign:permissions -- --all`

## Rollout order

1. Sales line:
   - `HEAD_MANAGER`
   - `SALES_MANAGER` (+ legacy `MANAGER` / `USER`)
2. Operations:
   - `ACCOUNTANT`
   - `PROCUREMENT_MANAGER`
   - production roles (`DIRECTOR_PRODUCTION`, `PRODUCTION_WORKER`, `CUTTING`, `EDGING`, `DRILLING`, `ASSEMBLY`, `CONSTRUCTOR`)
3. Admin layer:
   - `ADMIN`
   - `DIRECTOR`
   - `SUPER_ADMIN`

## Apply mode

- Default: hybrid (recommended)
  - keeps personal overrides
  - command example:
    - `pnpm realign:permissions -- --apply --email=head.manager@enver.local`
- Strict (only for policy hard reset)
  - removes extra per-user overrides
  - command example:
    - `pnpm realign:permissions -- --apply --strict --email=head.manager@enver.local`

## Validation after each batch

1. `pnpm audit:users`
2. Spot-check 3-5 real business scenarios:
   - dashboard visibility
   - lead/deal team scope
   - inbox/conversation access
   - assignment rights
   - settings visibility and editability

## Rollback

1. Use the snapshot captured before rollout:
   - `pnpm rbac:restore -- --file=backups/rbac-snapshot-YYYY-MM-DDTHH-mm-ss-sssZ.json --yes`
2. Re-check:
   - `pnpm audit:users`
   - `pnpm security:rbac-scenarios`

