import { useStudioUiStore } from "@/lib/ui/store";

describe("studio ui store", () => {
  beforeEach(() => {
    localStorage.clear();
    useStudioUiStore.setState({
      theme: "dark",
      leftRailCollapsed: false,
      rightPanelOpen: true,
      activeControlSection: "transform",
    });
  });

  it("toggles theme and shell state", () => {
    useStudioUiStore.getState().toggleTheme();
    useStudioUiStore.getState().toggleLeftRail();
    useStudioUiStore.getState().toggleRightPanel();
    useStudioUiStore.getState().setActiveControlSection("trail");

    const state = useStudioUiStore.getState();

    expect(state.theme).toBe("light");
    expect(state.leftRailCollapsed).toBe(true);
    expect(state.rightPanelOpen).toBe(false);
    expect(state.activeControlSection).toBe("trail");
  });
});
