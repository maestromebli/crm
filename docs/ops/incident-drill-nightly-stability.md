# Incident Drill: Nightly Stability

## Purpose

- Validate detection -> triage -> recovery flow for failures in critical nightly E2E suite.
- Keep a reproducible response process for Lead Hub and Contracts Portal regressions.

## Scope

- Workflow: `.github/workflows/e2e-nightly-stability.yml`
- Suites:
  - Lead Hub critical flows (`notes`, RBAC UI/API)
  - Contracts Portal public guard
  - Contracts Portal happy-path + manager sync + document post-effect

## SLO Targets

- Nightly pass rate (7-day rolling): `>= 98%`
- Mean time to acknowledge a failed nightly: `<= 30 min`
- Mean time to mitigation for critical regression: `<= 4 h`
- Flake budget (tests passing on retry only): `<= 2%` per week

## Alert Triggers

- Any red nightly run on default branch.
- 2 consecutive nightly failures in same suite.
- Any spike in retry-only passes above flake budget.

## Triage Checklist

1. Open failed run artifact `nightly-stability-playwright-*`.
2. Review `playwright-report/` summary, then test-level traces/videos.
3. Classify failure:
   - product regression,
   - infrastructure/env issue,
   - flaky test.
4. Re-run only failed spec(s) against same environment.
5. If reproducible -> create fix PR and link failing run.
6. If flaky -> create stabilization task with owner and due date.

## Drill Procedure (Weekly)

1. Run workflow manually (`workflow_dispatch`) on latest default branch.
2. Intentionally break one expected assertion in a temporary branch and confirm:
   - failure is detected,
   - artifact is generated,
   - triage owner acknowledges within SLO window.
3. Revert temporary break and verify green rerun.
4. Log drill outcome in team ops notes:
   - detection time,
   - acknowledge time,
   - mitigation time,
   - lessons learned.

## Recovery Playbook

- If Lead Hub tests fail:
  - check `/api/leads/hub-rail`, `/api/leads/{id}`, stage PATCH responses.
  - verify permissions and test accounts.
- If Contracts Portal tests fail:
  - check `/api/portal/contracts/{token}` status and token validity.
  - verify manager sync via `/api/contracts/{id}` and audit actions.
  - verify document generation endpoint and attachment creation.

## Exit Criteria

- Incident is closed only when:
  - root cause documented,
  - fix merged and deployed,
  - one full nightly run is green after fix.
