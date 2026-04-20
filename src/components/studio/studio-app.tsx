"use client";

import { startTransition, useDeferredValue, useState, useTransition } from "react";

import { SiteHeader } from "@/components/site/site-header";
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
import { useStudioUiStore } from "@/lib/ui/store";

function toFieldId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatNumericValue(value: number) {
  return Number(value.toFixed(3));
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
}: Readonly<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}>) {
  const fieldId = toFieldId(label);

  return (
    <div className="studio-range-field">
      <div className="studio-range-header">
        <label htmlFor={`${fieldId}-number`}>{label}</label>
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
  description,
  checked,
  onChange,
}: Readonly<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <label className="studio-toggle-field">
      <span className="studio-toggle-copy">
        <strong>{label}</strong>
        <span>{description}</span>
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
  actionLabel,
  onAction,
  children,
}: Readonly<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}>) {
  return (
    <section className="studio-rail-widget">
      <div className="studio-rail-widget-head">
        <p className="studio-rail-title">{title}</p>
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
      <div>
        <div className="studio-range-header">
          <span className="studio-field-label">Custom trail row</span>
          <span className="studio-field-label">Near → far</span>
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
      </div>

      <div className="studio-card">
        <p className="eyebrow">Slot {selectedIndex + 1}</p>
        <p className="studio-card-copy">
          Turn this slot on to render a trail here, or leave it off to create a gap.
        </p>
        <div className="studio-control-group">
          <ToggleField
            label="Active trail cell"
            description="Enable this position in the row pattern."
            checked={selectedCell.enabled}
            onChange={(checked) => onUpdate({ ...selectedCell, enabled: checked })}
          />
          <RangeField
            label="Slot opacity"
            min={0}
            max={1}
            step={0.01}
            disabled={!selectedCell.enabled}
            value={selectedCell.opacity}
            onChange={(value) => onUpdate({ ...selectedCell, opacity: value })}
          />
          <ToggleField
            label="Dense / matte trail"
            description="Adds a denser underlay so this slot reads more opaque."
            checked={selectedCell.matte}
            onChange={(checked) => onUpdate({ ...selectedCell, matte: checked })}
          />
        </div>
      </div>
    </div>
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
  const leftRailCollapsed = useStudioUiStore((state) => state.leftRailCollapsed);
  const rightPanelOpen = useStudioUiStore((state) => state.rightPanelOpen);
  const toggleLeftRail = useStudioUiStore((state) => state.toggleLeftRail);
  const toggleRightPanel = useStudioUiStore((state) => state.toggleRightPanel);
  const setLeftRailCollapsed = useStudioUiStore((state) => state.setLeftRailCollapsed);

  const previewAsset = deferredDocument.asset ?? PLACEHOLDER_ASSET;
  const previewMarkup = buildPreviewMarkup(previewAsset, deferredDocument.controls);
  const warningMessages = (activeDocument.asset?.warningCodes ?? []).map(
    (warningCode) => WARNING_COPY[warningCode],
  );

  const [pasteMarkup, setPasteMarkup] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState("Import an SVG file or paste markup to start a draft.");
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startPendingTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTrailSlot, setSelectedTrailSlot] = useState(0);

  const hasAsset = Boolean(activeDocument.asset);
  const enabledPatternCount = activeDocument.controls.trailPattern.filter((cell) => cell.enabled).length;
  const visibleTrailCount = activeDocument.controls.useCustomTrailPattern
    ? enabledPatternCount
    : activeDocument.controls.trailCount;
  const transformSummary = `${activeDocument.controls.rotationDeg}° rot · ${activeDocument.controls.skewXDeg}° skew · ${activeDocument.controls.fitScale.toFixed(2)}x fit`;
  const trailSummary = `${visibleTrailCount} layer${visibleTrailCount === 1 ? "" : "s"} · ${activeDocument.controls.trailOffsetX}/${activeDocument.controls.trailOffsetY} offset`;

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
      setImportNotice("Fix the SVG input and try again.");
    }
  }

  async function handleFileImport(file: File | null) {
    if (!file) {
      return;
    }

    const isSvgFile = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    if (!isSvgFile) {
      setImportError("Only SVG files are supported in V1.");
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
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="studio-shell">
      <SiteHeader
        active="studio"
        actions={
          <>
            <button className="ui-button ui-button-ghost" type="button" onClick={toggleLeftRail}>
              {leftRailCollapsed ? "Library" : "Hide library"}
            </button>
            <button className="ui-button ui-button-ghost" type="button" onClick={toggleRightPanel}>
              {rightPanelOpen ? "Hide controls" : "Controls"}
            </button>
            <button className="ui-button ui-button-key" type="button" onClick={() => createDraft()}>
              New draft
            </button>
          </>
        }
      />

      <div
        className={`studio-shell-inner ${leftRailCollapsed ? "is-rail-collapsed" : ""} ${
          rightPanelOpen ? "is-settings-open" : ""
        }`}
      >
        {leftRailCollapsed ? (
          <aside className="studio-rail">
            <div className="studio-card studio-compact-rail">
              <button className="ui-button ui-button-secondary" type="button" onClick={() => setLeftRailCollapsed(false)}>
                Open library
              </button>
              <button className="ui-button ui-button-ghost" type="button" onClick={() => createDraft()}>
                Draft +
              </button>
              <span className="studio-chip">{documents.length} drafts</span>
            </div>
          </aside>
        ) : (
          <aside className="studio-rail">
            <div className="studio-rail-stack">
              <section className="studio-card">
                <p className="eyebrow">Drafts</p>
                <h2 className="studio-card-title">Import and save stay on the left.</h2>
                <p className="studio-card-copy">
                  Keep the project library and prompt stub tucked here so the preview keeps more room.
                </p>

                <div className="studio-control-group">
                  <div className="studio-field">
                    <label className="studio-field-label" htmlFor="draft-name">
                      Draft name
                    </label>
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
                    <button className="ui-button ui-button-secondary" type="button" onClick={() => deleteDraft(activeDocument.id)}>
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
                </div>
              </section>

              <section className="studio-card">
                <p className="eyebrow">Import</p>
                <h2 className="studio-card-title">Bring in a clean SVG.</h2>
                <div className="studio-control-group">
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
                      <p className="studio-note">
                        Drag in a simple icon SVG, or choose a file to replace the active draft artwork.
                      </p>
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
                    <label className="studio-field-label" htmlFor="svg-markup">
                      Paste SVG markup
                    </label>
                    <textarea
                      id="svg-markup"
                      className="studio-textarea"
                      placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                      value={pasteMarkup}
                      onChange={(event) => setPasteMarkup(event.target.value)}
                    />
                  </div>

                  <button className="ui-button ui-button-secondary" type="button" onClick={() => void applyImportedMarkup(pasteMarkup)}>
                    Load pasted SVG
                  </button>

                  <p className="studio-note">{importNotice}</p>
                  {importError ? <p className="studio-alert studio-alert-error">{importError}</p> : null}
                </div>
              </section>

              <section className="studio-card">
                <p className="eyebrow">Asset</p>
                <h2 className="studio-card-title">Single-color SVGs behave best.</h2>
                <div className="studio-asset-list">
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
                      <p className="studio-note">viewBox {activeDocument.asset?.viewBox}</p>
                      <WarningList warnings={warningMessages} />
                    </>
                  ) : (
                    <p className="studio-note">
                      No imported asset yet. The studio is using the placeholder card until you load artwork.
                    </p>
                  )}
                </div>
              </section>

              <section className="studio-card">
                <p className="eyebrow">Prompt generation</p>
                <h2 className="studio-card-title">Visible in V1. Reserved for V2.</h2>
                <div className="studio-control-group">
                  <textarea
                    aria-label="Prompt"
                    className="studio-textarea"
                    placeholder="Describe the SVG you want to generate in V2..."
                  />
                  <button className="ui-button ui-button-secondary" type="button" disabled>
                    Generate in V2
                  </button>
                </div>
              </section>
            </div>
          </aside>
        )}

        <section className="studio-workspace">
          <div className="studio-summary-card studio-card">
            <div>
              <p className="eyebrow">Studio</p>
              <h1 className="studio-card-title">{activeDocument.name}</h1>
              <p className="studio-card-copy">
                Dark-first chrome, cleaner defaults, and a larger live stage tuned for restrained line-work.
              </p>
            </div>
            <div className="studio-chip-row">
              <span className="studio-chip studio-chip-key">
                {hasAsset ? "SVG loaded" : "Placeholder preview"}
              </span>
              <span className="studio-chip">{visibleTrailCount} visible trail layer{visibleTrailCount === 1 ? "" : "s"}</span>
              <span className="studio-chip">{activeDocument.controls.strokeScale.toFixed(2)}x stroke</span>
              <span className="studio-chip">{activeDocument.controls.previewBgColor}</span>
            </div>
            {warningMessages.length ? <WarningList warnings={warningMessages} /> : null}
          </div>

          <section className="studio-stage-card">
            <div className="studio-stage-head">
              <div>
                <p className="eyebrow">Live canvas</p>
                <h2 className="studio-card-title">The artwork gets the room now.</h2>
                <p className="studio-stage-label">
                  Preview background is separate from export. Transparent output is preserved.
                </p>
              </div>
              <div className="studio-stage-meta">
                <span className="studio-chip">Preview only background</span>
                <button
                  className="ui-button ui-button-ghost"
                  type="button"
                  onClick={() => updateControl(createDefaultControls())}
                >
                  Reset defaults
                </button>
              </div>
            </div>

            <div
              className="studio-stage studio-grid-surface"
              style={{ backgroundColor: activeDocument.controls.previewBgColor }}
            >
              {!hasAsset ? (
                <div className="studio-empty-note">
                  Import an SVG to replace the placeholder card and export the result as a transparent asset.
                </div>
              ) : null}
              {isPending ? <div className="studio-status-pill">Updating</div> : null}
              <div className="studio-stage-markup" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
            </div>

            <div className="studio-stage-footer">
              <p>
                The current starting point is biased toward the cleaner screenshot-based posture rather than
                the older widget-heavy layout.
              </p>
              <div className="studio-chip-row">
                <span className="studio-chip">{activeDocument.controls.artColor}</span>
                <span className="studio-chip">{transformSummary}</span>
                <span className="studio-chip">{trailSummary}</span>
              </div>
            </div>
          </section>
        </section>

        {rightPanelOpen ? (
          <aside className="studio-settings">
            <div className="studio-right-rail">
              <div className="studio-right-scroll">
                <RailWidget
                  title="Projection"
                  actionLabel="Reset"
                  onAction={() => updateControl(createDefaultControls())}
                >
                  <div className="studio-compact-chip-row">
                    {PROJECTION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        className="studio-chip"
                        type="button"
                        onClick={() => updateControl(preset.values)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="studio-compact-fields">
                    <ValueField label="R" value={String(activeDocument.controls.rotationDeg)} unit="°" />
                    <ValueField label="Sk" value={String(activeDocument.controls.skewXDeg)} unit="°" />
                    <ValueField
                      label="Y"
                      value={activeDocument.controls.scaleY.toFixed(2)}
                      unit="×"
                    />
                    <ValueField
                      emphasis
                      label="Fit"
                      value={activeDocument.controls.fitScale.toFixed(2)}
                      unit="×"
                    />
                  </div>
                  <RangeField
                    label="Rotation"
                    min={-70}
                    max={70}
                    step={1}
                    value={activeDocument.controls.rotationDeg}
                    onChange={(value) => updateControl({ rotationDeg: value })}
                  />
                  <RangeField
                    label="Skew X"
                    min={-70}
                    max={70}
                    step={1}
                    value={activeDocument.controls.skewXDeg}
                    onChange={(value) => updateControl({ skewXDeg: value })}
                  />
                  <RangeField
                    label="Scale Y"
                    min={0.35}
                    max={1.4}
                    step={0.01}
                    value={activeDocument.controls.scaleY}
                    onChange={(value) => updateControl({ scaleY: value })}
                  />
                  <RangeField
                    label="Fit scale"
                    min={0.5}
                    max={2.3}
                    step={0.01}
                    value={activeDocument.controls.fitScale}
                    onChange={(value) => updateControl({ fitScale: value })}
                  />
                </RailWidget>

                <RailWidget title="Appearance">
                  <div className="studio-color-swatches">
                    <label className="studio-swatch-field" htmlFor="art-color">
                      <span className="studio-swatch-label">Fill</span>
                      <input
                        id="art-color"
                        aria-label="Art color"
                        className="studio-swatch-input"
                        type="color"
                        value={activeDocument.controls.artColor}
                        onChange={(event) => updateControl({ artColor: event.target.value })}
                      />
                    </label>
                    <label className="studio-swatch-field" htmlFor="preview-color">
                      <span className="studio-swatch-label">BG</span>
                      <input
                        id="preview-color"
                        aria-label="Preview background color"
                        className="studio-swatch-input"
                        type="color"
                        value={activeDocument.controls.previewBgColor}
                        onChange={(event) => updateControl({ previewBgColor: event.target.value })}
                      />
                    </label>
                    <div className="studio-swatch-static" style={{ backgroundColor: "var(--fg-1)" }} />
                    <div className="studio-swatch-static" style={{ backgroundColor: "var(--fg-3)" }} />
                    <div className="studio-swatch-static studio-swatch-static-transparent" />
                  </div>
                  <RangeField
                    label="Stroke weight"
                    min={0.4}
                    max={3}
                    step={0.05}
                    value={activeDocument.controls.strokeScale}
                    onChange={(value) => updateControl({ strokeScale: value })}
                  />
                  <div className="studio-compact-fields studio-compact-fields-two">
                    <ValueField label="Art" value={activeDocument.controls.artColor.toUpperCase()} />
                    <ValueField
                      label="Prev"
                      value={activeDocument.controls.previewBgColor.toUpperCase()}
                    />
                  </div>
                </RailWidget>

                <RailWidget title="Trail">
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
                    onChange={(value) => updateControl({ trailCount: value })}
                  />
                  <RangeField
                    label="Offset X"
                    min={-80}
                    max={80}
                    step={1}
                    value={activeDocument.controls.trailOffsetX}
                    onChange={(value) => updateControl({ trailOffsetX: value })}
                  />
                  <RangeField
                    label="Offset Y"
                    min={-80}
                    max={80}
                    step={1}
                    value={activeDocument.controls.trailOffsetY}
                    onChange={(value) => updateControl({ trailOffsetY: value })}
                  />
                  <RangeField
                    label="Opacity start"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={activeDocument.controls.useCustomTrailPattern}
                    value={activeDocument.controls.opacityStart}
                    onChange={(value) => updateControl({ opacityStart: value })}
                  />
                  <RangeField
                    label="Opacity end"
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={activeDocument.controls.useCustomTrailPattern}
                    value={activeDocument.controls.opacityEnd}
                    onChange={(value) => updateControl({ opacityEnd: value })}
                  />
                  <ToggleField
                    label="Reverse trail"
                    description="Send the stack in the opposite direction."
                    checked={activeDocument.controls.reverseTrail}
                    onChange={(checked) => updateControl({ reverseTrail: checked })}
                  />
                  <ToggleField
                    label="Use custom trail row"
                    description={`${enabledPatternCount} active slot${enabledPatternCount === 1 ? "" : "s"} in the current row pattern.`}
                    checked={activeDocument.controls.useCustomTrailPattern}
                    onChange={(checked) => updateControl({ useCustomTrailPattern: checked })}
                  />
                </RailWidget>

                {activeDocument.controls.useCustomTrailPattern ? (
                  <RailWidget title="Trail Row">
                    <TrailPatternEditor
                      controls={activeDocument.controls}
                      selectedIndex={selectedTrailSlot}
                      onSelect={setSelectedTrailSlot}
                      onUpdate={(nextCell) => updateTrailPatternCell(selectedTrailSlot, nextCell)}
                    />
                  </RailWidget>
                ) : null}

                <RailWidget title="Export">
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
                      <span className="studio-export-meta">
                        {hasAsset ? "vector" : "disabled"}
                      </span>
                    </button>
                    <button
                      className="studio-export-action studio-export-action-secondary"
                      type="button"
                      disabled={!hasAsset || isExporting}
                      onClick={() => void handleExport("png")}
                    >
                      <span>Export PNG</span>
                      <span className="studio-export-meta">
                        {hasAsset ? "bitmap" : "disabled"}
                      </span>
                    </button>
                  </div>
                  <p className="studio-note">
                    {hasAsset
                      ? "Stroke scaling, custom trail rows, and matte trails are preserved in export."
                      : "Load an SVG before exporting."}
                  </p>
                </RailWidget>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
