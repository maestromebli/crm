# ENVER OS API and Event Contracts v1

## API response standard (v1)

New ENVER OS endpoints should follow:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "uuid",
    "correlationId": "uuid"
  }
}
```

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Недостатньо прав",
    "details": {}
  },
  "meta": {
    "requestId": "uuid",
    "correlationId": "uuid"
  }
}
```

Implementation helpers:
- `src/lib/api/contract.ts`
- `src/lib/platform/request-context.ts`

Pilot routes:
- `src/app/api/health/route.ts`
- `src/app/api/crm/event-health/route.ts`

## Domain Event Catalog v1

Canonical catalog source:
- `src/lib/events/event-catalog.ts`

Versioned export:
- `getEventCatalogV1()` returns `{ version: "v1", events: [...] }`.

Initial mandatory event set in v1:
- `lead_created`
- `converted_to_deal`
- `status_changed`
- `contract_signed`
- `payment_received`
- `sent_to_production`
- `procurement_started`
- `policy_blocker_raised`

## Compatibility policy

- Existing legacy routes may keep old response shape during migration.
- New routes and refactored routes must use v1 contract helpers.
- Legacy dotted events remain supported through canonical mapping in event catalog.
