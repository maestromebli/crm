"use client";

import { useEffect, useMemo, useState } from "react";
import type { DealWorkspacePayload } from "../deal-workspace/types";
import type { CalculationRow, CalculationTotals } from "../calculation-ui/calculationStore";
import { buildCalculationAIInput, runCalculationAI, type CalculationAIResult } from "./calculationAIEngine";

const EMPTY_AI: CalculationAIResult = {
  suggestions: [],
  warnings: [],
  actions: [],
};

export function useCalculationAI(
  rows: CalculationRow[],
  totals: CalculationTotals,
  workspacePayload?: DealWorkspacePayload,
) {
  const [result, setResult] = useState<CalculationAIResult>(EMPTY_AI);

  const input = useMemo(
    () => buildCalculationAIInput(rows, totals, workspacePayload),
    [rows, totals, workspacePayload],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setResult(runCalculationAI(input));
    }, 280);
    return () => clearTimeout(timeout);
  }, [input]);

  return result;
}
