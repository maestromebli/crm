"use client";

import { create } from "zustand";
import type { LeadHubPricingItem, LeadHubSessionDto } from "../domain/types";

type LeadHubState = {
  session: LeadHubSessionDto | null;
  pricingState: LeadHubPricingItem[];
  files: LeadHubSessionDto["files"];
  images: LeadHubSessionDto["files"];
  loading: boolean;
  dirtyItemIds: string[];
  syncState: {
    isSaving: boolean;
    pendingChanges: boolean;
    lastSavedAt?: number;
    lastError?: string;
  };
  aiState: { lastAction?: string; isRunning: boolean };
  parseState: { lastParsedType?: "image" | "excel" | "pdf"; isParsing: boolean };
  setSession: (session: LeadHubSessionDto) => void;
  setPricingData: (items: LeadHubPricingItem[]) => void;
  updateItem: (itemId: string, patch: Partial<LeadHubPricingItem>) => void;
  addItem: () => void;
  removeItem: (itemId: string) => void;
  setFiles: (files: LeadHubSessionDto["files"]) => void;
  setImages: (images: LeadHubSessionDto["files"]) => void;
  applyAIResult: (items: LeadHubPricingItem[], action: string) => void;
  applyParsedTemplate: (payload: {
    items: LeadHubPricingItem[];
    source: "image" | "excel" | "pdf";
  }) => void;
  clearDirtyItems: () => void;
  setSyncState: (patch: Partial<LeadHubState["syncState"]>) => void;
  triggerRecalculation: () => void;
};

export const useLeadHubStore = create<LeadHubState>((set, get) => ({
  session: null,
  pricingState: [],
  files: [],
  images: [],
  loading: false,
  dirtyItemIds: [],
  syncState: { isSaving: false, pendingChanges: false },
  aiState: { isRunning: false },
  parseState: { isParsing: false },
  setSession: (session) =>
    set({
      session,
      pricingState: session.items,
      files: session.files,
      images: session.files.filter((file) => file.role === "IMAGE"),
      dirtyItemIds: [],
      syncState: { isSaving: false, pendingChanges: false },
    }),
  setPricingData: (items) =>
    set({
      pricingState: items,
      syncState: { ...get().syncState, pendingChanges: true },
    }),
  updateItem: (itemId, patch) =>
    set((state) => ({
      pricingState: state.pricingState.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
      dirtyItemIds: state.dirtyItemIds.includes(itemId)
        ? state.dirtyItemIds
        : [...state.dirtyItemIds, itemId],
      syncState: { ...state.syncState, pendingChanges: true },
    })),
  addItem: () =>
    set((state) => {
      const created: LeadHubPricingItem = {
        id: crypto.randomUUID(),
        name: "New line",
        quantity: 1,
        unitCost: 0,
        unitPrice: 0,
        category: "CUSTOM",
      };
      return {
        pricingState: [...state.pricingState, created],
        dirtyItemIds: state.dirtyItemIds.includes(created.id)
          ? state.dirtyItemIds
          : [...state.dirtyItemIds, created.id],
        syncState: { ...state.syncState, pendingChanges: true },
      };
    }),
  removeItem: (itemId) =>
    set((state) => ({
      pricingState: state.pricingState.filter((item) => item.id !== itemId),
      dirtyItemIds: state.dirtyItemIds.filter((id) => id !== itemId),
      syncState: { ...state.syncState, pendingChanges: true },
    })),
  setFiles: (files) =>
    set((state) => ({
      files,
      session: state.session ? { ...state.session, files } : state.session,
    })),
  setImages: (images) => set({ images }),
  applyAIResult: (items, action) =>
    set({
      pricingState: items,
      aiState: { isRunning: false, lastAction: action },
      dirtyItemIds: items.map((item) => item.id),
      syncState: { ...get().syncState, pendingChanges: true },
    }),
  applyParsedTemplate: ({ items, source }) =>
    set({
      pricingState: items,
      parseState: { isParsing: false, lastParsedType: source },
      dirtyItemIds: items.map((item) => item.id),
      syncState: { ...get().syncState, pendingChanges: true },
    }),
  clearDirtyItems: () => set(() => ({ dirtyItemIds: [] })),
  setSyncState: (patch) =>
    set((state) => ({ syncState: { ...state.syncState, ...patch } })),
  triggerRecalculation: () => {
    const state = get();
    set({
      pricingState: [...state.pricingState],
      syncState: { ...state.syncState, pendingChanges: true },
    });
  },
}));
