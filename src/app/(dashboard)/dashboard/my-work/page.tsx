import type { Metadata } from "next";
import { ModuleWorkspace } from "../../../../components/module/ModuleWorkspace";

export const metadata: Metadata = {
  title: "My work · ENVER CRM",
};

export default function DashboardMyWorkPage() {
  return <ModuleWorkspace pathname="/dashboard/my-work" />;
}
