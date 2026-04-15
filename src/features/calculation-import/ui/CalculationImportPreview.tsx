"use client";

import type { ImportedWorkbook, ImportedBlock } from "../types/calculationImport.types";
import { ProductBlockPreview } from "./ProductBlockPreview";
import { useCalculationImportAI } from "../useCalculationImportAI";

function flattenBlocks(workbook: ImportedWorkbook): ImportedBlock[] {
  return workbook.sheets.flatMap((sheet) => sheet.blocks);
}

export function CalculationImportPreview({
  workbook,
  editable,
  onChange,
}: {
  workbook: ImportedWorkbook;
  editable: boolean;
  onChange: (next: ImportedWorkbook) => void;
}) {
  const blocks = flattenBlocks(workbook);
  const { hints } = useCalculationImportAI(blocks);

  const patchBlock = (sheetIndex: number, blockIndex: number, nextBlock: ImportedBlock) => {
    const next = {
      ...workbook,
      sheets: workbook.sheets.map((s, sIdx) =>
        sIdx !== sheetIndex
          ? s
          : {
              ...s,
              blocks: s.blocks.map((b, bIdx) => (bIdx !== blockIndex ? b : nextBlock)),
            },
      ),
    };
    onChange(next);
  };

  const deleteBlock = (sheetIndex: number, blockIndex: number) => {
    const next = {
      ...workbook,
      sheets: workbook.sheets.map((s, sIdx) =>
        sIdx !== sheetIndex
          ? s
          : {
              ...s,
              blocks: s.blocks.filter((_, bIdx) => bIdx !== blockIndex),
            },
      ),
    };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {hints.length > 0 ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
          <p className="font-semibold">AI підказки (без автозаміни)</p>
          <ul className="mt-1 space-y-1">
            {hints.slice(0, 6).map((hint) => (
              <li key={hint.id}>• {hint.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {workbook.sheets.map((sheet, sheetIndex) => (
        <div key={sheet.name} className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Аркуш: {sheet.name}</p>
          {sheet.blocks.map((block, blockIndex) => (
            <ProductBlockPreview
              key={block.id}
              block={block}
              editable={editable}
              onChange={(next) => patchBlock(sheetIndex, blockIndex, next)}
              onDelete={() => deleteBlock(sheetIndex, blockIndex)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
