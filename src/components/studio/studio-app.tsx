"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";

import {
  createDefaultControls,
  PLACEHOLDER_ASSET,
  PROJECTION_PRESETS,
  WARNING_COPY,
} from "@/lib/studio/constants";
import { exportTransparentPng, exportTransparentSvg } from "@/lib/studio/export";
import { normalizeImportedSvg } from "@/lib/studio/svg-normalize";
import { buildPreviewMarkup } from "@/lib/studio/svg-scene";
import { useActiveStudioDocument, useStudioStore } from "@/lib/studio/store";
import type { StudioControls, TrailPatternCell } from "@/lib/studio/types";
import { UI_STORAGE_KEY, useStudioUiStore } from "@/lib/ui/store";
import type { StudioUiSection, ThemeMode } from "@/lib/ui/types";

const MOBILE_MAX = 899;
const TABLET_MAX = 1279;

type ViewportMode = "desktop" | "tablet" | "mobile";

function getViewportMode(width: number): ViewportMode {
  if (width <= MOBILE_MAX) {
    return "mobile";
  }

  if (width <= TABLET_MAX) {
    return "tablet";
  }

  return "desktop";
}

function toFieldId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatNumericValue(value: number) {
  return Number(value.toFixed(3));
}

function InfoTip({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tooltipId = useId();

  return (
    <span className="studio-tooltip-wrap">
      <button
        aria-describedby={tooltipId}
        aria-label="More information"
        className="studio-tooltip-trigger"
        type="button"
      >
        <span aria-hidden="true">i</span>
      </button>
      <span id={tooltipId} role="tooltip" className="studio-tooltip-content">
        {children}
      </span>
    </span>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  tooltip,
}: Readonly<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  tooltip?: React.ReactNode;
}>) {
  const fieldId = toFieldId(label);

  return (
    <div className="studio-range-field">
      <div className="studio-range-header">
        <span className="studio-field-heading">
          <label htmlFor={`${fieldId}-number`}>{label}</label>
          {tooltip ? <InfoTip>{tooltip}</InfoTip> : null}
        </span>
        <input
          id={`${fieldId}-number`}
          aria-label={label}
          className="studio-input"
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={formatNumericValue(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <input
        aria-label={`${label} slider`}
        className="studio-range"
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  tooltip,
}: Readonly<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: React.ReactNode;
}>) {
  return (
    <label className="studio-toggle-field">
      <span className="studio-toggle-copy">
        <strong>{label}</strong>
        {tooltip ? <InfoTip>{tooltip}</InfoTip> : null}
      </span>
      <span className="studio-toggle-control">
        <input
          aria-label={label}
          className="studio-toggle-input"
          checked={checked}
          type="checkbox"
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" className="studio-toggle-switch" />
      </span>
    </label>
  );
}

function WarningList({ warnings }: Readonly<{ warnings: string[] }>) {
  if (!warnings.length) {
    return null;
  }

  return (
    <div aria-live="polite" className="studio-warning-list">
      {warnings.map((warning) => (
        <p key={warning} className="studio-alert studio-alert-warning">
          {warning}
        </p>
      ))}
    </div>
  );
}

function RailWidget({
  title,
  info,
  actionLabel,
  onAction,
  children,
}: Readonly<{
  title: string;
  info?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}>) {
  return (
    <section className="studio-rail-widget">
      <div className="studio-rail-widget-head">
        <div className="studio-rail-heading">
          <p className="studio-rail-title">{title}</p>
          {info ? <InfoTip>{info}</InfoTip> : null}
        </div>
        {actionLabel && onAction ? (
          <button className="studio-rail-icon-button" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="studio-rail-widget-body">{children}</div>
    </section>
  );
}

function DrawerSection({
  title,
  info,
  children,
}: Readonly<{
  title: string;
  info?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="studio-drawer-section">
      <div className="studio-drawer-section-head">
        <div className="studio-rail-heading">
          <p className="studio-rail-title">{title}</p>
          {info ? <InfoTip>{info}</InfoTip> : null}
        </div>
      </div>
      <div className="studio-drawer-section-body">{children}</div>
    </section>
  );
}

function ValueField({
  label,
  value,
  unit,
  emphasis = false,
}: Readonly<{
  label: string;
  value: string;
  unit?: string;
  emphasis?: boolean;
}>) {
  return (
    <div className={`studio-compact-field ${emphasis ? "is-emphasis" : ""}`}>
      <span className="studio-compact-field-label">{label}</span>
      <span className="studio-compact-field-value">
        {value}
        {unit ? <span className="studio-compact-field-unit">{unit}</span> : null}
      </span>
    </div>
  );
}

function SectionAction({
  label,
  active,
  onClick,
}: Readonly<{
  label: string;
  active: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      aria-pressed={active}
      className={`studio-section-action ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TrailPatternEditor({
  controls,
  selectedIndex,
  onSelect,
  onUpdate,
}: Readonly<{
  controls: StudioControls;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onUpdate: (nextCell: TrailPatternCell) => void;
}>) {
  const selectedCell = controls.trailPattern[selectedIndex];

  return (
    <div className="studio-control-group">
      <div className="studio-pattern-legend">
        <span>Near</span>
        <span>Far</span>
      </div>
      <div className="studio-slot-grid">
        {controls.trailPattern.map((cell, index) => {
          const isSelected = selectedIndex === index;

          return (
            <button
              key={index}
              className={`studio-slot-button ${cell.enabled ? "is-enabled" : ""} ${
                isSelected ? "is-active" : ""
              }`}
              type="button"
              onClick={() => onSelect(index)}
            >
              <span>{index + 1}</span>
              <span className="studio-slot-track" />
              {cell.matte ? <span className="studio-slot-note">Matte</span> : null}
            </button>
          );
        })}
      </div>

      <div className="studio-pattern-card">
        <div className="studio-compact-fields studio-compact-fields-two">
          <ValueField label="Slot" value={String(selectedIndex + 1)} />
          <ValueField label="State" value={selectedCell.enabled ? "On" : "Gap"} />
        </div>
        <ToggleField
          label="Active trail cell"
          checked={selectedCell.enabled}
          tooltip="Enable this slot to render a trail layer. Turn it off to leave a gap."
          onChange={(checked) => onUpdate({ ...selectedCell, enabled: checked })}
        />
        <RangeField
          label="Slot opacity"
          min={0}
          max={1}
          step={0.01}
          disabled={!selectedCell.enabled}
          value={selectedCell.opacity}
          tooltip="Override opacity for this slot when the custom trail row is active."
          onChange={(value) => onUpdate({ ...selectedCell, opacity: value })}
        />
        <ToggleField
          label="Dense / matte trail"
          checked={selectedCell.matte}
          tooltip="Add a denser underlay so this slot reads as a more solid layer."
          onChange={(checked) => onUpdate({ ...selectedCell, matte: checked })}
        />
      </div>
    </div>
  );
}

function StudioBrand({ theme }: Readonly<{ theme: ThemeMode }>) {
  const markSrc = theme === "dark" ? "/studi0/logo-mark-on-dark.svg" : "/studi0/logo-mark.svg";

  return (
    <Link className="studio-app-brand" href="/">
      <Image alt="" className="brand-mark" height={24} src={markSrc} unoptimized width={24} />
      <span className="studio-app-brand-copy">
        <span className="brand-name">Studi03D</span>
        <span className="brand-meta">Studio</span>
      </span>
    </Link>
  );
}

export function StudioApp() {
  const documents = useStudioStore((state) => state.documents);
  const createDraft = useStudioStore((state) => state.createDraft);
  const openDraft = useStudioStore((state) => state.openDraft);
  const renameDraft = useStudioStore((state) => state.renameDraft);
  const deleteDraft = useStudioStore((state) => state.deleteDraft);
  const setActiveAsset = useStudioStore((state) => state.setActiveAsset);
  const updateActiveControls = useStudioStore((state) => state.updateActiveControls);
  const activeDocument = useActiveStudioDocument();
  const deferredDocument = useDeferredValue(activeDocument);

  const theme = useStudioUiStore((state) => state.theme);
  const toggleTheme = useStudioUiStore((state) => state.toggleTheme);
  const leftDrawerOpen = useStudioUiStore((state) => state.leftDrawerOpen);
  const rightDrawerOpen = useStudioUiStore((state) => state.rightDrawerOpen);
  const activeControlSection = useStudioUiStore((state) => state.activeControlSection);
  const activeMobileDrawer = useStudioUiStore((state) => state.activeMobileDrawer);
  const setDrawerState = useStudioUiStore((state) => state.setDrawerState);
  const setActiveControlSection = useStudioUiStore((state) => state.setActiveControlSection);

  const previewAsset = deferredDocument.asset ?? PLACEHOLDER_ASSET;
  const previewMarkup = buildPreviewMarkup(previewAsset, deferredDocument.controls);
  const warningMessages = (activeDocument.asset?.warningCodes ?? []).map(
    (warningCode) => WARNING_COPY[warningCode],
  );

  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [pasteMarkup, setPasteMarkup] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startPendingTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTrailSlot, setSelectedTrailSlot] = useState(0);
  const hasPersistedDrawerStateRef = useRef<boolean | null>(null);
  const hasAppliedViewportDefaultsRef = useRef(false);

  const hasAsset = Boolean(activeDocument.asset);
  const enabledPatternCount = activeDocument.controls.trailPattern.filter((cell) => cell.enabled).length;
  const visibleTrailCount = activeDocument.controls.useCustomTrailPattern
    ? enabledPatternCount
    : activeDocument.controls.trailCount;

  const workspaceInsets = {
    "--studio-left-inset": viewportMode === "desktop" && leftDrawerOpen ? "320px" : "0px",
    "--studio-right-inset":
      (viewportMode === "desktop" || viewportMode === "tablet") && rightDrawerOpen ? "364px" : "0px",
  } as CSSProperties;

  const isLeftOverlay = viewportMode !== "desktop";
  const isRightOverlay = viewportMode === "mobile";
  const showOverlayScrim =
    (viewportMode === "tablet" && leftDrawerOpen) ||
    (viewportMode === "mobile" && (leftDrawerOpen || rightDrawerOpen));

  function updateControl(patch: Partial<StudioControls>) {
    updateActiveControls(patch);
  }

  function updateTrailPatternCell(index: number, nextCell: TrailPatternCell) {
    updateControl({
      trailPattern: activeDocument.controls.trailPattern.map((cell, cellIndex) =>
        cellIndex === index ? nextCell : cell,
      ),
    });
  }

  function setDefaultDrawerState(mode: ViewportMode) {
    if (mode === "desktop") {
      setDrawerState({
        leftDrawerOpen: true,
        rightDrawerOpen: true,
        activeMobileDrawer: null,
      });
      return;
    }

    if (mode === "tablet") {
      setDrawerState({
        leftDrawerOpen: false,
        rightDrawerOpen: true,
        activeMobileDrawer: null,
      });
      return;
    }

    setDrawerState({
      leftDrawerOpen: false,
      rightDrawerOpen: false,
      activeMobileDrawer: null,
    });
  }

  const syncViewportState = useEffectEvent((mode: ViewportMode) => {
    if (hasPersistedDrawerStateRef.current === null) {
      try {
        const raw = window.localStorage.getItem(UI_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const persistedState =
          parsed && typeof parsed === "object" && "state" in parsed ? parsed.state : null;

        hasPersistedDrawerStateRef.current = Boolean(
          persistedState &&
            typeof persistedState === "object" &&
            ("leftDrawerOpen" in persistedState ||
              "rightDrawerOpen" in persistedState ||
              "activeMobileDrawer" in persistedState),
        );
      } catch {
        hasPersistedDrawerStateRef.current = false;
      }
    }

    if (!hasAppliedViewportDefaultsRef.current) {
      if (!hasPersistedDrawerStateRef.current) {
        setDefaultDrawerState(mode);
      }
      hasAppliedViewportDefaultsRef.current = true;
      return;
    }

    if (mode === "mobile") {
      if (leftDrawerOpen && rightDrawerOpen) {
        setDrawerState({
          leftDrawerOpen: false,
          rightDrawerOpen: true,
          activeMobileDrawer: "right",
        });
        return;
      }

      if (leftDrawerOpen && activeMobileDrawer !== "left") {
        setDrawerState({
          rightDrawerOpen: false,
          activeMobileDrawer: "left",
        });
        return;
      }

      if (rightDrawerOpen && activeMobileDrawer !== "right") {
        setDrawerState({
          leftDrawerOpen: false,
          activeMobileDrawer: "right",
        });
        return;
      }

      if (!leftDrawerOpen && !rightDrawerOpen && activeMobileDrawer !== null) {
        setDrawerState({ activeMobileDrawer: null });
      }

      return;
    }

    if (activeMobileDrawer !== null) {
      setDrawerState({ activeMobileDrawer: null });
    }
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewportMode(getViewportMode(window.innerWidth));
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    syncViewportState(viewportMode);
  }, [activeMobileDrawer, leftDrawerOpen, rightDrawerOpen, viewportMode]);

  async function applyImportedMarkup(rawMarkup: string, suggestedName?: string) {
    try {
      const asset = normalizeImportedSvg(rawMarkup);

      startTransition(() => {
        setActiveAsset(asset);
        setImportError(null);
        setImportNotice(
          `Loaded SVG with ${asset.detectedColorCount} detected source color${
            asset.detectedColorCount === 1 ? "" : "s"
          }.`,
        );

        if (suggestedName && /^Draft \d+$/.test(activeDocument.name) && !activeDocument.asset) {
          renameDraft(activeDocument.id, suggestedName);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The SVG could not be loaded.";
      setImportError(message);
      setImportNotice(null);
    }
  }

  async function handleFileImport(file: File | null) {
    if (!file) {
      return;
    }

    const isSvgFile = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    if (!isSvgFile) {
      setImportError("Only SVG files are supported in V1.");
      setImportNotice(null);
      return;
    }

    const fileText = await file.text();
    const suggestedName = file.name.replace(/\.svg$/i, "");

    startPendingTransition(() => {
      void applyImportedMarkup(fileText, suggestedName);
    });
  }

  async function handleExport(kind: "svg" | "png") {
    if (!activeDocument.asset) {
      return;
    }

    setIsExporting(true);

    try {
      if (kind === "svg") {
        exportTransparentSvg(activeDocument.name, activeDocument.asset, activeDocument.controls);
      } else {
        await exportTransparentPng(activeDocument.name, activeDocument.asset, activeDocument.controls);
      }
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleToggleLeftDrawer() {
    if (viewportMode === "mobile") {
      if (activeMobileDrawer === "left" && leftDrawerOpen) {
        setDrawerState({
          leftDrawerOpen: false,
          activeMobileDrawer: null,
        });
        return;
      }

      setDrawerState({
        leftDrawerOpen: true,
        rightDrawerOpen: false,
        activeMobileDrawer: "left",
      });
      return;
    }

    const nextOpen = !leftDrawerOpen;

    setDrawerState({
      leftDrawerOpen: nextOpen,
      activeMobileDrawer: nextOpen && viewportMode === "tablet" ? "left" : null,
    });
  }

  function handleToggleRightDrawer() {
    if (viewportMode === "mobile") {
      if (activeMobileDrawer === "right" && rightDrawerOpen) {
        setDrawerState({
          rightDrawerOpen: false,
          activeMobileDrawer: null,
        });
        return;
      }

      setDrawerState({
        leftDrawerOpen: false,
        rightDrawerOpen: true,
        activeMobileDrawer: "right",
      });
      return;
    }

    setDrawerState({
      rightDrawerOpen: !rightDrawerOpen,
      activeMobileDrawer: null,
    });
  }

  function closeOverlays() {
    if (viewportMode === "mobile") {
      setDrawerState({
        leftDrawerOpen: false,
        rightDrawerOpen: false,
        activeMobileDrawer: null,
      });
      return;
    }

    if (viewportMode === "tablet" && leftDrawerOpen) {
      setDrawerState({
        leftDrawerOpen: false,
        activeMobileDrawer: null,
      });
    }
  }

  function activateSection(section: StudioUiSection) {
    setActiveControlSection(section);
  }

  return (
    <main className="studio-shell" data-viewport={viewportMode}>
      <header className="studio-app-bar">
        <div className="studio-app-bar-left">
          <StudioBrand theme={theme} />
          <div className="studio-app-bar-meta">
            <p className="eyebrow">Workspace</p>
            <h1 className="studio-app-bar-title">{activeDocument.name}</h1>
          </div>
        </div>

        <div className="studio-app-bar-actions">
          <button
            aria-pressed={leftDrawerOpen}
            className="ui-button ui-button-ghost"
            type="button"
            onClick={handleToggleLeftDrawer}
          >
            {leftDrawerOpen ? "Hide library" : "Library"}
          </button>
          <button
            aria-pressed={rightDrawerOpen}
            className="ui-button ui-button-ghost"
            type="button"
            onClick={handleToggleRightDrawer}
          >
            {rightDrawerOpen ? "Hide controls" : "Controls"}
          </button>
          <button className="ui-button ui-button-key" type="button" onClick={() => createDraft()}>
            New draft
          </button>
          <button className="ui-button ui-button-ghost" type="button" onClick={toggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>

      <div className="studio-app-frame" style={workspaceInsets}>
        {showOverlayScrim ? (
          <button
            aria-label="Close open drawer"
            className="studio-overlay-scrim"
            type="button"
            onClick={closeOverlays}
          />
        ) : null}

        <aside
          aria-label="Library drawer"
          className={`studio-app-drawer studio-app-drawer-left ${leftDrawerOpen ? "is-open" : ""} ${
            isLeftOverlay ? "is-overlay" : ""
          }`}
        >
          <div className="studio-drawer-scroll">
            <DrawerSection
              title="Drafts"
              info="Drafts are stored locally in this browser and restore on reload."
            >
              <div className="studio-field">
                <span className="studio-field-heading">
                  <label className="studio-field-label" htmlFor="draft-name">
                    Draft
                  </label>
                </span>
                <input
                  id="draft-name"
                  className="studio-input"
                  type="text"
                  value={activeDocument.name}
                  onChange={(event) => renameDraft(activeDocument.id, event.target.value)}
                />
              </div>

              <div className="studio-inline-actions">
                <button className="ui-button ui-button-key" type="button" onClick={() => createDraft()}>
                  Create draft
                </button>
                <button
                  className="ui-button ui-button-secondary"
                  type="button"
                  onClick={() => deleteDraft(activeDocument.id)}
                >
                  Delete
                </button>
              </div>

              <div className="studio-draft-list">
                {documents.map((document) => {
                  const isActive = document.id === activeDocument.id;

                  return (
                    <button
                      key={document.id}
                      className={`studio-draft-card ${isActive ? "is-active" : ""}`}
                      type="button"
                      onClick={() => startPendingTransition(() => openDraft(document.id))}
                    >
                      <span className="studio-draft-meta">
                        <span className="studio-draft-name">{document.name}</span>
                        <span className="studio-draft-status">
                          {document.asset ? "SVG ready" : "No asset yet"}
                        </span>
                      </span>
                      {isActive ? <span className="studio-chip studio-chip-key">Active</span> : null}
                    </button>
                  );
                })}
              </div>
            </DrawerSection>

            <DrawerSection
              title="Import"
              info="Load a simple icon SVG from a file or paste raw markup into the current draft."
            >
              <div
                className={`studio-dropzone-shell ${isDragging ? "is-dragging" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    return;
                  }
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void handleFileImport(event.dataTransfer.files.item(0));
                }}
              >
                <div className="studio-dropzone">
                  <label className="ui-button ui-button-secondary" htmlFor="svg-upload">
                    Choose SVG file
                  </label>
                  <input
                    id="svg-upload"
                    aria-label="Import SVG file"
                    className="sr-only"
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(event) => void handleFileImport(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="studio-field">
                <span className="studio-field-heading">
                  <label className="studio-field-label" htmlFor="svg-markup">
                    Paste SVG markup
                  </label>
                </span>
                <textarea
                  id="svg-markup"
                  className="studio-textarea"
                  placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                  value={pasteMarkup}
                  onChange={(event) => setPasteMarkup(event.target.value)}
                />
              </div>

              <button
                className="ui-button ui-button-secondary"
                type="button"
                onClick={() => void applyImportedMarkup(pasteMarkup)}
              >
                Load pasted SVG
              </button>

              {importNotice ? <p className="studio-inline-status">{importNotice}</p> : null}
              {importError ? <p className="studio-alert studio-alert-error">{importError}</p> : null}
            </DrawerSection>

            <DrawerSection
              title="Asset"
              info="V1 works best with single-color filled or stroked SVGs. Unsupported paint is warned, not blocked."
            >
              {hasAsset ? (
                <>
                  <div className="studio-chip-row">
                    {activeDocument.asset?.hasStroke ? <span className="studio-chip">Stroke</span> : null}
                    {activeDocument.asset?.hasFill ? <span className="studio-chip">Fill</span> : null}
                    <span className="studio-chip">
                      {activeDocument.asset?.detectedColorCount} source color
                      {activeDocument.asset?.detectedColorCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="studio-inline-status">viewBox {activeDocument.asset?.viewBox}</p>
                  <WarningList warnings={warningMessages} />
                </>
              ) : (
                <p className="studio-inline-status">Placeholder preview is active.</p>
              )}
            </DrawerSection>

            <DrawerSection
              title="Prompt V2"
              info="This UI stays visible in V1, but generation remains reserved for a later server-backed release."
            >
              <textarea
                aria-label="Prompt"
                className="studio-textarea"
                placeholder="Describe the SVG you want to generate in V2..."
              />
              <button className="ui-button ui-button-secondary" type="button" disabled>
                Generate in V2
              </button>
            </DrawerSection>
          </div>
        </aside>

        <section className="studio-workspace">
          <section className="studio-stage-shell">
            <div className="studio-stage-toolbar">
              <div className="studio-stage-toolbar-group">
                <p className="eyebrow">Canvas</p>
                <div className="studio-stage-chip-row">
                  <span className={`studio-status-chip ${hasAsset ? "is-active" : ""}`}>
                    {hasAsset ? "SVG ready" : "Placeholder"}
                  </span>
                  {hasAsset ? <span className="studio-status-chip">{activeDocument.asset?.viewBox}</span> : null}
                  <span className="studio-status-chip">
                    {visibleTrailCount} trail{visibleTrailCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="studio-stage-actions">
                <label className="studio-preview-swatch" htmlFor="preview-color">
                  <span className="studio-preview-swatch-label">BG</span>
                  <input
                    id="preview-color"
                    aria-label="Preview background color"
                    className="studio-swatch-input"
                    type="color"
                    value={activeDocument.controls.previewBgColor}
                    onChange={(event) => updateControl({ previewBgColor: event.target.value })}
                  />
                </label>
                <button
                  className="ui-button ui-button-ghost"
                  type="button"
                  onClick={() => updateControl(createDefaultControls())}
                >
                  Reset
                </button>
              </div>
            </div>

            <div
              className="studio-stage studio-grid-surface"
              style={{ backgroundColor: activeDocument.controls.previewBgColor }}
            >
              {isPending ? <div className="studio-status-pill">Updating</div> : null}
              <div className="studio-stage-markup" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
            </div>
          </section>
        </section>

        <aside
          aria-label="Controls drawer"
          className={`studio-app-drawer studio-app-drawer-right ${rightDrawerOpen ? "is-open" : ""} ${
            isRightOverlay ? "is-overlay" : ""
          }`}
        >
          <div className="studio-right-rail">
            <div className="studio-right-scroll">
              <RailWidget
                title="Projection"
                info="Project the full SVG group into a faux-isometric pose before duplicating the trail."
                actionLabel="Reset"
                onAction={() => updateControl(createDefaultControls())}
              >
                <div className="studio-compact-chip-row">
                  {PROJECTION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      className="studio-chip"
                      type="button"
                      onClick={() => {
                        activateSection("transform");
                        updateControl(preset.values);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="studio-compact-fields">
                  <ValueField label="R" value={String(activeDocument.controls.rotationDeg)} unit="°" />
                  <ValueField label="Sk" value={String(activeDocument.controls.skewXDeg)} unit="°" />
                  <ValueField label="Y" value={activeDocument.controls.scaleY.toFixed(2)} unit="×" />
                  <ValueField
                    emphasis
                    label="Fit"
                    value={activeDocument.controls.fitScale.toFixed(2)}
                    unit="×"
                  />
                </div>

                <SectionAction
                  label="Angles & fit"
                  active={activeControlSection === "transform"}
                  onClick={() => activateSection("transform")}
                />

                {activeControlSection === "transform" ? (
                  <div className="studio-control-group">
                    <RangeField
                      label="Rotation"
                      min={-70}
                      max={70}
                      step={1}
                      value={activeDocument.controls.rotationDeg}
                      tooltip="Rotate the whole SVG group before skewing it into the isometric pose."
                      onChange={(value) => updateControl({ rotationDeg: value })}
                    />
                    <RangeField
                      label="Skew X"
                      min={-70}
                      max={70}
                      step={1}
                      value={activeDocument.controls.skewXDeg}
                      tooltip="Push the projected face left or right to tune the isometric angle."
                      onChange={(value) => updateControl({ skewXDeg: value })}
                    />
                    <RangeField
                      label="Scale Y"
                      min={0.35}
                      max={1.4}
                      step={0.01}
                      value={activeDocument.controls.scaleY}
                      tooltip="Compress or stretch the projected height after rotation and skew."
                      onChange={(value) => updateControl({ scaleY: value })}
                    />
                    <RangeField
                      label="Fit scale"
                      min={0.5}
                      max={2.3}
                      step={0.01}
                      value={activeDocument.controls.fitScale}
                      tooltip="Scale the full composition so it sits well inside the canvas."
                      onChange={(value) => updateControl({ fitScale: value })}
                    />
                  </div>
                ) : null}
              </RailWidget>

              <RailWidget
                title="Appearance"
                info="Recolor the flattened SVG output and scale stroke width without changing the preview background."
              >
                <div className="studio-color-swatches">
                  <label className="studio-swatch-field" htmlFor="art-color">
                    <span className="studio-swatch-label">Art</span>
                    <input
                      id="art-color"
                      aria-label="Art color"
                      className="studio-swatch-input"
                      type="color"
                      value={activeDocument.controls.artColor}
                      onChange={(event) => updateControl({ artColor: event.target.value })}
                    />
                  </label>
                  <div
                    className="studio-swatch-static"
                    style={{ backgroundColor: activeDocument.controls.previewBgColor }}
                  >
                    <span className="studio-swatch-label">BG</span>
                  </div>
                  <div className="studio-swatch-static" style={{ backgroundColor: "var(--fg-1)" }} />
                  <div className="studio-swatch-static studio-swatch-static-transparent" />
                </div>

                <RangeField
                  label="Stroke weight"
                  min={0.4}
                  max={3}
                  step={0.05}
                  value={activeDocument.controls.strokeScale}
                  tooltip="Scale stroke width without changing the asset geometry."
                  onChange={(value) => updateControl({ strokeScale: value })}
                />

                <div className="studio-compact-fields studio-compact-fields-two">
                  <ValueField label="Art" value={activeDocument.controls.artColor.toUpperCase()} />
                  <ValueField label="BG" value={activeDocument.controls.previewBgColor.toUpperCase()} />
                </div>
              </RailWidget>

              <RailWidget
                title="Trail"
                info="Duplicate the projected SVG along one axis, then control spacing, fade, and per-slot patterning."
              >
                <div className="studio-compact-fields studio-compact-fields-two">
                  <ValueField label="Count" value={String(visibleTrailCount)} />
                  <ValueField
                    label="Mode"
                    value={activeDocument.controls.useCustomTrailPattern ? "Row" : "Linear"}
                  />
                </div>

                <RangeField
                  label="Trail count"
                  min={0}
                  max={24}
                  step={1}
                  disabled={activeDocument.controls.useCustomTrailPattern}
                  value={activeDocument.controls.trailCount}
                  tooltip="Set the number of duplicated layers when using the simple linear trail."
                  onChange={(value) => updateControl({ trailCount: value })}
                />

                <ToggleField
                  label="Use custom trail row"
                  checked={activeDocument.controls.useCustomTrailPattern}
                  tooltip="Switch from evenly spaced linear layers to a manual per-slot row pattern."
                  onChange={(checked) => updateControl({ useCustomTrailPattern: checked })}
                />

                <SectionAction
                  label="Advanced trail"
                  active={activeControlSection === "trail"}
                  onClick={() => activateSection("trail")}
                />

                {activeControlSection === "trail" ? (
                  <div className="studio-control-group">
                    <RangeField
                      label="Offset X"
                      min={-80}
                      max={80}
                      step={1}
                      value={activeDocument.controls.trailOffsetX}
                      tooltip="Shift each layer left or right between trail steps."
                      onChange={(value) => updateControl({ trailOffsetX: value })}
                    />
                    <RangeField
                      label="Offset Y"
                      min={-80}
                      max={80}
                      step={1}
                      value={activeDocument.controls.trailOffsetY}
                      tooltip="Shift each layer up or down between trail steps."
                      onChange={(value) => updateControl({ trailOffsetY: value })}
                    />
                    <RangeField
                      label="Opacity start"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={activeDocument.controls.useCustomTrailPattern}
                      value={activeDocument.controls.opacityStart}
                      tooltip="Starting opacity for linear trails near the front of the stack."
                      onChange={(value) => updateControl({ opacityStart: value })}
                    />
                    <RangeField
                      label="Opacity end"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={activeDocument.controls.useCustomTrailPattern}
                      value={activeDocument.controls.opacityEnd}
                      tooltip="Ending opacity for linear trails farther back in the stack."
                      onChange={(value) => updateControl({ opacityEnd: value })}
                    />
                    <ToggleField
                      label="Reverse trail"
                      checked={activeDocument.controls.reverseTrail}
                      tooltip="Send the duplicated trail in the opposite direction."
                      onChange={(checked) => updateControl({ reverseTrail: checked })}
                    />

                    {activeDocument.controls.useCustomTrailPattern ? (
                      <TrailPatternEditor
                        controls={activeDocument.controls}
                        selectedIndex={selectedTrailSlot}
                        onSelect={setSelectedTrailSlot}
                        onUpdate={(nextCell) => updateTrailPatternCell(selectedTrailSlot, nextCell)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </RailWidget>

              <RailWidget
                title="Export"
                info="Exports stay transparent. The preview background is never baked into SVG or PNG output."
              >
                <div className="studio-compact-chip-row">
                  <span className="studio-chip studio-chip-key">SVG</span>
                  <span className="studio-chip">PNG</span>
                  <span className="studio-chip">Transparent</span>
                </div>
                <div className="studio-compact-fields studio-compact-fields-two">
                  <ValueField label="Bounds" value={hasAsset ? "tight" : "—"} />
                  <ValueField label="Alpha" value="clear" />
                </div>
                <div className="studio-export-stack">
                  <button
                    className="studio-export-action"
                    type="button"
                    disabled={!hasAsset || isExporting}
                    onClick={() => void handleExport("svg")}
                  >
                    <span>Export SVG</span>
                    <span className="studio-export-meta">{hasAsset ? "vector" : "disabled"}</span>
                  </button>
                  <button
                    className="studio-export-action studio-export-action-secondary"
                    type="button"
                    disabled={!hasAsset || isExporting}
                    onClick={() => void handleExport("png")}
                  >
                    <span>Export PNG</span>
                    <span className="studio-export-meta">{hasAsset ? "bitmap" : "disabled"}</span>
                  </button>
                </div>
              </RailWidget>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
