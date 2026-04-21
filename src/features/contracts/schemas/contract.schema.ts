import { z } from "zod";

export const createContractSchema = z.object({
  orderId: z.string().min(1),
  templateCode: z.string().min(1),
});

export const updateContractVariablesSchema = z.object({
  payloadJson: z.record(z.string(), z.unknown()),
});

export const sendForSignatureSchema = z.object({
  provider: z.enum(["VCHASNO", "DIIA", "PAPERLESS"]).default("VCHASNO"),
  deliveryChannels: z
    .array(z.enum(["EMAIL", "SMS", "TELEGRAM", "VIBER"]))
    .default(["EMAIL"]),
});
