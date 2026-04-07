import type { Metadata } from "next";
import { ErpCommandCenterClient } from "./ErpCommandCenterClient";

export const metadata: Metadata = {
  title: "ERP Command Center",
  description: "Єдиний штаб ERP: approval trail, timeline, ризики та крос-модульний контроль.",
};

export default function ErpCommandCenterPage() {
  return <ErpCommandCenterClient />;
}
