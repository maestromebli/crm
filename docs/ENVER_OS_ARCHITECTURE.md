# ENVER OS Canonical Architecture

This document captures the convergence path for the production CRM/ERP system.

## Core Flow

Lead -> Estimate -> Deal -> Order -> Production -> Finance

## Canonical Layers

- `estimate-core`: single source of pricing, totals, and margin rules.
- `finance-core`: finance workflows consume estimate totals via adapters.
- Domain modules: leads, deals, orders, production, finance.
- Intelligence: AI reads domain snapshots only (no business calculations).
- Interface: assistant layer composes prompts and summaries from domain data.
- Presentation: route/page layer delegates to domain services and adapters.

## Current Refactor Rules

- All pricing calculations should route through `src/features/estimate-core`.
- Legacy pricing engines are compatibility wrappers and should be treated as deprecated.
- Lead flow must converge to `Lead -> Estimate -> Deal`.
- Deal workspace remains operational center for execution and finance sync.
- Route aliases should redirect to canonical trees instead of duplicating logic.
