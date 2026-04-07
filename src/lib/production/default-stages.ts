/** Лінійні етапи цеху (legacy UI), без Prisma enum. */
export type LegacyProductionStageName =
  | "CUTTING"
  | "EDGING"
  | "DRILLING"
  | "ASSEMBLY"
  | "PAINTING"
  | "PACKAGING"
  | "DELIVERY"
  | "INSTALLATION";

const LABEL_UA: Record<string, string> = {
  CUTTING: "Розкрій",
  EDGING: "Крайкування",
  DRILLING: "Присадка",
  ASSEMBLY: "Збірка",
  PAINTING: "Фарбування",
  PACKAGING: "Упаковка",
  DELIVERY: "Доставка",
  INSTALLATION: "Монтаж",
};

export function stageLabelUa(name: string): string {
  return LABEL_UA[name] ?? name;
}

export function defaultStageSequence(
  includePainting: boolean,
): LegacyProductionStageName[] {
  const base: LegacyProductionStageName[] = [
    "CUTTING",
    "EDGING",
    "DRILLING",
    "ASSEMBLY",
  ];
  if (includePainting) base.push("PAINTING");
  base.push("PACKAGING", "DELIVERY", "INSTALLATION");
  return base;
}
