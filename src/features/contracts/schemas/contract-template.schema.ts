import { z } from "zod";

export const templateVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["string", "number", "date", "boolean", "object", "array"]),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

export const contractTemplateSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  documentType: z.string().min(2),
  language: z.string().default("uk"),
  bodyHtml: z.string().min(20),
  bodyDocxTemplateUrl: z.string().url().optional().or(z.literal("")),
  variablesSchemaJson: z.array(templateVariableSchema),
  settingsJson: z
    .object({
      providerOverride: z.enum(["VCHASNO", "DIIA", "PAPERLESS"]).optional(),
      expiryDays: z.number().int().min(1).max(90).default(7),
      approvalRequired: z.boolean().default(false),
      reminderDays: z.array(z.number().int().min(1).max(30)).default([1, 3]),
      defaultPartyMapping: z
        .array(
          z.object({
            role: z.enum(["CUSTOMER", "COMPANY", "GUARANTOR"]),
            source: z.string().min(1),
            signOrder: z.number().int().min(1),
          }),
        )
        .default([]),
    })
    .default({
      expiryDays: 7,
      approvalRequired: false,
      reminderDays: [1, 3],
      defaultPartyMapping: [],
    }),
});
