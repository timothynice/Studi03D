import type { NormalizedSvgAsset, StudioControls, WarningCode } from "@/lib/studio/types";

export const STORAGE_KEY = "studi03d-svg-studio";
export const STORAGE_VERSION = 1;

export const DEFAULT_CONTROLS: StudioControls = {
  rotationDeg: -28,
  skewXDeg: -26,
  scaleY: 0.82,
  fitScale: 1.12,
  trailCount: 6,
  trailOffsetX: 20,
  trailOffsetY: -12,
  opacityStart: 0.12,
  opacityEnd: 0.38,
  reverseTrail: false,
  artColor: "#cfd7ff",
  previewBgColor: "#141824",
};

export const PROJECTION_PRESETS = [
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
  {
    label: "Front Tilt",
    values: {
      rotationDeg: -12,
      skewXDeg: -14,
      scaleY: 0.9,
      fitScale: 1.06,
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
  sanitizedSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220"><rect x="22" y="18" width="116" height="184" rx="28" fill="none" stroke="currentColor" stroke-width="6"/><rect x="38" y="36" width="84" height="148" rx="18" fill="none" stroke="currentColor" stroke-opacity="0.48" stroke-width="4"/></svg>`,
  width: 160,
  height: 220,
  viewBox: "0 0 160 220",
  hasStroke: true,
  hasFill: false,
  detectedColorCount: 1,
  warningCodes: [],
};
