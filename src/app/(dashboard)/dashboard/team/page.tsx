import type { Metadata } from "next";
import { ModuleWorkspace } from "../../../../components/module/ModuleWorkspace";

export const metadata: Metadata = {
  title: "Огляд команди · ENVER CRM",
};

export default function DashboardTeamPage() {
  return <ModuleWorkspace pathname="/dashboard/team" />;
}
