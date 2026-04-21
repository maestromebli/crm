"use client";

import { useMemo, useState } from "react";

const DEAL_HUB_SECTIONS = [
  "overview",
  "pricing",
  "contract",
  "measurement",
  "constructor",
  "production",
  "procurement",
  "logistics",
  "installation",
  "finance",
  "documents",
  "communication",
  "timeline",
] as const;

export type DealHubSectionId = (typeof DEAL_HUB_SECTIONS)[number];
const DEAL_HUB_SECTION_LABELS: Record<DealHubSectionId, string> = {
  overview: "Огляд",
  pricing: "Ціноутворення",
  contract: "Договір",
  measurement: "Замір",
  constructor: "Конструктор",
  production: "Виробництво",
  procurement: "Закупівля",
  logistics: "Логістика",
  installation: "Монтаж",
  finance: "Фінанси",
  documents: "Документи",
  communication: "Комунікація",
  timeline: "Таймлайн",
};

export function useDealSections(initialSection: DealHubSectionId = "overview") {
  const [activeSection, setActiveSection] = useState<DealHubSectionId>(initialSection);
  const sections = useMemo(
    () =>
      DEAL_HUB_SECTIONS.map((id) => ({
        id,
        label: DEAL_HUB_SECTION_LABELS[id],
      })),
    [],
  );
  return {
    sections,
    activeSection,
    setActiveSection,
  };
}
