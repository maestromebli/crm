import type { OrderContractGate } from "../lib/contract-gates";

const COPY: Record<OrderContractGate, string> = {
  NO_CONTRACT: "Договір обов'язковий перед запуском у виробництво.",
  DRAFT_CONTRACT: "Договір створено, але ще не випущено/не підписано.",
  CONTRACT_SENT: "Договір надіслано на підпис. Очікуємо клієнта.",
  CONTRACT_SIGNED: "",
  CONTRACT_PROBLEM: "У договорі є блокуюча проблема. Усуньте її перед продовженням.",
};

export function ContractGateBanner({ gate }: { gate: OrderContractGate }) {
  if (gate === "CONTRACT_SIGNED") return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {COPY[gate]}
    </div>
  );
}
