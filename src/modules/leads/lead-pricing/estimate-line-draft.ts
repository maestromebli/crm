import type { EstimateLineBreakdownMeta } from "../../../lib/estimates/estimate-line-breakdown";
import type {
  FurnitureBlockKind,
  KitchenLineRole,
} from "../../../lib/estimates/kitchen-cost-sheet-template";

export type LineType =
  | "PRODUCT"
  | "SERVICE"
  | "DELIVERY"
  | "INSTALLATION"
  | "DISCOUNT"
  | "OTHER";

export type EstimateLineDraft = {
  id: string;
  type: LineType;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice?: number | null;
  amountSale: number;
  amountCost?: number | null;
  metadataJson?: EstimateLineBreakdownMeta | null;
  /** Кухонний лист: коеф. у формулі суми */
  coefficient?: number;
  kitchenRole?: KitchenLineRole;
  rowStyle?: "tan" | "orange";
  groupId?: string;
  groupLabel?: string;
  groupIcon?: string;
  templateKey?: string;
  /** Тип меблевого блоку (кухня, шафа, …) — окремі таблиці */
  furnitureBlockKind?: FurnitureBlockKind;
  /** Назва розрахункової таблиці (заголовок над таблицею) */
  tableTitle?: string;
  /** Переоцінка клієнтської ціни для кухонних таблиць (необов'язково). */
  kitchenClientPriceMultiplier?: number;
  /** Націнка на матеріали для кухонних таблиць (необов'язково). */
  kitchenMaterialMarkupPercent?: number;
};
