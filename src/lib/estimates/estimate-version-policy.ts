import { aggregateAmountBySignature } from "./estimate-line-signature";

export type VersioningMode = "auto" | "fork" | "inline";

const EPS = 0.01;

/** Поріг: відносна зміна підсумку позицій, після якої створюємо нову версію. */
const REL_SUBTOTAL_FORK = 0.06;
/** Абсолютна зміна (грн), після якої — форк навіть при малій частці. */
const ABS_SUBTOTAL_FORK = 8000;
/** Максимум «структурних» відмінностей (додано+прибрано+змінено сигнатуру) для inline. */
const MAX_STRUCTURAL_OPS_INLINE = 2;

export function parseVersioningMode(
  raw: unknown,
): VersioningMode {
  if (raw === "fork" || raw === "inline" || raw === "auto") return raw;
  return "auto";
}

function subtotal(lines: Array<{ amountSale: number }>): number {
  return lines.reduce((a, l) => a + l.amountSale, 0);
}

/**
 * Рішення: нова версія (fork) чи правка поточного рядка Estimate.
 *
 * - `fork`: завжди нова версія.
 * - `inline`: завжди оновлення на місці (той самий estimateId).
 * - `auto`: евристики — дрібні правки без форку, великі зміни / AI — форк.
 */
export function shouldForkNewEstimateVersion(args: {
  mode: VersioningMode;
  /** Явний прапор з клієнта (напр. після AI). */
  forceNewVersion?: boolean;
  /** Текст changeSummary; префікс "AI:" примусово форкає. */
  changeSummary: string | null | undefined;
  existingLines: Array<{
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    amountSale: number;
  }>;
  newLines: Array<{
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    amountSale: number;
  }>;
}): { fork: boolean; reason: string } {
  if (args.mode === "fork") {
    return { fork: true, reason: "mode:fork" };
  }
  if (args.mode === "inline") {
    return { fork: false, reason: "mode:inline" };
  }

  if (args.forceNewVersion === true) {
    return { fork: true, reason: "forceNewVersion" };
  }

  const cs = args.changeSummary?.trim() ?? "";
  if (/^AI:/i.test(cs)) {
    return { fork: true, reason: "changeSummary:AI" };
  }

  const oldA = aggregateAmountBySignature(args.existingLines);
  const newA = aggregateAmountBySignature(args.newLines);

  const keys = new Set([...oldA.keys(), ...newA.keys()]);
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const k of keys) {
    const a = oldA.get(k);
    const b = newA.get(k);
    if (a === undefined && b !== undefined) added += 1;
    else if (a !== undefined && b === undefined) removed += 1;
    else if (a !== undefined && b !== undefined) {
      if (Math.abs(a - b) > EPS) changed += 1;
    }
  }

  const structural = added + removed + changed;
  const oldSub = subtotal(args.existingLines);
  const newSub = subtotal(args.newLines);
  const denom = Math.max(Math.abs(oldSub), 1);
  const relDelta = Math.abs(newSub - oldSub) / denom;
  const absDelta = Math.abs(newSub - oldSub);

  if (structural > MAX_STRUCTURAL_OPS_INLINE) {
    return {
      fork: true,
      reason: `auto:structural>${MAX_STRUCTURAL_OPS_INLINE}(${structural})`,
    };
  }

  if (relDelta >= REL_SUBTOTAL_FORK) {
    return { fork: true, reason: `auto:relSubtotal>=${REL_SUBTOTAL_FORK}` };
  }

  if (absDelta >= ABS_SUBTOTAL_FORK) {
    return { fork: true, reason: `auto:absSubtotal>=${ABS_SUBTOTAL_FORK}` };
  }

  const oldCount = args.existingLines.length;
  const newCount = args.newLines.length;
  if (Math.abs(newCount - oldCount) > 2) {
    return { fork: true, reason: "auto:lineCountJump" };
  }

  return {
    fork: false,
    reason: `auto:inline_ok(structural=${structural},relΔ=${relDelta.toFixed(3)})`,
  };
}

/** Для логів / API: короткий опис різниці структури. */
export function countStructuralOps(
  existingLines: Array<{
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    amountSale: number;
  }>,
  newLines: Array<{
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    amountSale: number;
  }>,
): { added: number; removed: number; changed: number } {
  const oldA = aggregateAmountBySignature(existingLines);
  const newA = aggregateAmountBySignature(newLines);
  const keys = new Set([...oldA.keys(), ...newA.keys()]);
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const k of keys) {
    const a = oldA.get(k);
    const b = newA.get(k);
    if (a === undefined && b !== undefined) added += 1;
    else if (a !== undefined && b === undefined) removed += 1;
    else if (a !== undefined && b !== undefined && Math.abs(a - b) > EPS) {
      changed += 1;
    }
  }
  return { added, removed, changed };
}
