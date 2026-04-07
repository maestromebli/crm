# Event Coverage Matrix (CORE CRM ENGINE ENVER V2)

## Mandatory event families and current producers

| Family | Event type | Current producer |
|---|---|---|
| Lead | `lead_created` | `src/app/api/leads/route.ts` |
| Lead | `status_changed` | `src/app/api/leads/[leadId]/route.ts` |
| Lead | `file_uploaded` | `src/app/api/leads/route.ts`, `src/app/api/leads/[leadId]/attachments/route.ts` |
| Lead | `estimate_created` | `src/app/api/leads/[leadId]/estimates/route.ts` |
| Lead | `quote_sent` | `src/app/api/leads/[leadId]/proposals/[proposalId]/route.ts` |
| Deal | `status_changed` | `src/app/api/deals/[dealId]/stage/route.ts` (legacy + canonical mapping) |
| Deal | `contract_signed` | `src/app/api/deals/[dealId]/contract/route.ts` (legacy emitter) |
| Deal | `invoice_created` | `src/app/api/deals/[dealId]/finance/invoices/route.ts` |
| Deal | `payment_received` | `src/app/api/deals/[dealId]/finance/payments/route.ts` |
| Deal/Production | `sent_to_production` | `src/app/api/deals/[dealId]/production-launch/route.ts` |

## Notes

- Legacy dotted events remain supported and are mapped through canonical catalog where needed.
- Timeline readers consume both `activityLog` and `DomainEvent` with indexed entity-scoped reads.
- Additional production and AI/automation event families can be added incrementally without flow rewrites.
