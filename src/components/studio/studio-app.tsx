"use client";

import { startTransition, useDeferredValue, useState, useTransition } from "react";

import {
  DEFAULT_CONTROLS,
  PLACEHOLDER_ASSET,
  PROJECTION_PRESETS,
  WARNING_COPY,
} from "@/lib/studio/constants";
import { exportTransparentPng, exportTransparentSvg } from "@/lib/studio/export";
import { normalizeImportedSvg } from "@/lib/studio/svg-normalize";
import { buildPreviewMarkup } from "@/lib/studio/svg-scene";
import { useActiveStudioDocument, useStudioStore } from "@/lib/studio/store";
import type { StudioControls } from "@/lib/studio/types";

function Panel({
  title,
  eyebrow,
  children,
}: Readonly<{
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="studio-panel flex min-h-0 flex-col gap-5 p-5 lg:p-6">
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
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="studio-section space-y-4 p-4">
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
}: Readonly<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}>) {
  return (
    <div className="space-y-2">
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
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
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
  const warningMessages = (activeDocument.asset?.warningCodes ?? []).map((warningCode) => WARNING_COPY[warningCode]);
  const [pasteMarkup, setPasteMarkup] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState("Import an SVG file or paste markup to start a draft.");
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startPendingTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const hasAsset = Boolean(activeDocument.asset);

  function updateControl(patch: Partial<StudioControls>) {
    updateActiveControls(patch);
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

    const isSvgFile =
      file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

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
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1700px] flex-col gap-4">
        <header className="studio-panel flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="space-y-3">
            <span className="studio-badge border border-white/10 bg-white/5 text-slate-200">
              V1 Studio
            </span>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                SVG Isometric Trail Studio
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                Import simple line or flat-fill SVG icons, push them into a faux-isometric angle,
                duplicate them along one trail axis, and export transparent assets for illustration systems.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Transparent SVG and PNG export
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Browser-side named drafts
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Prompt generation reserved for V2
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <Panel eyebrow="Input" title="Import + Drafts">
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

            <Section title="Prompt stub" description="Visible in V1 so the future generation workflow has a home.">
              <div className="space-y-3">
                <label className="studio-label" htmlFor="prompt-input">
                  Prompt input
                </label>
                <textarea
                  id="prompt-input"
                  className="studio-textarea"
                  placeholder="Describe the icon you want this tool to generate in V2."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className="studio-select" defaultValue="minimal">
                    <option value="minimal">Minimal stroke</option>
                    <option value="filled">Flat fill</option>
                    <option value="badge">Badge icon</option>
                  </select>
                  <button className="studio-button studio-button-secondary w-full opacity-60" type="button" disabled>
                    Generate (V2)
                  </button>
                </div>
              </div>
            </Section>
          </Panel>

          <Panel eyebrow="Preview" title="Live Canvas">
            <div className="studio-preview-card flex min-h-full flex-col gap-4 p-4 lg:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="studio-label">Preview background</p>
                  <p className="text-sm text-slate-300">
                    This color is only for visual checking and never exported.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                  <label className="studio-label !m-0 text-[0.68rem]" htmlFor="preview-bg-inline">
                    Background
                  </label>
                  <input
                    id="preview-bg-inline"
                    aria-label="Preview background color"
                    className="h-10 w-10 rounded-full border border-white/10 bg-transparent"
                    type="color"
                    value={activeDocument.controls.previewBgColor}
                    onChange={(event) => updateControl({ previewBgColor: event.target.value })}
                  />
                </div>
              </div>

              <div
                className="studio-preview-stage studio-grid relative flex flex-1 items-center justify-center p-6"
                style={{ backgroundColor: activeDocument.controls.previewBgColor }}
              >
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="studio-badge bg-black/25 text-slate-100">
                    {hasAsset ? "Imported asset" : "Placeholder preview"}
                  </span>
                  {isPending ? (
                    <span className="studio-badge bg-white/12 text-slate-100">Updating…</span>
                  ) : null}
                </div>
                {!hasAsset ? (
                  <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-2xl border border-white/10 bg-black/18 px-3 py-3 text-sm leading-6 text-slate-200">
                    Import an SVG to replace the placeholder card and export the result as a transparent asset.
                  </div>
                ) : null}
                <div
                  className="w-full max-w-[820px]"
                  dangerouslySetInnerHTML={{ __html: previewMarkup }}
                />
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Controls" title="Projection + Export">
            <Section title="Projection" description="Affine controls shape the faux-isometric projection of the full SVG group.">
              <div className="grid gap-3 sm:grid-cols-3">
                {PROJECTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="studio-button studio-button-secondary w-full"
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
                  max={1.25}
                  step={0.01}
                  value={activeDocument.controls.scaleY}
                  onChange={(value) => updateControl({ scaleY: value })}
                />
                <RangeField
                  label="Fit scale"
                  min={0.5}
                  max={2}
                  step={0.01}
                  value={activeDocument.controls.fitScale}
                  onChange={(value) => updateControl({ fitScale: value })}
                />
              </div>
            </Section>

            <Section title="Trail" description="Duplicate the projected SVG along one axis with opacity falloff.">
              <div className="space-y-4">
                <RangeField
                  label="Trail count"
                  min={0}
                  max={24}
                  step={1}
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
                  value={activeDocument.controls.opacityStart}
                  onChange={(value) => updateControl({ opacityStart: value })}
                />
                <RangeField
                  label="Opacity end"
                  min={0}
                  max={1}
                  step={0.01}
                  value={activeDocument.controls.opacityEnd}
                  onChange={(value) => updateControl({ opacityEnd: value })}
                />
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-white">Reverse trail</span>
                    <span className="block text-xs text-slate-400">Send the stack in the opposite direction.</span>
                  </span>
                  <input
                    aria-label="Reverse trail"
                    className="h-5 w-5 accent-indigo-300"
                    type="checkbox"
                    checked={activeDocument.controls.reverseTrail}
                    onChange={(event) => updateControl({ reverseTrail: event.target.checked })}
                  />
                </label>
              </div>
            </Section>

            <Section title="Color" description="Set the art tint and the preview-only background separately.">
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
                    aria-label="Preview background color control"
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
                onClick={() => updateControl(DEFAULT_CONTROLS)}
              >
                Reset controls
              </button>
            </Section>

            <Section title="Export" description="Exports are transparent. The preview background is not included in the output.">
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
                    ? "SVG exports stay vector. PNG exports render from the same transparent SVG scene."
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
