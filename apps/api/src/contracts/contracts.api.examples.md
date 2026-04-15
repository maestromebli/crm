# Contract Module API Payloads

## POST `/api/contracts/create-from-quotation`

```json
{
  "dealId": "cm9deal001",
  "quotationId": "cm9quote001",
  "customer": {
    "fullName": "Іваненко Іван Іванович",
    "taxId": "3124509876",
    "passportData": "СЕ123456",
    "phone": "+380671112233",
    "email": "client@example.com",
    "address": "м. Київ, вул. Саперне поле, 5"
  },
  "fields": {
    "contractNumber": "EN-2026-0413-01",
    "contractDate": "2026-04-13",
    "totalAmount": 156700,
    "advanceAmount": 94020,
    "remainingAmount": 62680,
    "productionLeadTimeDays": 28,
    "paymentTerms": "60% аванс, 40% після готовності",
    "warrantyMonths": 24
  }
}
```

## PATCH `/api/contracts/:id`

```json
{
  "fields": {
    "objectAddress": "м. Київ, вул. Антоновича, 72",
    "deliveryAddress": "м. Київ, вул. Антоновича, 72",
    "managerComment": "Уточнити відтінок фасадів перед запуском"
  }
}
```

## POST `/api/contracts/:id/share`

```json
{
  "expiresInHours": 72,
  "maxViews": 10
}
```

## POST `/api/integrations/diia/webhook`

```json
{
  "sessionId": "mock-diia-cm9contract001-1713000000000",
  "status": "SIGNED",
  "data": {
    "ip": "127.0.0.1",
    "signedAt": "2026-04-13T14:30:00.000Z"
  }
}
```
