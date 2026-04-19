import { createDefaultControls } from "@/lib/studio/constants";
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
import { PLACEHOLDER_ASSET } from "@/lib/studio/constants";

describe("draft state helpers", () => {
  it("creates and opens a new draft", () => {
    const initialState = createInitialDraftState();
    const withNewDraft = createDraft(initialState, "Hero Card");

    expect(withNewDraft.documents).toHaveLength(2);
    expect(getActiveDocument(withNewDraft).name).toBe("Hero Card");

    const reopened = openDraft(withNewDraft, initialState.documents[0]!.id);
    expect(getActiveDocument(reopened).id).toBe(initialState.documents[0]!.id);
  });

  it("renames, updates, and deletes drafts", () => {
    const initialState = createInitialDraftState();
    const activeId = initialState.activeDocumentId;
    const renamedState = renameDraft(initialState, activeId, "Orbit");
    const withAsset = updateActiveAsset(renamedState, PLACEHOLDER_ASSET);
    const withControls = updateActiveControls(withAsset, {
      artColor: "#ff00ff",
      trailCount: 2,
    });

    expect(getActiveDocument(withControls).name).toBe("Orbit");
    expect(getActiveDocument(withControls).asset).not.toBeNull();
    expect(getActiveDocument(withControls).controls.artColor).toBe("#ff00ff");
    expect(getActiveDocument(withControls).controls.trailCount).toBe(2);

    const resetState = deleteDraft(withControls, activeId);
    expect(resetState.documents).toHaveLength(1);
    expect(getActiveDocument(resetState).controls).toEqual(createDefaultControls());
  });

  it("repairs invalid persisted state", () => {
    const repaired = ensureDraftState({
      documents: createInitialDraftState().documents,
      activeDocumentId: "missing",
      draftSequence: 0,
    });

    expect(repaired.activeDocumentId).toBe(repaired.documents[0]!.id);
    expect(repaired.draftSequence).toBeGreaterThan(0);
    expect(repaired.documents[0]?.controls.strokeScale).toBe(1);
  });
});
