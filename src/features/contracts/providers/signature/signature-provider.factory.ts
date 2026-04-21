import type { EnverSignatureProvider } from "@prisma/client";
import { DiiaSignatureAdapter } from "./diia.adapter";
import { PaperlessSignatureAdapter } from "./paperless.adapter";
import type { SignatureProviderAdapter } from "./signature-provider.types";
import { VchasnoSignatureAdapter } from "./vchasno.adapter";

export function getSignatureProvider(
  provider: EnverSignatureProvider,
): SignatureProviderAdapter {
  switch (provider) {
    case "VCHASNO":
      return new VchasnoSignatureAdapter();
    case "DIIA":
      return new DiiaSignatureAdapter();
    case "PAPERLESS":
      return new PaperlessSignatureAdapter();
    default:
      throw new Error(`Unsupported provider: ${String(provider)}`);
  }
}

export function resolveSignatureProvider(
  provider?: EnverSignatureProvider | null,
): EnverSignatureProvider {
  if (provider) return provider;
  const fromEnv = String(process.env.SIGNATURE_PROVIDER_DEFAULT ?? "VCHASNO").toUpperCase();
  if (fromEnv === "DIIA" || fromEnv === "PAPERLESS") return fromEnv;
  return "VCHASNO";
}
