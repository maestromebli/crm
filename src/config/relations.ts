export type RelationSource =
  | "lead"
  | "contact"
  | "deal"
  | "handoff"
  | "conversation";

export type RelationTarget =
  | "contact"
  | "deal"
  | "lead"
  | "handoff"
  | "production";

export type RelationDisplay =
  | "badge"
  | "card"
  | "selector"
  | "side-panel";

export type RelationConfig = {
  id: string;
  source: RelationSource;
  target: RelationTarget;
  display: RelationDisplay;
  createInline: boolean;
  openLinked: boolean;
};

export const RELATIONS: RelationConfig[] = [
  {
    id: "lead-contact",
    source: "lead",
    target: "contact",
    display: "selector",
    createInline: true,
    openLinked: true,
  },
  {
    id: "lead-deal",
    source: "lead",
    target: "deal",
    display: "selector",
    createInline: true,
    openLinked: true,
  },
  {
    id: "deal-handoff",
    source: "deal",
    target: "handoff",
    display: "card",
    createInline: true,
    openLinked: true,
  },
  {
    id: "conversation-lead",
    source: "conversation",
    target: "lead",
    display: "badge",
    createInline: true,
    openLinked: true,
  },
  {
    id: "conversation-deal",
    source: "conversation",
    target: "deal",
    display: "badge",
    createInline: true,
    openLinked: true,
  },
];

