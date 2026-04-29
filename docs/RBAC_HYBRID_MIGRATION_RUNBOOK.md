# RBAC Hybrid Migration Runbook

This runbook describes safe permission alignment with hybrid mode:

- Role baseline is enforced.
- Personal overrides are preserved by default.
- Strict mode is opt-in when you explicitly need baseline-only rights.

## 1) Audit current state

```bash
pnpm audit:users
pnpm realign:permissions -- --all
```

Review:
- `не вистачає ключів` = baseline gaps (must add)
- `зайві` = user-specific overrides (kept in hybrid mode)

## 2) Apply hybrid baseline (safe default)

Single user:

```bash
pnpm realign:permissions -- --apply --email=user@company.com
```

Batch (all users):

```bash
pnpm realign:permissions -- --apply --all --yes
```

Behavior:
- Missing baseline keys are added.
- Extra keys are not removed.

## 3) Apply strict baseline (optional)

Use only when all personal overrides must be removed:

```bash
pnpm realign:permissions -- --apply --strict --email=user@company.com
pnpm realign:permissions -- --apply --strict --all --yes
```

Behavior:
- Permission rows are reset to role baseline.
- Extra keys are removed.

## 4) Re-verify

```bash
pnpm audit:users
pnpm realign:permissions -- --all
```

Check critical roles first:
- `HEAD_MANAGER`
- `SALES_MANAGER`
- `ACCOUNTANT`
- `PROCUREMENT_MANAGER`
- production roles (`CUTTING`, `EDGING`, `DRILLING`, `ASSEMBLY`, `CONSTRUCTOR`)

