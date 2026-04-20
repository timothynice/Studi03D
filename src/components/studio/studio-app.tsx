"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  createDefaultControls,
  PLACEHOLDER_ASSET,
  PROJECTION_PRESETS,
  WARNING_COPY,
} from "@/lib/studio/constants";
import {
  CONTROL_LIMITS,
  fitScaleFromCanvasPoint,
  getCanvasHandleGeometry,
  rotationFromCanvasPoint,
  skewFromCanvasPoint,
  trailOffsetFromCanvasPoint,
  type CanvasBox,
  type CanvasPoint,
  type StudioCanvasHandle,
  type StudioCanvasInteractionState,
} from "@/lib/studio/canvas-handles";
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
type CanvasDragMode = "rotate" | "skew" | "scale" | "trail" | null;
type LibrarySectionId = "projects" | "import" | "generate";
type TooltipPlacement = "top" | "bottom";

interface StudioCanvasDragState extends StudioCanvasInteractionState {
  dragMode: CanvasDragMode;
  pointerId: number | null;
  startFitScale: number;
  startDistance: number;
}

const DEFAULT_CANVAS_DRAG_STATE: StudioCanvasDragState = {
  activeHandle: null,
  hoverHandle: null,
  dragOrigin: null,
  stageBounds: null,
  dragMode: null,
  pointerId: null,
  startFitScale: 1,
  startDistance: 1,
};

interface TooltipState {
  id: string;
  anchorElement: HTMLElement;
  content: ReactNode;
  preferredPlacement: TooltipPlacement;
}

interface TooltipPosition {
  left: number;
  top: number;
  placement: TooltipPlacement;
  ready: boolean;
}

interface TooltipContextValue {
  showTooltip: (tooltip: TooltipState) => void;
  hideTooltip: (id: string) => void;
}

const DEFAULT_TOOLTIP_POSITION: TooltipPosition = {
  left: 0,
  top: 0,
  placement: "bottom",
  ready: false,
};

const TooltipContext = createContext<TooltipContextValue | null>(null);

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

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function shouldShowTooltip() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth > MOBILE_MAX && window.matchMedia("(hover: hover)").matches;
}

