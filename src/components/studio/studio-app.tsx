"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useState, useTransition } from "react";

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

function Panel({
  title,
  eyebrow,
  children,
  className = "",
}: Readonly<{
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section className={`studio-panel flex min-h-0 flex-col gap-5 p-5 lg:p-6 ${className}`}>
      <div className="space-y-2">
        <p className="studio-label">{eyebrow}</p>
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      </div>
      <div className="studio-scrollbar flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}

function Section({
  title,
  description,
  children,
  className = "",
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <section className={`studio-section space-y-4 p-4 ${className}`}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/84">{title}</h3>
        {description ? <p className="text-sm leading-6 text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
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
}: Readonly<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}>) {
  return (
    <div className={`space-y-2 ${disabled ? "opacity-45" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-100" htmlFor={`${label}-number`}>
          {label}
        </label>
        <input
          id={`${label}-number`}
          aria-label={label}
          className="studio-input h-10 max-w-[102px] rounded-xl py-2 text-right font-mono text-sm"
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={Number(value.toFixed(3))}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <input
        aria-label={`${label} slider`}
        className="studio-range h-2 w-full"
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
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {description ? <span className="block text-xs text-slate-400">{description}</span> : null}
      </span>
      <input
        aria-label={label}
        className="h-5 w-5 accent-indigo-300"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function WarningList({ warnings }: Readonly<{ warnings: string[] }>) {
  if (!warnings.length) {
    return null;
  }

  return (
    <div aria-live="polite" className="space-y-2">
      {warnings.map((warning) => (
        <p
          key={warning}
          className="rounded-2xl border border-amber-200/14 bg-amber-300/8 px-3 py-2 text-sm leading-6 text-amber-100"
        >
          {warning}
        </p>
      ))}
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
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
          <span>Near</span>
          <span>Far</span>
        </div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {controls.trailPattern.map((cell, index) => {
            const isSelected = selectedIndex === index;

            return (
              <button
                key={index}
                className={`rounded-2xl border px-0 py-3 text-center text-xs font-semibold ${
                  isSelected
                    ? "border-indigo-200/55 bg-indigo-300/18 text-white"
                    : cell.enabled
                      ? "border-white/12 bg-white/[0.08] text-slate-100 hover:bg-white/[0.11]"
                      : "border-white/8 bg-black/20 text-slate-500 hover:bg-white/[0.04]"
                }`}
                type="button"
                onClick={() => onSelect(index)}
              >
                <span className="block">{index + 1}</span>
                <span className={`mx-auto mt-2 block h-1.5 w-6 rounded-full ${cell.enabled ? "bg-slate-100" : "bg-white/10"}`} />
                {cell.matte ? (
                  <span className="mt-1 block text-[0.55rem] uppercase tracking-[0.16em] text-cyan-100">
                    Matte
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Slot {selectedIndex + 1}</p>
            <p className="text-xs text-slate-400">Enable the slot, tune opacity, and decide whether it should read as denser.</p>
          </div>
        </div>
        <div className="space-y-4">
          <ToggleField
            label="Active gap cell"
            description="Turn this slot on to render a trail here. Leave it off to create a gap."
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
            description="Adds a denser underlay so this trail reads more opaque and blocks overlap more aggressively."
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedTrailSlot, setSelectedTrailSlot] = useState(0);
  const hasAsset = Boolean(activeDocument.asset);
  const enabledPatternCount = activeDocument.controls.trailPattern.filter((cell) => cell.enabled).length;

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
          `Loaded SVG with ${asset.detectedColorCount} detected source color${asset.detectedColorCount === 1 ? "" : "s"}.`,
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
    <main className="studio-shell px-4 py-4 text-slate-100 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1760px] flex-col gap-4">
        <div className="studio-panel flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
          <div className="flex items-center gap-3">
            <button
              className="studio-button studio-button-secondary !min-h-11 px-4"
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
            >
              {isSidebarOpen ? "Hide left rail" : "Show left rail"}
            </button>
            <div>
              <p className="studio-label">Studi03D</p>
              <h1 className="text-lg font-semibold text-white">SVG Isometric Trail Studio</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link className="studio-button studio-button-secondary" href="/about">
              About
            </Link>
          </div>
        </div>

        <section
          className={`grid flex-1 gap-4 ${
            isSidebarOpen
              ? "xl:grid-cols-[320px_minmax(0,1fr)_360px]"
              : "xl:grid-cols-[88px_minmax(0,1fr)_360px]"
          }`}
        >
          <Panel
            eyebrow="Library"
            title={isSidebarOpen ? "Import + Drafts" : "Rail"}
            className={isSidebarOpen ? "" : "items-center px-3 py-4"}
          >
            {isSidebarOpen ? (
              <>
                <Section title="Current draft" description="Rename the active draft or create a new local document.">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="studio-label" htmlFor="draft-name">
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
                    <div className="flex flex-wrap gap-3">
                      <button className="studio-button studio-button-primary flex-1" type="button" onClick={() => createDraft()}>
                        New draft
                      </button>
                      <button
                        className="studio-button studio-button-secondary"
                        type="button"
                        onClick={() => deleteDraft(activeDocument.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="studio-label">Saved locally</p>
                    <div className="space-y-2">
                      {documents.map((document) => {
                        const isActive = document.id === activeDocument.id;

                        return (
                          <button
                            key={document.id}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                              isActive
                                ? "border-indigo-300/40 bg-indigo-300/12 text-white"
                                : "border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                            }`}
                            type="button"
                            onClick={() => startPendingTransition(() => openDraft(document.id))}
                          >
                            <span>
                              <span className="block text-sm font-semibold">{document.name}</span>
                              <span className="block text-xs text-slate-400">
                                {document.asset ? "SVG ready" : "No asset yet"}
                              </span>
                            </span>
                            {isActive ? (
                              <span className="studio-badge bg-white/10 text-slate-200">Active</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Section>

                <Section title="Import SVG" description="Drop a file, browse for an SVG, or paste raw markup directly.">
                  <div
                    className={`rounded-[24px] border border-dashed px-4 py-5 text-center ${
                      isDragging ? "border-indigo-300/50 bg-indigo-300/10" : "border-white/14 bg-white/[0.03]"
                    }`}
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
                    <p className="text-sm leading-7 text-slate-200">
                      Drag in a simple icon SVG, or choose a file to replace the active draft artwork.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <label className="studio-button studio-button-primary" htmlFor="svg-upload">
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

                  <div className="space-y-2">
                    <label className="studio-label" htmlFor="svg-markup">
                      Paste SVG markup
                    </label>
                    <textarea
                      id="svg-markup"
                      className="studio-textarea font-mono text-sm"
                      placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                      value={pasteMarkup}
                      onChange={(event) => setPasteMarkup(event.target.value)}
                    />
                    <button
                      className="studio-button studio-button-secondary w-full"
                      type="button"
                      onClick={() => void applyImportedMarkup(pasteMarkup)}
                    >
                      Load pasted SVG
                    </button>
                  </div>

                  <div aria-live="polite" className="space-y-2 text-sm leading-6">
                    <p className="text-slate-300">{importNotice}</p>
                    {importError ? (
                      <p className="rounded-2xl border border-rose-200/16 bg-rose-300/10 px-3 py-2 text-rose-100">
                        {importError}
                      </p>
                    ) : null}
                  </div>
                </Section>

                <Section title="Asset info" description="V1 supports single-color stroked or flat-filled SVG artwork.">
                  {hasAsset ? (
                    <div className="space-y-3 text-sm text-slate-300">
                      <div className="flex flex-wrap gap-2">
                        {activeDocument.asset?.hasStroke ? (
                          <span className="studio-badge bg-cyan-300/10 text-cyan-100">Stroke</span>
                        ) : null}
                        {activeDocument.asset?.hasFill ? (
                          <span className="studio-badge bg-indigo-300/10 text-indigo-100">Fill</span>
                        ) : null}
                        <span className="studio-badge bg-white/7 text-slate-200">
                          {activeDocument.asset?.detectedColorCount} source color
                          {activeDocument.asset?.detectedColorCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="rounded-2xl bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-300">
                        viewBox {activeDocument.asset?.viewBox}
                      </p>
                      <WarningList warnings={warningMessages} />
                    </div>
                  ) : (
                    <p className="text-sm leading-7 text-slate-300">
                      No imported asset yet. The preview is showing a placeholder card until you load SVG artwork.
                    </p>
                  )}
                </Section>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-between gap-4">
                <button
                  className="studio-button studio-button-secondary !min-h-14 w-full !rounded-3xl px-0 text-xs uppercase tracking-[0.16em]"
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  Import
                </button>
                <div className="flex w-full flex-col gap-2">
                  <button
                    className="rounded-3xl border border-white/10 bg-white/[0.03] px-2 py-4 text-xs uppercase tracking-[0.16em] text-slate-300"
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                  >
                    Drafts
                  </button>
                  <Link
                    className="rounded-3xl border border-white/10 bg-white/[0.03] px-2 py-4 text-center text-xs uppercase tracking-[0.16em] text-slate-300"
                    href="/about"
                  >
                    About
                  </Link>
                </div>
                <div className="text-center text-xs uppercase tracking-[0.16em] text-slate-500">
                  {documents.length} draft{documents.length === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </Panel>

          <Panel eyebrow="Canvas" title="Live Canvas">
            <div className="studio-preview-card flex min-h-full flex-col gap-4 p-4 lg:p-5">
              <div
                className="studio-preview-stage studio-grid relative flex flex-1 items-center justify-center p-5 md:p-8"
                style={{ backgroundColor: activeDocument.controls.previewBgColor }}
              >
                {!hasAsset ? (
                  <div className="pointer-events-none absolute bottom-5 left-5 max-w-xs rounded-2xl border border-white/10 bg-black/18 px-3 py-3 text-sm leading-6 text-slate-200">
                    Import an SVG to replace the placeholder card and export the result as a transparent asset.
                  </div>
                ) : null}
                {isPending ? (
                  <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-200">
                    Updating
                  </div>
                ) : null}
                <div className="w-full max-w-[980px]" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Controls" title="Projection + Trails">
            <Section
              title="Projection"
              description="Use the cleaner reference settings as a starting point, then adjust angle and size from there."
            >
              <div className="flex flex-wrap gap-2">
                {PROJECTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="studio-button studio-button-secondary"
                    type="button"
                    onClick={() => updateControl(preset.values)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
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
              </div>
            </Section>

            <Section title="Appearance" description="Stroke scaling helps imported icons read more like the reference stack.">
              <div className="space-y-4">
                <RangeField
                  label="Stroke weight"
                  min={0.4}
                  max={3}
                  step={0.05}
                  value={activeDocument.controls.strokeScale}
                  onChange={(value) => updateControl({ strokeScale: value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="studio-label" htmlFor="art-color">
                      Art color
                    </label>
                    <input
                      id="art-color"
                      aria-label="Art color"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-transparent"
                      type="color"
                      value={activeDocument.controls.artColor}
                      onChange={(event) => updateControl({ artColor: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="studio-label" htmlFor="preview-color">
                      Preview background
                    </label>
                    <input
                      id="preview-color"
                      aria-label="Preview background color"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-transparent"
                      type="color"
                      value={activeDocument.controls.previewBgColor}
                      onChange={(event) => updateControl({ previewBgColor: event.target.value })}
                    />
                  </div>
                </div>
                <button
                  className="studio-button studio-button-secondary w-full"
                  type="button"
                  onClick={() => updateControl(createDefaultControls())}
                >
                  Reset to cleaner defaults
                </button>
              </div>
            </Section>

            <Section title="Trail spacing" description="Keep the simple controls for even spacing, or switch to the slot row for custom gaps.">
              <div className="space-y-4">
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
              </div>
            </Section>

            <Section
              title="Trail row"
              description="Fill or leave cells to create your own spacing rhythm. Each slot can get its own opacity and denser matte behavior."
              className={activeDocument.controls.useCustomTrailPattern ? "" : "opacity-65"}
            >
              <TrailPatternEditor
                controls={activeDocument.controls}
                selectedIndex={selectedTrailSlot}
                onSelect={setSelectedTrailSlot}
                onUpdate={(nextCell) => updateTrailPatternCell(selectedTrailSlot, nextCell)}
              />
            </Section>

            <Section title="Export" description="Exports stay transparent. The preview background never gets baked into output.">
              <div className="space-y-3">
                <button
                  className="studio-button studio-button-primary w-full"
                  type="button"
                  disabled={!hasAsset || isExporting}
                  onClick={() => void handleExport("svg")}
                >
                  Export SVG
                </button>
                <button
                  className="studio-button studio-button-secondary w-full"
                  type="button"
                  disabled={!hasAsset || isExporting}
                  onClick={() => void handleExport("png")}
                >
                  Export PNG
                </button>
                <p className="text-sm leading-6 text-slate-300">
                  {hasAsset
                    ? "Stroke scaling, custom trail rows, and matte trails are preserved in export."
                    : "Load an SVG before exporting."}
                </p>
              </div>
            </Section>
          </Panel>
        </section>
      </div>
    </main>
  );
}
