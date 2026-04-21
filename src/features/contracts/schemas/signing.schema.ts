import { z } from "zod";

export const signatureWebhookPayloadSchema = z.object({
  envelopeId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  status: z.string().optional(),
  event: z.string().optional(),
});

export const verifyContractSchema = z.object({
  force: z.boolean().default(false),
});
