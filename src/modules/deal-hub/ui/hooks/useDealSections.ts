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

export function useDealSections(initialSection: DealHubSectionId = "overview") {
  const [activeSection, setActiveSection] = useState<DealHubSectionId>(initialSection);
  const sections = useMemo(
    () =>
      DEAL_HUB_SECTIONS.map((id) => ({
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
      })),
    [],
  );
  return {
    sections,
    activeSection,
    setActiveSection,
  };
}
