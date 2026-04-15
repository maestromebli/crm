# Contracts API examples

## Create from quotation

`POST /api/contracts/create-from-quotation`

```json
{
  "dealId": "cm_deal_123",
  "quotationId": "cm_proposal_987",
  "fields": {
    "contractNumber": "EN-2026-04-13-01",
    "contractDate": "2026-04-13",
    "customerFullName": "Іваненко Іван Іванович",
    "customerTaxId": "3216549870",
    "objectAddress": "м. Київ, вул. Антоновича, 10",
    "deliveryAddress": "м. Київ, вул. Антоновича, 10",
    "totalAmount": 156700,
    "advanceAmount": 94020,
    "remainingAmount": 62680,
    "productionLeadTimeDays": 28,
    "paymentTerms": "60% аванс, 40% перед монтажем"
  }
}
```

## Update contract fields

`PATCH /api/contracts/:id`

```json
{
  "fields": {
    "managerComment": "Перед запуском узгодити колір фасадів",
    "specialConditions": "Підйом без вантажного ліфта"
  }
}
```

## Share with customer

`POST /api/contracts/:id/share`

```json
{
  "expiresInHours": 72,
  "maxViews": 15
}
```

## Diia webhook

`POST /api/integrations/diia/webhook`

```json
{
  "sessionId": "contract-mock-a1b2c3d4",
  "status": "signed",
  "data": {
    "signatureProvider": "mock",
    "signedAt": "2026-04-13T18:40:00.000Z"
  }
}
```
