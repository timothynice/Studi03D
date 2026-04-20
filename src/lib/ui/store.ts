"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { StudioDrawerSide, StudioUiSection, StudioUiState, ThemeMode } from "@/lib/ui/types";

export const UI_STORAGE_KEY = "studi03d-ui-store";

const DEFAULT_UI_STATE: StudioUiState = {
  theme: "dark",
  leftDrawerOpen: true,
  rightDrawerOpen: true,
  activeControlSection: "transform",
  activeMobileDrawer: null,
};

interface StudioUiStore extends StudioUiState {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setDrawerState: (
    patch: Partial<Pick<StudioUiState, "leftDrawerOpen" | "rightDrawerOpen" | "activeMobileDrawer">>,
  ) => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setRightDrawerOpen: (open: boolean) => void;
  setActiveMobileDrawer: (drawer: StudioDrawerSide | null) => void;
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
      setDrawerState: (patch) => set(patch),
      setLeftDrawerOpen: (leftDrawerOpen) => set({ leftDrawerOpen }),
      setRightDrawerOpen: (rightDrawerOpen) => set({ rightDrawerOpen }),
      setActiveMobileDrawer: (activeMobileDrawer) => set({ activeMobileDrawer }),
      setActiveControlSection: (activeControlSection) => set({ activeControlSection }),
    }),
    {
      name: UI_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return DEFAULT_UI_STATE;
        }

        if (version < 2) {
          const legacyState = persistedState as Partial<{
            theme: ThemeMode;
            leftRailCollapsed: boolean;
            rightPanelOpen: boolean;
            activeControlSection: StudioUiSection;
          }>;

          return {
            theme: legacyState.theme ?? DEFAULT_UI_STATE.theme,
            leftDrawerOpen:
              typeof legacyState.leftRailCollapsed === "boolean"
                ? !legacyState.leftRailCollapsed
                : DEFAULT_UI_STATE.leftDrawerOpen,
            rightDrawerOpen: legacyState.rightPanelOpen ?? DEFAULT_UI_STATE.rightDrawerOpen,
            activeControlSection:
              legacyState.activeControlSection ?? DEFAULT_UI_STATE.activeControlSection,
            activeMobileDrawer: null,
          };
        }

        const nextState = persistedState as Partial<StudioUiState>;

        return {
          theme: nextState.theme ?? DEFAULT_UI_STATE.theme,
          leftDrawerOpen: nextState.leftDrawerOpen ?? DEFAULT_UI_STATE.leftDrawerOpen,
          rightDrawerOpen: nextState.rightDrawerOpen ?? DEFAULT_UI_STATE.rightDrawerOpen,
          activeControlSection:
            nextState.activeControlSection ?? DEFAULT_UI_STATE.activeControlSection,
          activeMobileDrawer: nextState.activeMobileDrawer ?? DEFAULT_UI_STATE.activeMobileDrawer,
        };
      },
      partialize: (state) => ({
        theme: state.theme,
        leftDrawerOpen: state.leftDrawerOpen,
        rightDrawerOpen: state.rightDrawerOpen,
        activeControlSection: state.activeControlSection,
        activeMobileDrawer: state.activeMobileDrawer,
      }),
    },
  ),
);
