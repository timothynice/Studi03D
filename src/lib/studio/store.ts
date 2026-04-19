"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STORAGE_KEY, STORAGE_VERSION } from "@/lib/studio/constants";
import {
  createDraft,
  createInitialDraftState,
  deleteDraft,
  ensureDraftState,
  getActiveDocument,
  openDraft,
  renameDraft,
  updateActiveAsset,
  updateActiveControls,
} from "@/lib/studio/state";
import type { DraftStateCore } from "@/lib/studio/state";
import type { NormalizedSvgAsset, StudioDocument, StudioControls } from "@/lib/studio/types";

interface StudioStoreState extends DraftStateCore {
  createDraft: (name?: string) => void;
  openDraft: (id: string) => void;
  renameDraft: (id: string, name: string) => void;
  deleteDraft: (id: string) => void;
  setActiveAsset: (asset: NormalizedSvgAsset | null) => void;
  updateActiveControls: (patch: Partial<StudioControls>) => void;
}

function createStoreState(set: (updater: (state: DraftStateCore) => DraftStateCore) => void): StudioStoreState {
  const initialState = createInitialDraftState();

  return {
    ...initialState,
    createDraft: (name) => set((state) => createDraft(state, name)),
    openDraft: (id) => set((state) => openDraft(state, id)),
    renameDraft: (id, name) => set((state) => renameDraft(state, id, name)),
    deleteDraft: (id) => set((state) => deleteDraft(state, id)),
    setActiveAsset: (asset) => set((state) => updateActiveAsset(state, asset)),
    updateActiveControls: (patch) => set((state) => updateActiveControls(state, patch)),
  };
}

export const useStudioStore = create<StudioStoreState>()(
  persist(
    (set) => createStoreState(set),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => ensureDraftState(persistedState as DraftStateCore),
      partialize: (state) => ({
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
        draftSequence: state.draftSequence,
      }),
    },
  ),
);

export function useActiveStudioDocument(): StudioDocument {
  return useStudioStore((state) => getActiveDocument(state));
}
