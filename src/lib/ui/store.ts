"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { StudioUiSection, StudioUiState, ThemeMode } from "@/lib/ui/types";

export const UI_STORAGE_KEY = "studi03d-ui-store";

const DEFAULT_UI_STATE: StudioUiState = {
  theme: "dark",
  leftRailCollapsed: false,
  rightPanelOpen: true,
  activeControlSection: "transform",
};

interface StudioUiStore extends StudioUiState {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLeftRailCollapsed: (collapsed: boolean) => void;
  toggleLeftRail: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setActiveControlSection: (section: StudioUiSection) => void;
}

export const useStudioUiStore = create<StudioUiStore>()(
  persist(
    (set) => ({
      ...DEFAULT_UI_STATE,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "dark" ? "light" : "dark",
        })),
      setLeftRailCollapsed: (leftRailCollapsed) => set({ leftRailCollapsed }),
      toggleLeftRail: () =>
        set((state) => ({
          leftRailCollapsed: !state.leftRailCollapsed,
        })),
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
      toggleRightPanel: () =>
        set((state) => ({
          rightPanelOpen: !state.rightPanelOpen,
        })),
      setActiveControlSection: (activeControlSection) => set({ activeControlSection }),
    }),
    {
      name: UI_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        leftRailCollapsed: state.leftRailCollapsed,
        rightPanelOpen: state.rightPanelOpen,
        activeControlSection: state.activeControlSection,
      }),
    },
  ),
);
