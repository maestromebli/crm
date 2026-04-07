export type ViyarPriceMatch = {
  unitPrice: number;
  unit: string;
  sourceUrl: string;
  matchedKey: string;
};

type ViyarCatalogEntry = {
  key: string;
  aliases: string[];
  unitPrice: number;
  unit: string;
  sourceUrl: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const VIYAR_PRICE_CATALOG: ViyarCatalogEntry[] = [
  {
    key: "egger u702 st9 кашемир сірий 2800x2070x18",
    aliases: [
      "дсп лам. egger u702 st9 кашемір сірий 2800х2070х18 мм",
      "дсп лам. egger u702 st9 kashemir seryy kashemir 18 mm",
      "дсп egger u702 st9",
      "egger u702 st9",
    ],
    unitPrice: 4694.82,
    unit: "лист",
    sourceUrl:
      "https://viyar.ua/ua/catalog/egger_u702_st9_kashemir_seryy_kashemir_18_mm/",
  },
];

export function lookupViyarPriceByName(
  productName: string | null | undefined,
): ViyarPriceMatch | null {
  const n = normalize(productName ?? "");
  if (!n) return null;

  for (const e of VIYAR_PRICE_CATALOG) {
    const keys = [e.key, ...e.aliases].map(normalize);
    if (keys.some((k) => n.includes(k) || k.includes(n))) {
      return {
        unitPrice: e.unitPrice,
        unit: e.unit,
        sourceUrl: e.sourceUrl,
        matchedKey: e.key,
      };
    }
  }

  return null;
}
