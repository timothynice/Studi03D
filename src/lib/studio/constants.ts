import type {
  NormalizedSvgAsset,
  StudioControls,
  TrailPatternCell,
  WarningCode,
} from "@/lib/studio/types";

export const STORAGE_KEY = "studi03d-svg-studio";
export const STORAGE_VERSION = 2;
export const TRAIL_PATTERN_SIZE = 12;

export function createDefaultTrailPattern(): TrailPatternCell[] {
  return Array.from({ length: TRAIL_PATTERN_SIZE }, (_, index) => ({
    enabled: index < 2,
    opacity: index === 0 ? 0.18 : 0.28,
    matte: false,
  }));
}

export function createDefaultControls(): StudioControls {
  return {
    rotationDeg: -12,
    skewXDeg: -12,
    scaleY: 1.06,
    fitScale: 1.54,
    strokeScale: 1,
    trailCount: 2,
    trailOffsetX: 18,
    trailOffsetY: -11,
    opacityStart: 0.18,
    opacityEnd: 0.32,
    reverseTrail: false,
    useCustomTrailPattern: false,
    trailPattern: createDefaultTrailPattern(),
    artColor: "#cfd7ff",
    previewBgColor: "#141824",
  };
}

export const DEFAULT_CONTROLS = createDefaultControls();

export const PROJECTION_PRESETS = [
  {
    label: "Reference",
    values: {
      rotationDeg: -12,
      skewXDeg: -12,
      scaleY: 1.06,
      fitScale: 1.54,
    },
  },
  {
    label: "Left Iso",
    values: {
      rotationDeg: -28,
      skewXDeg: -26,
      scaleY: 0.82,
      fitScale: 1.12,
    },
  },
  {
    label: "Right Iso",
    values: {
      rotationDeg: 28,
      skewXDeg: 26,
      scaleY: 0.82,
      fitScale: 1.12,
    },
  },
] as const;

export const WARNING_COPY: Record<WarningCode, string> = {
  "multi-color-flattened":
    "Multiple source colors were detected. V1 flattens supported fills and strokes into the selected art color.",
  "unsupported-paint":
    "Gradients, patterns, or CSS-driven paint were detected. V1 targets simple filled or stroked icons only.",
  "missing-viewbox":
    "The SVG did not include a usable viewBox, so width and height were used to build one.",
};

export const PLACEHOLDER_ASSET: NormalizedSvgAsset = {
  sourceSvg: "",
  sanitizedSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220"><rect x="22" y="18" width="116" height="184" rx="28" fill="none" stroke="currentColor" style="stroke-width: calc(var(--studio-stroke-scale, 1) * 6px)"/><rect x="38" y="36" width="84" height="148" rx="18" fill="none" stroke="currentColor" stroke-opacity="0.48" style="stroke-width: calc(var(--studio-stroke-scale, 1) * 4px)"/></svg>`,
  width: 160,
  height: 220,
  viewBox: "0 0 160 220",
  hasStroke: true,
  hasFill: false,
  detectedColorCount: 1,
  warningCodes: [],
};
