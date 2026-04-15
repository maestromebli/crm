import { create } from "zustand";

export type LeadWorkspaceTabId =
  | "communication"
  | "files"
  | "measurement"
  | "calculation"
  | "quote"
  | "notes";

type LeadWorkspaceSlice = {
  activeTab: LeadWorkspaceTabId;
  selectedEstimateId: string | null;
  selectedQuoteId: string | null;
  panelFlags: Record<string, boolean>;
  optimisticStageId: string | null;
  highlightedBlock: string | null;
  lastEvent: { name: string; at: number } | null;
};

function defaultSlice(): LeadWorkspaceSlice {
  return {
    activeTab: "communication",
    selectedEstimateId: null,
    selectedQuoteId: null,
    panelFlags: {},
    optimisticStageId: null,
    highlightedBlock: null,
    lastEvent: null,
  };
}

const DEFAULT_SLICE: LeadWorkspaceSlice = defaultSlice();

type LeadWorkspaceState = {
  slices: Record<string, LeadWorkspaceSlice>;
  ensureLead: (leadId: string) => void;
  setActiveTab: (leadId: string, tab: LeadWorkspaceTabId) => void;
  setSelectedEstimate: (leadId: string, id: string | null) => void;
  setSelectedQuote: (leadId: string, id: string | null) => void;
  setPanelFlag: (leadId: string, key: string, open: boolean) => void;
  setOptimisticStage: (leadId: string, stageId: string | null) => void;
  clearOptimisticStage: (leadId: string) => void;
  setHighlightedBlock: (leadId: string, key: string | null) => void;
  setLastEvent: (leadId: string, name: string) => void;
  getSlice: (leadId: string) => LeadWorkspaceSlice;
};

export const useLeadWorkspaceStore = create<LeadWorkspaceState>((set, get) => ({
  slices: {},
  ensureLead: (leadId) =>
    set((s) => {
      if (s.slices[leadId]) return s;
      return {
        slices: { ...s.slices, [leadId]: defaultSlice() },
      };
    }),
  setActiveTab: (leadId, tab) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: { ...(s.slices[leadId] ?? defaultSlice()), activeTab: tab },
      },
    })),
  setSelectedEstimate: (leadId, id) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: {
          ...(s.slices[leadId] ?? defaultSlice()),
          selectedEstimateId: id,
        },
      },
    })),
  setSelectedQuote: (leadId, id) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: {
          ...(s.slices[leadId] ?? defaultSlice()),
          selectedQuoteId: id,
        },
      },
    })),
  setPanelFlag: (leadId, key, open) =>
    set((s) => {
      const cur = s.slices[leadId] ?? defaultSlice();
      return {
        slices: {
          ...s.slices,
          [leadId]: {
            ...cur,
            panelFlags: { ...cur.panelFlags, [key]: open },
          },
        },
      };
    }),
  setOptimisticStage: (leadId, stageId) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: {
          ...(s.slices[leadId] ?? defaultSlice()),
          optimisticStageId: stageId,
        },
      },
    })),
  clearOptimisticStage: (leadId) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: {
          ...(s.slices[leadId] ?? defaultSlice()),
          optimisticStageId: null,
        },
      },
    })),
  setHighlightedBlock: (leadId, key) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: {
          ...(s.slices[leadId] ?? defaultSlice()),
          highlightedBlock: key,
        },
      },
    })),
  setLastEvent: (leadId, name) =>
    set((s) => ({
      slices: {
        ...s.slices,
        [leadId]: {
          ...(s.slices[leadId] ?? defaultSlice()),
          lastEvent: { name, at: Date.now() },
        },
      },
    })),
  getSlice: (leadId) => get().slices[leadId] ?? defaultSlice(),
}));

export function useLeadWorkspaceSlice(leadId: string) {
  const ensureLead = useLeadWorkspaceStore((s) => s.ensureLead);
  const slice = useLeadWorkspaceStore((s) => s.slices[leadId] ?? DEFAULT_SLICE);
  const setActiveTab = useLeadWorkspaceStore((s) => s.setActiveTab);
  const setSelectedEstimate = useLeadWorkspaceStore((s) => s.setSelectedEstimate);
  const setSelectedQuote = useLeadWorkspaceStore((s) => s.setSelectedQuote);
  const setOptimisticStage = useLeadWorkspaceStore((s) => s.setOptimisticStage);
  const clearOptimisticStage = useLeadWorkspaceStore((s) => s.clearOptimisticStage);
  const setHighlightedBlock = useLeadWorkspaceStore((s) => s.setHighlightedBlock);
  const setLastEvent = useLeadWorkspaceStore((s) => s.setLastEvent);

  return {
    slice,
    ensureLead,
    setActiveTab: (tab: LeadWorkspaceTabId) => {
      ensureLead(leadId);
      setActiveTab(leadId, tab);
    },
    setSelectedEstimate: (id: string | null) => {
      ensureLead(leadId);
      setSelectedEstimate(leadId, id);
    },
    setSelectedQuote: (id: string | null) => {
      ensureLead(leadId);
      setSelectedQuote(leadId, id);
    },
    setOptimisticStage: (stageId: string | null) => {
      ensureLead(leadId);
      setOptimisticStage(leadId, stageId);
    },
    clearOptimisticStage: () => {
      ensureLead(leadId);
      clearOptimisticStage(leadId);
    },
    setHighlightedBlock: (key: string | null) => {
      ensureLead(leadId);
      setHighlightedBlock(leadId, key);
    },
    setLastEvent: (name: string) => {
      ensureLead(leadId);
      setLastEvent(leadId, name);
    },
  };
}
