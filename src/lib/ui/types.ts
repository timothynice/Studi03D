export type ThemeMode = "dark" | "light";

export type StudioUiSection = "transform" | "trail" | "export";

export interface StudioUiState {
  theme: ThemeMode;
  leftRailCollapsed: boolean;
  rightPanelOpen: boolean;
  activeControlSection: StudioUiSection;
}
