import { useStudioUiStore } from "@/lib/ui/store";

describe("studio ui store", () => {
  beforeEach(() => {
    localStorage.clear();
    useStudioUiStore.setState({
      theme: "dark",
      leftDrawerOpen: true,
      rightDrawerOpen: true,
      activeControlSection: "transform",
      activeMobileDrawer: null,
    });
  });

  it("toggles theme and shell state", () => {
    useStudioUiStore.getState().toggleTheme();
    useStudioUiStore
      .getState()
      .setDrawerState({ leftDrawerOpen: false, rightDrawerOpen: false, activeMobileDrawer: "right" });
    useStudioUiStore.getState().setActiveControlSection("trail");

    const state = useStudioUiStore.getState();

    expect(state.theme).toBe("light");
    expect(state.leftDrawerOpen).toBe(false);
    expect(state.rightDrawerOpen).toBe(false);
    expect(state.activeControlSection).toBe("trail");
    expect(state.activeMobileDrawer).toBe("right");
  });
});
