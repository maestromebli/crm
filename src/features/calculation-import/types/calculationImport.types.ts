export type ImportedWorkbook = {
  fileName: string;
  sheets: ImportedSheet[];
  parsedAt: string;
};

export type ImportedSheet = {
  name: string;
  blocks: ImportedBlock[];
};

export type ImportedBlock = {
  id: string;
  productName: string;
  confidence?: number;
  headerMap: ColumnMap;
  items: ImportedRow[];
  subtotal?: AmountRow;
  extras: ImportedRow[];
  finalTotal?: AmountRow;
  warnings: string[];
};

export type ImportedRow = {
  id: string;
  name: string;
  type: "material" | "fitting" | "service" | "measurement" | "misc";
  qty: number | null;
  coeff: number | null;
  price: number | null;
  amount: number | null;
  formula?: string;
  sourceRow: number;
};

export type AmountRow = {
  label: string;
  amount: number | null;
  formula?: string;
};

export type ColumnMap = {
  nameCol: number;
  qtyCol: number;
  coeffCol: number;
  priceCol: number;
  amountCol: number;
};

export type ParsedCell = {
  text: string;
  formula?: string;
  numeric: number | null;
};

export type SheetMatrix = ParsedCell[][];

export type DetectedBlock = {
  id: string;
  titleRow: number;
  headerRow: number;
  endRow: number;
};
