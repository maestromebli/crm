/**
 * Типовий блок приміток у кінці КП (як у зразка Excel/PDF клієнта).
 */
export const KP_REFERENCE_FOOTNOTES: readonly string[] = [
  "*Контрольний замір, доставка та монтаж входять у вартість.",
  "** Монтаж витяжки, навіска дверей на ПММ/холодильник, врізка варочної та мийки входять у вартість.",
  "*** Підключення електричних/сантехнічних приладів не проводимо.",
  "**** Ручний занос меблів на поверх оплачується додатково (у випадку неможливості підняти вироби ліфтом).",
];

/** Формат суми як у зразка: `362 350,00` */
export function formatProposalMoneyUa(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
