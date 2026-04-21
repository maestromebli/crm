import type { ReactNode } from "react";
import { ErpBridgeProvider } from "@/components/erp/ErpBridgeProvider";
import { NewAssistantWidget } from "@/components/layout/NewAssistantWidget";

/**
 * Окремий корпус для `/crm/*`, щоб уникнути змішування модулів з іншими сегментами
 * (Turbopack: «module factory is not available» на вкладених маршрутах).
 */
export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <ErpBridgeProvider>
      {children}
      <NewAssistantWidget />
    </ErpBridgeProvider>
  );
}
