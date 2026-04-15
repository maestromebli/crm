export const ENVER_DOMAINS = {
  LEAD: "LEAD",
  DEAL: "DEAL",
  PRODUCTION: "PRODUCTION",
  PROCUREMENT: "PROCUREMENT",
  FINANCE: "FINANCE",
} as const;

export type EnverDomain = (typeof ENVER_DOMAINS)[keyof typeof ENVER_DOMAINS];

export const WORKFLOW_STATES = {
  LEAD: ["NEW", "QUALIFIED", "PROPOSAL_READY", "CONVERTED"] as const,
  DEAL: ["OPEN", "CONTRACT_SIGNED", "PAYMENT_70", "HANDOFF_READY", "WON"] as const,
  PRODUCTION: ["QUEUED", "ACTIVE", "DONE"] as const,
  PROCUREMENT: ["NOT_STARTED", "REQUESTED", "ORDERED", "FULFILLED"] as const,
  FINANCE: ["PENDING", "INVOICED", "PARTIALLY_PAID", "PAID"] as const,
} as const;

type WorkflowState<D extends EnverDomain> = (typeof WORKFLOW_STATES)[D][number];

type TransitionMap = {
  [K in EnverDomain]: Record<WorkflowState<K>, readonly WorkflowState<K>[]>;
};

export const WORKFLOW_TRANSITIONS: TransitionMap = {
  LEAD: {
    NEW: ["QUALIFIED"],
    QUALIFIED: ["PROPOSAL_READY"],
    PROPOSAL_READY: ["CONVERTED"],
    CONVERTED: [],
  },
  DEAL: {
    OPEN: ["CONTRACT_SIGNED"],
    CONTRACT_SIGNED: ["PAYMENT_70"],
    PAYMENT_70: ["HANDOFF_READY"],
    HANDOFF_READY: ["WON"],
    WON: [],
  },
  PRODUCTION: {
    QUEUED: ["ACTIVE"],
    ACTIVE: ["DONE"],
    DONE: [],
  },
  PROCUREMENT: {
    NOT_STARTED: ["REQUESTED"],
    REQUESTED: ["ORDERED"],
    ORDERED: ["FULFILLED"],
    FULFILLED: [],
  },
  FINANCE: {
    PENDING: ["INVOICED"],
    INVOICED: ["PARTIALLY_PAID", "PAID"],
    PARTIALLY_PAID: ["PAID"],
    PAID: [],
  },
};

export const CROSS_DOMAIN_GATES = [
  {
    from: "LEAD.CONVERTED",
    to: "DEAL.OPEN",
    gate: "lead-to-deal-conversion",
  },
  {
    from: "DEAL.PAYMENT_70",
    to: "PRODUCTION.QUEUED",
    gate: "payment-precondition",
  },
  {
    from: "PRODUCTION.ACTIVE",
    to: "PROCUREMENT.ORDERED",
    gate: "materials-commitment",
  },
  {
    from: "DEAL.CONTRACT_SIGNED",
    to: "FINANCE.INVOICED",
    gate: "invoice-ready",
  },
] as const;

export function isAllowedDomainTransition<D extends EnverDomain>(
  domain: D,
  from: WorkflowState<D>,
  to: WorkflowState<D>,
): boolean {
  return WORKFLOW_TRANSITIONS[domain][from].includes(to);
}

export function getCanonicalWorkflowGovernance() {
  return {
    version: "v1",
    domains: ENVER_DOMAINS,
    states: WORKFLOW_STATES,
    transitions: WORKFLOW_TRANSITIONS,
    crossDomainGates: CROSS_DOMAIN_GATES,
  };
}

