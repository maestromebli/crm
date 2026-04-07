/**
 * Чи налаштовані змінні середовища для зовнішнього API банку (без витоку значень).
 * Імена можна розширити під реальний конектор.
 */
export function hasBankProviderEnvCredentials(provider: string): boolean {
  const p = provider.trim().toUpperCase();
  if (p === "PRIVATBANK") {
    return Boolean(
      process.env.PRIVATBANK_API_TOKEN?.trim() || process.env.PRIVATBANK_TOKEN?.trim(),
    );
  }
  if (p === "OSCHADBANK") {
    return Boolean(
      process.env.OSCHADBANK_API_TOKEN?.trim() || process.env.OSCHADBANK_TOKEN?.trim(),
    );
  }
  return Boolean(process.env[`${p}_API_TOKEN`]?.trim());
}

/** Демо-ід з mock-даних, не існують у PostgreSQL. */
export function isDemoBankIntegrationId(id: string): boolean {
  return id.startsWith("00000000-0000-4000-8000");
}
