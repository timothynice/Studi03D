import {
  createDefaultControls,
  createDefaultTrailPattern,
  TRAIL_PATTERN_SIZE,
} from "@/lib/studio/constants";
import { createStudioId } from "@/lib/studio/id";
import type {
  NormalizedSvgAsset,
  StudioControls,
  StudioDocument,
  TrailPatternCell,
} from "@/lib/studio/types";

export interface DraftStateCore {
  documents: StudioDocument[];
  activeDocumentId: string;
  draftSequence: number;
}

function nowIsoString() {
  return new Date().toISOString();
}

function createDraftLabel(sequence: number) {
  return `Draft ${sequence}`;
}

function normalizeTrailPattern(pattern?: TrailPatternCell[]) {
  const fallback = createDefaultTrailPattern();

  return Array.from({ length: TRAIL_PATTERN_SIZE }, (_, index) => {
    const existing = pattern?.[index];
    const base = fallback[index];

    return {
      enabled: existing?.enabled ?? base.enabled,
      opacity: typeof existing?.opacity === "number" ? existing.opacity : base.opacity,
      matte: existing?.matte ?? base.matte,
    };
  });
}

export function normalizeControls(controls?: Partial<StudioControls> | null): StudioControls {
  const defaults = createDefaultControls();

  return {
    ...defaults,
    ...controls,
    trailPattern: normalizeTrailPattern(controls?.trailPattern),
  };
}

export function createDraftDocument(sequence: number, name = createDraftLabel(sequence)): StudioDocument {
  const timestamp = nowIsoString();

  return {
    id: createStudioId(),
    name,
    asset: null,
    controls: createDefaultControls(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createInitialDraftState(): DraftStateCore {
  const initialDocument = createDraftDocument(1);

  return {
    documents: [initialDocument],
    activeDocumentId: initialDocument.id,
    draftSequence: 2,
  };
}

export function ensureDraftState(state?: Partial<DraftStateCore> | null): DraftStateCore {
  const fallback = createInitialDraftState();
  const documents = state?.documents?.length
    ? state.documents.map((document) => ({
        ...document,
        controls: normalizeControls(document.controls),
      }))
    : fallback.documents;
  const activeDocumentId =
    state?.activeDocumentId && documents.some((document) => document.id === state.activeDocumentId)
      ? state.activeDocumentId
      : documents[0].id;

  return {
    documents,
    activeDocumentId,
    draftSequence:
      typeof state?.draftSequence === "number" && state.draftSequence > 0
        ? state.draftSequence
        : fallback.draftSequence,
  };
}

function touchDocument(document: StudioDocument, overrides: Partial<StudioDocument>) {
  return {
    ...document,
    ...overrides,
    updatedAt: nowIsoString(),
  };
}

function updateDocumentById(
  state: DraftStateCore,
  id: string,
  updater: (document: StudioDocument) => StudioDocument,
): DraftStateCore {
  return {
    ...state,
    documents: state.documents.map((document) => (document.id === id ? updater(document) : document)),
  };
}

export function getActiveDocument(state: DraftStateCore) {
  return state.documents.find((document) => document.id === state.activeDocumentId) ?? state.documents[0];
}

export function createDraft(state: DraftStateCore, name?: string): DraftStateCore {
  const nextSequence = state.draftSequence;
  const draft = createDraftDocument(nextSequence, name?.trim() || createDraftLabel(nextSequence));

  return {
    documents: [draft, ...state.documents],
    activeDocumentId: draft.id,
    draftSequence: nextSequence + 1,
  };
}

export function openDraft(state: DraftStateCore, id: string): DraftStateCore {
  if (!state.documents.some((document) => document.id === id)) {
    return state;
  }

  return {
    ...state,
    activeDocumentId: id,
  };
}

export function renameDraft(state: DraftStateCore, id: string, name: string): DraftStateCore {
  const nextName = name.trim();

  if (!nextName) {
    return state;
  }

  return updateDocumentById(state, id, (document) => touchDocument(document, { name: nextName }));
}

export function deleteDraft(state: DraftStateCore, id: string): DraftStateCore {
  const remainingDocuments = state.documents.filter((document) => document.id !== id);

  if (!remainingDocuments.length) {
    return createInitialDraftState();
  }

  return {
    ...state,
    documents: remainingDocuments,
    activeDocumentId:
      state.activeDocumentId === id ? remainingDocuments[0].id : state.activeDocumentId,
  };
}

export function updateActiveAsset(state: DraftStateCore, asset: NormalizedSvgAsset | null): DraftStateCore {
  const activeDocument = getActiveDocument(state);

  return updateDocumentById(state, activeDocument.id, (document) => touchDocument(document, { asset }));
}

export function updateActiveControls(
  state: DraftStateCore,
  patch: Partial<StudioControls>,
): DraftStateCore {
  const activeDocument = getActiveDocument(state);

  return updateDocumentById(state, activeDocument.id, (document) =>
    touchDocument(document, {
      controls: normalizeControls({
        ...document.controls,
        ...patch,
      }),
    }),
  );
}
