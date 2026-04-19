export type WarningCode =
  | "multi-color-flattened"
  | "unsupported-paint"
  | "missing-viewbox";

export interface StudioControls {
  rotationDeg: number;
  skewXDeg: number;
  scaleY: number;
  fitScale: number;
  trailCount: number;
  trailOffsetX: number;
  trailOffsetY: number;
  opacityStart: number;
  opacityEnd: number;
  reverseTrail: boolean;
  artColor: string;
  previewBgColor: string;
}

export interface NormalizedSvgAsset {
  sourceSvg: string;
  sanitizedSvg: string;
  width: number;
  height: number;
  viewBox: string;
  hasStroke: boolean;
  hasFill: boolean;
  detectedColorCount: number;
  warningCodes: WarningCode[];
}

export interface StudioDocument {
  id: string;
  name: string;
  asset: NormalizedSvgAsset | null;
  controls: StudioControls;
  createdAt: string;
  updatedAt: string;
}

export interface PromptGenerationRequest {
  prompt: string;
  styleHint?: string;
  artColor?: string;
}

export interface PromptGenerationResponse {
  status: "stub";
  message: string;
}

export interface ViewBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface TrailGhost {
  step: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}
