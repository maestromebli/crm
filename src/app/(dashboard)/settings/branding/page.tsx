import type { Metadata } from "next";
import { SettingsShell } from "../../../../components/settings/SettingsShell";
import { BrandingSettingsClient } from "./BrandingSettingsClient";

export const metadata: Metadata = {
  title: "Брендинг / UI · ENVER CRM",
};

export default function SettingsBrandingPage() {
  return (
    <SettingsShell
      title="Брендинг / UI"
      description="Логотип, кольори теми, щільність інтерфейсу та термінологія."
    >
      <BrandingSettingsClient />
    </SettingsShell>
  );
}
