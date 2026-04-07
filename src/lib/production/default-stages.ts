import type { ProductionStageName } from "@prisma/client";

const LABEL_UA: Record<ProductionStageName, string> = {
  CUTTING: "Розкрій",
  EDGING: "Крайкування",
  DRILLING: "Присадка",
  ASSEMBLY: "Збірка",
  PAINTING: "Фарбування",
  PACKAGING: "Упаковка",
  DELIVERY: "Доставка",
  INSTALLATION: "Монтаж",
};

export function stageLabelUa(name: ProductionStageName): string {
  return LABEL_UA[name] ?? name;
}

export function defaultStageSequence(includePainting: boolean): ProductionStageName[] {
  const base: ProductionStageName[] = [
    "CUTTING",
    "EDGING",
    "DRILLING",
    "ASSEMBLY",
  ];
  if (includePainting) base.push("PAINTING");
  base.push("PACKAGING", "DELIVERY", "INSTALLATION");
  return base;
}
