import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { PipelineSettingsClient } from "./PipelineSettingsClient";

export const metadata: Metadata = {
  title: "Воронки та стадії · ENVER CRM",
};

export default function SettingsPipelinesPage() {
  return (
    <SettingsShell
      title="Воронки та стадії"
      description="Налаштуйте воронки продажів, виробництва та передачі у виробництво, а також їхні стадії."
    >
      <PipelineSettingsClient />
    </SettingsShell>
  );
}

