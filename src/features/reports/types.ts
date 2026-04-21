export const REPORT_SECTIONS = [
  "sales",
  "conversion",
  "team",
  "load",
  "installations",
  "sla",
  "files",
  "custom",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const REPORT_RANGES = ["7d", "30d", "90d"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export type ReportKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type ReportChartPoint = {
  label: string;
  value: number;
};

export type ReportRow = {
  id: string;
  label: string;
  primary: string;
  secondary?: string;
};

export type ReportPayload = {
  section: ReportSection;
  range: ReportRange;
  generatedAt: string;
  title: string;
  subtitle: string;
  kpis: ReportKpi[];
  chart: ReportChartPoint[];
  rows: ReportRow[];
  highlights: string[];
};
