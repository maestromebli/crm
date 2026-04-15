import type { ProductionCommandCenterView } from "../../types/production";
import { ProductionCommandCenter } from "./ProductionCommandCenter";

export function ProductionCommandCenterPage({ data }: { data: ProductionCommandCenterView }) {
  return <ProductionCommandCenter data={data} />;
}
