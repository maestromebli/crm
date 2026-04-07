import { buildModulePath } from "../../lib/navigation-resolve";

export type TargetViewId =
  | "overview"
  | "campaigns"
  | "adsets"
  | "ads"
  | "creatives"
  | "spend"
  | "leads"
  | "attribution"
  | "sync"
  | "invalid";

const SEGMENT_TO_VIEW: Record<string, Exclude<TargetViewId, "overview" | "invalid">> = {
  campaigns: "campaigns",
  adsets: "adsets",
  ads: "ads",
  creatives: "creatives",
  spend: "spend",
  leads: "leads",
  attribution: "attribution",
  sync: "sync",
};

export function resolveTargetRoute(slug?: string[]): {
  view: TargetViewId;
  pathname: string;
} {
  const pathname = buildModulePath("/target", slug);
  const first = slug?.[0];
  if (!first) return { view: "overview", pathname: "/target" };
  const view = SEGMENT_TO_VIEW[first];
  if (!view) return { view: "invalid", pathname };
  return { view, pathname };
}
