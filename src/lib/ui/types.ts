export type ThemeMode = "dark" | "light";

export type StudioUiSection = "transform" | "appearance" | "trail" | "export";

export type StudioDrawerSide = "left" | "right";

export interface StudioUiState {
  theme: ThemeMode;
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  activeControlSection: StudioUiSection;
  activeMobileDrawer: StudioDrawerSide | null;
}