function DrawerToggleIcon({
  side,
  open,
}: Readonly<{
  side: "left" | "right";
  open: boolean;
}>) {
  const isLeft = side === "left";
  const chevronPath = open
    ? isLeft
      ? "M10.75 4.25L6.5 8L10.75 11.75"
      : "M5.25 4.25L9.5 8L5.25 11.75"
    : isLeft
      ? "M5.25 4.25L9.5 8L5.25 11.75"
      : "M10.75 4.25L6.5 8L10.75 11.75";

  return (
    <svg aria-hidden="true" className="studio-icon" viewBox="0 0 16 16">
      <path
        d={isLeft ? "M4 2.5V13.5" : "M12 2.5V13.5"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
      <path
        d={chevronPath}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SectionChevronIcon({ open }: Readonly<{ open: boolean }>) {
  return (
    <svg aria-hidden="true" className="studio-section-chevron-icon" viewBox="0 0 16 16">
      <path
        d={open ? "M4.25 9.75L8 6L11.75 9.75" : "M4.25 6.25L8 10L11.75 6.25"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ThemeToggleIcon({ theme }: Readonly<{ theme: ThemeMode }>) {
  if (theme === "dark") {
    return (
      <svg aria-hidden="true" className="studio-icon" viewBox="0 0 20 20">
        <path
          d="M10 4.2V2.5M10 17.5v-1.7M15.8 10h1.7M2.5 10h1.7M14.3 5.7l1.2-1.2M4.5 15.5l1.2-1.2M14.3 14.3l1.2 1.2M4.5 4.5l1.2 1.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.3"
        />
        <circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="studio-icon" viewBox="0 0 20 20">
      <path
        d="M12.7 3.3a6.7 6.7 0 1 0 4 11.9A7.5 7.5 0 0 1 12.7 3.3Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function TooltipProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState<TooltipPosition>(DEFAULT_TOOLTIP_POSITION);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updateTooltipPosition = useEffectEvent(() => {
    if (!activeTooltip || !tooltipRef.current) {
      return;
    }

    if (!document.body.contains(activeTooltip.anchorElement)) {
      setActiveTooltip(null);
      return;
    }

    const anchorRect = activeTooltip.anchorElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 10;
    let placement = activeTooltip.preferredPlacement;
    let top = anchorRect.bottom + gap;

    if (
      placement === "bottom" &&
      top + tooltipRect.height > viewportHeight - margin &&
      anchorRect.top - gap - tooltipRect.height >= margin
    ) {
      placement = "top";
      top = anchorRect.top - gap - tooltipRect.height;
    } else if (placement === "top") {
      const preferredTop = anchorRect.top - gap - tooltipRect.height;

      if (
        preferredTop < margin &&
        anchorRect.bottom + gap + tooltipRect.height <= viewportHeight - margin
      ) {
        placement = "bottom";
        top = anchorRect.bottom + gap;
      } else {
        top = preferredTop;
      }
    }

    const maxLeft = viewportWidth - margin - tooltipRect.width;
    const maxTop = viewportHeight - margin - tooltipRect.height;
    const left = Math.min(Math.max(margin, anchorRect.left), Math.max(margin, maxLeft));

    setPosition({
      left,
      top: Math.min(Math.max(margin, top), Math.max(margin, maxTop)),
      placement,
      ready: true,
    });
  });

  useLayoutEffect(() => {
    if (!activeTooltip) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateTooltipPosition();
    });

    const handleUpdate = () => {
      updateTooltipPosition();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTooltip(null);
      }
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTooltip]);

  return (
    <TooltipContext.Provider
      value={{
        showTooltip: (tooltip) => {
          setActiveTooltip(tooltip);
          setPosition(DEFAULT_TOOLTIP_POSITION);
        },
        hideTooltip: (id) => {
          setActiveTooltip((current) => (current?.id === id ? null : current));
        },
      }}
    >
      {children}
      {typeof document !== "undefined" && activeTooltip
        ? createPortal(
            <div
              ref={tooltipRef}
              aria-hidden={!position.ready}
              className={joinClassNames(
                "studio-tooltip-layer",
                position.ready ? "is-visible" : null,
              )}
              data-placement={position.placement}
              role="tooltip"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
              }}
            >
              {activeTooltip.content}
            </div>,
            document.body,
          )
        : null}
    </TooltipContext.Provider>
  );
}

function TooltipAnchor({
  tooltip,
  className,
  preferredPlacement = "bottom",
  children,
}: Readonly<{
  tooltip?: ReactNode;
  className?: string;
  preferredPlacement?: TooltipPlacement;
  children: ReactNode;
}>) {
  const tooltipContext = useContext(TooltipContext);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement | null>(null);

  const openTooltip = () => {
    if (!tooltip || !tooltipContext || !anchorRef.current || !shouldShowTooltip()) {
      return;
    }

    tooltipContext.showTooltip({
      id: tooltipId,
      anchorElement: anchorRef.current,
      content: tooltip,
      preferredPlacement,
    });
  };

  const closeTooltip = () => {
    if (!tooltipContext) {
      return;
    }

    tooltipContext.hideTooltip(tooltipId);
  };

  return (
    <span
      ref={anchorRef}
      className={joinClassNames("studio-tooltip-anchor", tooltip ? "has-tooltip" : null, className)}
      tabIndex={tooltip ? 0 : undefined}
      onBlur={tooltip ? closeTooltip : undefined}
      onFocus={tooltip ? openTooltip : undefined}
      onPointerEnter={
        tooltip
          ? (event) => {
              if (event.pointerType !== "mouse") {
                return;
              }

              openTooltip();
            }
          : undefined
      }
      onPointerLeave={tooltip ? closeTooltip : undefined}
    >
      {children}
    </span>
  );
}

function TooltipButtonAnchor({
  tooltip,
  preferredPlacement = "bottom",
  className,
  children,
  onBlur,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  ...buttonProps
}: Readonly<
  {
    tooltip?: ReactNode;
    preferredPlacement?: TooltipPlacement;
  } & ComponentPropsWithoutRef<"button">
>) {
  const tooltipContext = useContext(TooltipContext);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const openTooltip = () => {
    if (!tooltip || !tooltipContext || !anchorRef.current || !shouldShowTooltip()) {
      return;
    }

    tooltipContext.showTooltip({
      id: tooltipId,
      anchorElement: anchorRef.current,
      content: tooltip,
      preferredPlacement,
    });
  };

  const closeTooltip = () => {
    if (!tooltipContext) {
      return;
    }

    tooltipContext.hideTooltip(tooltipId);
  };

  return (
    <button
      {...buttonProps}
      ref={anchorRef}
      className={joinClassNames("studio-tooltip-anchor", tooltip ? "has-tooltip" : null, className)}
      onBlur={(event) => {
        onBlur?.(event);
        closeTooltip();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        openTooltip();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);

        if (event.pointerType !== "mouse") {
          return;
        }

        openTooltip();
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        closeTooltip();
      }}
    >
      {children}
    </button>
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
        <TooltipAnchor className="studio-field-heading" tooltip={tooltip}>
          <label htmlFor={`${fieldId}-number`}>{label}</label>
        </TooltipAnchor>
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
      <TooltipAnchor className="studio-toggle-copy" tooltip={tooltip}>
        <strong>{label}</strong>
      </TooltipAnchor>
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
        <TooltipAnchor className="studio-rail-heading" tooltip={info}>
          <p className="studio-rail-title">{title}</p>
        </TooltipAnchor>
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
  open,
  onToggle,
  children,
}: Readonly<{
  title: string;
  info?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}>) {
  return (
    <section className={`studio-drawer-section ${open ? "is-expanded" : "is-collapsed"}`}>
      <div className="studio-drawer-section-head">
        <TooltipButtonAnchor
          aria-expanded={open}
          className="studio-drawer-section-toggle"
          tooltip={info}
          type="button"
          onClick={onToggle}
        >
          <span className="studio-rail-title">{title}</span>
          <SectionChevronIcon open={open} />
        </TooltipButtonAnchor>
      </div>
      {open ? <div className="studio-drawer-section-body">{children}</div> : null}
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

function StudioMark({ theme }: Readonly<{ theme: ThemeMode }>) {
  const markSrc = theme === "dark" ? "/studi0/logo-mark-on-dark.svg" : "/studi0/logo-mark.svg";

  return (
    <Link className="studio-app-brand" href="/">
      <Image alt="" className="studio-brand-mark" height={18} src={markSrc} unoptimized width={18} />
    </Link>
  );
}

function DrawerHeader({
  title,
  side,
  open,
  onToggle,
}: Readonly<{
  title: string;
  side: "left" | "right";
  open: boolean;
  onToggle: () => void;
}>) {
  const label = `${open ? "Collapse" : "Expand"} ${title.toLowerCase()} drawer`;

  return (
    <div className={`studio-drawer-header ${open ? "is-open" : "is-collapsed"}`}>
      {side === "left" ? (
        <>
          <button aria-label={label} className="studio-icon-button" type="button" onClick={onToggle}>
            <DrawerToggleIcon side={side} open={open} />
          </button>
          {open ? <p className="studio-drawer-title">{title}</p> : null}
        </>
      ) : (
        <>
          {open ? <p className="studio-drawer-title">{title}</p> : null}
          <button aria-label={label} className="studio-icon-button" type="button" onClick={onToggle}>
            <DrawerToggleIcon side={side} open={open} />
          </button>
        </>
      )}
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
  const [leftSectionState, setLeftSectionState] = useState<Record<LibrarySectionId, boolean>>({
    projects: true,
    import: !activeDocument.asset,
    generate: false,
  });
  const [previewCanvasBox, setPreviewCanvasBox] = useState<CanvasBox | null>(null);
  const [stageViewport, setStageViewport] = useState<{ width: number; height: number }>({
    width: 1,
    height: 1,
  });
  const [canvasInteraction, setCanvasInteraction] = useState<StudioCanvasDragState>(
    DEFAULT_CANVAS_DRAG_STATE,
  );
  const hasPersistedDrawerStateRef = useRef<boolean | null>(null);
  const hasAppliedViewportDefaultsRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasOverlayRef = useRef<SVGSVGElement | null>(null);

  const hasAsset = Boolean(activeDocument.asset);
  const enabledPatternCount = activeDocument.controls.trailPattern.filter((cell) => cell.enabled).length;
  const visibleTrailCount = activeDocument.controls.useCustomTrailPattern
    ? enabledPatternCount
    : activeDocument.controls.trailCount;
  const canShowCanvasHandles = hasAsset && viewportMode !== "mobile" && previewCanvasBox !== null;
  const canvasHandleGeometry =
    canShowCanvasHandles && previewCanvasBox
      ? getCanvasHandleGeometry(activeDocument.asset ?? PLACEHOLDER_ASSET, activeDocument.controls, previewCanvasBox)
      : null;
  const collapsedDrawerInset = viewportMode === "mobile" ? "0px" : "32px";

  const workspaceInsets = {
    "--studio-left-inset": viewportMode === "mobile" ? "0px" : leftDrawerOpen ? "320px" : collapsedDrawerInset,
    "--studio-right-inset": viewportMode === "mobile" ? "0px" : rightDrawerOpen ? "364px" : collapsedDrawerInset,
  } as CSSProperties;

  const isLeftOverlay = viewportMode === "mobile";
  const isRightOverlay = viewportMode === "mobile";
  const showOverlayScrim = viewportMode === "mobile" && (leftDrawerOpen || rightDrawerOpen);

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

  const syncCanvasMetrics = useEffectEvent(() => {
    const stageElement = stageRef.current;

    if (!stageElement) {
      setPreviewCanvasBox(null);
      setStageViewport({ width: 1, height: 1 });
      return;
    }

    const stageRect = stageElement.getBoundingClientRect();
    setStageViewport({
      width: Math.max(1, stageRect.width),
      height: Math.max(1, stageRect.height),
    });
    const svgElement = stageElement.querySelector("svg");

    if (!svgElement) {
      setPreviewCanvasBox(null);
      return;
    }

    const svgRect = svgElement.getBoundingClientRect();

    if (!svgRect.width || !svgRect.height) {
      setPreviewCanvasBox(null);
      return;
    }

    setPreviewCanvasBox({
      x: svgRect.left - stageRect.left,
      y: svgRect.top - stageRect.top,
      width: svgRect.width,
      height: svgRect.height,
    });
  });

  useEffect(() => {
    const stageElement = stageRef.current;

    if (!stageElement) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      syncCanvasMetrics();
    });

    const handleResize = () => {
      syncCanvasMetrics();
    };

    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        syncCanvasMetrics();
      });
      observer.observe(stageElement);
      const svgElement = stageElement.querySelector("svg");
      if (svgElement) {
        observer.observe(svgElement);
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [leftDrawerOpen, previewMarkup, rightDrawerOpen, viewportMode]);

  function getPointerOnStage(clientX: number, clientY: number): CanvasPoint | null {
    const stageElement = stageRef.current;

    if (!stageElement) {
      return null;
    }

    const stageRect = stageElement.getBoundingClientRect();

    return {
      x: clientX - stageRect.left,
      y: clientY - stageRect.top,
    };
  }

  function endCanvasInteraction(pointerId?: number) {
    if (typeof pointerId === "number" && canvasOverlayRef.current?.hasPointerCapture(pointerId)) {
      canvasOverlayRef.current.releasePointerCapture(pointerId);
    }

    setCanvasInteraction(DEFAULT_CANVAS_DRAG_STATE);
  }

  function beginCanvasInteraction(
    event: ReactPointerEvent<SVGElement>,
    handle: StudioCanvasHandle,
    dragMode: Exclude<CanvasDragMode, null>,
  ) {
    if (!canvasHandleGeometry || !previewCanvasBox) {
      return;
    }

    const pointer = getPointerOnStage(event.clientX, event.clientY);

    if (!pointer) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    canvasOverlayRef.current?.setPointerCapture(event.pointerId);

    setCanvasInteraction({
      activeHandle: handle,
      hoverHandle: handle,
      dragOrigin: pointer,
      stageBounds: previewCanvasBox,
      dragMode,
      pointerId: event.pointerId,
      startFitScale: activeDocument.controls.fitScale,
      startDistance: Math.max(1, Math.hypot(pointer.x - canvasHandleGeometry.center.x, pointer.y - canvasHandleGeometry.center.y)),
    });

    setActiveControlSection(handle === "trail" ? "trail" : "transform");
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!canvasHandleGeometry || !previewCanvasBox || !canvasInteraction.dragMode) {
      return;
    }

    const pointer = getPointerOnStage(event.clientX, event.clientY);

    if (!pointer) {
      return;
    }

    if (canvasInteraction.dragMode === "rotate") {
      updateControl({
        rotationDeg: rotationFromCanvasPoint(pointer, canvasHandleGeometry.center),
      });
      return;
    }

    if (canvasInteraction.dragMode === "skew") {
      updateControl({
        skewXDeg: skewFromCanvasPoint(
          pointer,
          canvasHandleGeometry.skewGuideStart.x,
          canvasHandleGeometry.skewGuideEnd.x,
        ),
      });
      return;
    }

    if (canvasInteraction.dragMode === "scale") {
      updateControl({
        fitScale: fitScaleFromCanvasPoint(
          pointer,
          canvasHandleGeometry.center,
          canvasInteraction.startFitScale,
          canvasInteraction.startDistance,
        ),
      });
      return;
    }

    const offsets = trailOffsetFromCanvasPoint(
      pointer,
      canvasHandleGeometry.centerScene,
      canvasHandleGeometry.sceneBounds,
      previewCanvasBox,
    );

    updateControl(offsets);
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    endCanvasInteraction(event.pointerId);
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
        revealImportSection();

        if (suggestedName && /^Draft \d+$/.test(activeDocument.name) && !activeDocument.asset) {
          renameDraft(activeDocument.id, suggestedName);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The SVG could not be loaded.";
      setImportError(message);
      setImportNotice(null);
      revealImportSection();
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
      revealImportSection();
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
      revealImportSection();
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
      activeMobileDrawer: null,
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
    if (viewportMode !== "mobile") {
      return;
    }

    setDrawerState({
      leftDrawerOpen: false,
      rightDrawerOpen: false,
      activeMobileDrawer: null,
    });
  }

  function activateSection(section: StudioUiSection) {
    setActiveControlSection(section);
  }

  function toggleLeftSection(section: LibrarySectionId) {
    setLeftSectionState((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function revealImportSection() {
    setLeftSectionState((current) =>
      current.import ? current : { ...current, import: true },
    );
  }

  return (
    <TooltipProvider>
      <main className="studio-shell" data-viewport={viewportMode}>
      <header className="studio-app-bar">
        <div className="studio-app-bar-left">
          <StudioMark theme={theme} />
          <h1 className="studio-app-bar-title">{activeDocument.name}</h1>
        </div>

        <button
          aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          className="studio-icon-button studio-theme-toggle"
          type="button"
          onClick={toggleTheme}
        >
          <ThemeToggleIcon theme={theme} />
        </button>
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
          className={`studio-app-drawer studio-app-drawer-left ${
            leftDrawerOpen ? "is-open" : isLeftOverlay ? "" : "is-collapsed"
          } ${isLeftOverlay ? "is-overlay" : ""}`}
        >
          <DrawerHeader title="Library" side="left" open={leftDrawerOpen} onToggle={handleToggleLeftDrawer} />
          {leftDrawerOpen ? (
          <div className="studio-drawer-scroll">
            <DrawerSection
              title="Projects"
              open={leftSectionState.projects}
              onToggle={() => toggleLeftSection("projects")}
              info="Projects are stored locally in this browser and restore on reload."
            >
              <div className="studio-field">
                <span className="studio-field-heading">
                  <label className="studio-field-label" htmlFor="draft-name">
                    Name
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
                  New project
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
              open={leftSectionState.import}
              onToggle={() => toggleLeftSection("import")}
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
              {hasAsset ? (
                <div className="studio-import-summary">
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
                </div>
              ) : (
                <p className="studio-inline-status">Placeholder preview is active.</p>
              )}
            </DrawerSection>

            <DrawerSection
              title="Generate"
              open={leftSectionState.generate}
              onToggle={() => toggleLeftSection("generate")}
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
          ) : null}
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
              ref={stageRef}
              className="studio-stage studio-grid-surface"
              style={{ backgroundColor: activeDocument.controls.previewBgColor }}
            >
              {isPending ? <div className="studio-status-pill">Updating</div> : null}
              <div className="studio-stage-markup" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
              {canvasHandleGeometry ? (
                <svg
                  ref={canvasOverlayRef}
                  aria-hidden="true"
                  className={`studio-canvas-overlay ${
                    canvasInteraction.activeHandle ? "is-dragging" : ""
                  }`}
                  viewBox={`0 0 ${stageViewport.width} ${stageViewport.height}`}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  onPointerLeave={() =>
                    setCanvasInteraction((current) =>
                      current.activeHandle ? current : { ...current, hoverHandle: null },
                    )
                  }
                >
                  <defs>
                    <marker
                      id="studio-trail-arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="4"
                      refY="4"
                      orient="auto-start-reverse"
                    >
                      <path d="M1 1L7 4L1 7V1Z" fill="currentColor" />
                    </marker>
                  </defs>

                  <g className={`studio-pose-gizmo ${canvasInteraction.activeHandle === "pose" ? "is-active" : ""}`}>
                    <circle
                      cx={canvasHandleGeometry.center.x}
                      cy={canvasHandleGeometry.center.y}
                      r="6"
                      className="studio-gizmo-center"
                    />
                    <circle
                      cx={canvasHandleGeometry.center.x}
                      cy={canvasHandleGeometry.center.y}
                      r={Math.max(
                        24,
                        Math.hypot(
                          canvasHandleGeometry.rotateHandle.x - canvasHandleGeometry.center.x,
                          canvasHandleGeometry.rotateHandle.y - canvasHandleGeometry.center.y,
                        ),
                      )}
                      className="studio-gizmo-ring"
                    />
                    <line
                      x1={canvasHandleGeometry.center.x}
                      y1={canvasHandleGeometry.center.y}
                      x2={canvasHandleGeometry.rotateHandle.x}
                      y2={canvasHandleGeometry.rotateHandle.y}
                      className="studio-gizmo-guide"
                    />
                    <line
                      x1={canvasHandleGeometry.center.x}
                      y1={canvasHandleGeometry.center.y}
                      x2={canvasHandleGeometry.scaleHandle.x}
                      y2={canvasHandleGeometry.scaleHandle.y}
                      className="studio-gizmo-guide studio-gizmo-guide-scale"
                    />
                    <line
                      x1={canvasHandleGeometry.skewGuideStart.x}
                      y1={canvasHandleGeometry.skewGuideStart.y}
                      x2={canvasHandleGeometry.skewGuideEnd.x}
                      y2={canvasHandleGeometry.skewGuideEnd.y}
                      className="studio-gizmo-guide"
                    />
                    <circle
                      data-testid="canvas-handle-rotate"
                      cx={canvasHandleGeometry.rotateHandle.x}
                      cy={canvasHandleGeometry.rotateHandle.y}
                      r="10"
                      className="studio-canvas-handle"
                      onPointerDown={(event) => beginCanvasInteraction(event, "pose", "rotate")}
                      onPointerEnter={() =>
                        setCanvasInteraction((current) => ({ ...current, hoverHandle: "pose" }))
                      }
                    />
                    <circle
                      data-testid="canvas-handle-skew"
                      cx={canvasHandleGeometry.skewHandle.x}
                      cy={canvasHandleGeometry.skewHandle.y}
                      r="9"
                      className="studio-canvas-handle studio-canvas-handle-alt"
                      onPointerDown={(event) => beginCanvasInteraction(event, "pose", "skew")}
                      onPointerEnter={() =>
                        setCanvasInteraction((current) => ({ ...current, hoverHandle: "pose" }))
                      }
                    />
                    <circle
                      data-testid="canvas-handle-scale"
                      cx={canvasHandleGeometry.scaleHandle.x}
                      cy={canvasHandleGeometry.scaleHandle.y}
                      r="9"
                      className="studio-canvas-handle studio-canvas-handle-scale"
                      onPointerDown={(event) => beginCanvasInteraction(event, "pose", "scale")}
                      onPointerEnter={() =>
                        setCanvasInteraction((current) => ({ ...current, hoverHandle: "pose" }))
                      }
                    />
                  </g>

                  <g className={`studio-trail-gizmo ${canvasInteraction.activeHandle === "trail" ? "is-active" : ""}`}>
                    <line
                      x1={canvasHandleGeometry.center.x}
                      y1={canvasHandleGeometry.center.y}
                      x2={canvasHandleGeometry.trailHandle.x}
                      y2={canvasHandleGeometry.trailHandle.y}
                      className="studio-trail-line"
                      markerEnd="url(#studio-trail-arrow)"
                    />
                    <circle
                      cx={canvasHandleGeometry.center.x}
                      cy={canvasHandleGeometry.center.y}
                      r="5"
                      className="studio-gizmo-center studio-gizmo-center-trail"
                    />
                    <circle
                      data-testid="canvas-handle-trail"
                      cx={canvasHandleGeometry.trailHandle.x}
                      cy={canvasHandleGeometry.trailHandle.y}
                      r="10"
                      className="studio-canvas-handle studio-canvas-handle-trail"
                      onPointerDown={(event) => beginCanvasInteraction(event, "trail", "trail")}
                      onPointerEnter={() =>
                        setCanvasInteraction((current) => ({ ...current, hoverHandle: "trail" }))
                      }
                    />
                  </g>
                </svg>
              ) : null}
            </div>
          </section>
        </section>

        <aside
          aria-label="Controls drawer"
          className={`studio-app-drawer studio-app-drawer-right ${
            rightDrawerOpen ? "is-open" : isRightOverlay ? "" : "is-collapsed"
          } ${isRightOverlay ? "is-overlay" : ""}`}
        >
          <DrawerHeader title="Controls" side="right" open={rightDrawerOpen} onToggle={handleToggleRightDrawer} />
          {rightDrawerOpen ? (
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
                      min={CONTROL_LIMITS.rotationDeg.min}
                      max={CONTROL_LIMITS.rotationDeg.max}
                      step={1}
                      value={activeDocument.controls.rotationDeg}
                      tooltip="Rotate the whole SVG group before skewing it into the isometric pose."
                      onChange={(value) => updateControl({ rotationDeg: value })}
                    />
                    <RangeField
                      label="Skew X"
                      min={CONTROL_LIMITS.skewXDeg.min}
                      max={CONTROL_LIMITS.skewXDeg.max}
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
                      min={CONTROL_LIMITS.fitScale.min}
                      max={CONTROL_LIMITS.fitScale.max}
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
                      min={CONTROL_LIMITS.trailOffset.min}
                      max={CONTROL_LIMITS.trailOffset.max}
                      step={1}
                      value={activeDocument.controls.trailOffsetX}
                      tooltip="Shift each layer left or right between trail steps."
                      onChange={(value) => updateControl({ trailOffsetX: value })}
                    />
                    <RangeField
                      label="Offset Y"
                      min={CONTROL_LIMITS.trailOffset.min}
                      max={CONTROL_LIMITS.trailOffset.max}
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
          ) : null}
        </aside>
      </div>
      </main>
    </TooltipProvider>
  );
}
