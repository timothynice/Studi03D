import type { Bounds, NormalizedSvgAsset, StudioControls } from "@/lib/studio/types";
import {
  applyMatrixToPoint,
  calculateSceneBounds,
  clamp,
  createProjectionMatrix,
  parseViewBox,
  padBounds,
} from "@/lib/studio/transform";

export const CONTROL_LIMITS = {
  rotationDeg: { min: -70, max: 70 },
  skewXDeg: { min: -70, max: 70 },
  fitScale: { min: 0.5, max: 2.3 },
  trailOffset: { min: -80, max: 80 },
} as const;

export type StudioCanvasHandle = "pose" | "trail" | null;

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioCanvasInteractionState {
  activeHandle: StudioCanvasHandle;
  hoverHandle: StudioCanvasHandle;
  dragOrigin: CanvasPoint | null;
  stageBounds: CanvasBox | null;
}

export interface CanvasHandleGeometry {
  sceneBounds: Bounds;
  assetBounds: Bounds;
  centerScene: CanvasPoint;
  center: CanvasPoint;
  rotateHandle: CanvasPoint;
  scaleHandle: CanvasPoint;
  skewGuideStart: CanvasPoint;
  skewGuideEnd: CanvasPoint;
  skewHandle: CanvasPoint;
  trailHandle: CanvasPoint;
}

function formatCoordinate(value: number) {
  return Number(value.toFixed(3));
}

function boundsWidth(bounds: Bounds) {
  return bounds.maxX - bounds.minX;
}

function boundsHeight(bounds: Bounds) {
  return bounds.maxY - bounds.minY;
}

function pointOnCircle(center: CanvasPoint, radius: number, degrees: number): CanvasPoint {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: center.x + Math.cos(radians) * radius,
    y: center.y + Math.sin(radians) * radius,
  };
}

function projectedAssetBounds(asset: NormalizedSvgAsset, controls: StudioControls): Bounds {
  const viewBox = parseViewBox(asset.viewBox);
  const projection = createProjectionMatrix(viewBox, controls);
  const corners = [
    { x: viewBox.x, y: viewBox.y },
    { x: viewBox.x + viewBox.width, y: viewBox.y },
    { x: viewBox.x, y: viewBox.y + viewBox.height },
    { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
  ].map((corner) => applyMatrixToPoint(projection, corner.x, corner.y));

  return corners.reduce<Bounds>(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

export function getPreviewSceneBounds(viewBox: string, controls: StudioControls): Bounds {
  return padBounds(calculateSceneBounds(viewBox, controls), 34);
}

export function scenePointToCanvas(point: CanvasPoint, sceneBounds: Bounds, canvasBox: CanvasBox): CanvasPoint {
  return {
    x: canvasBox.x + ((point.x - sceneBounds.minX) / boundsWidth(sceneBounds)) * canvasBox.width,
    y: canvasBox.y + ((point.y - sceneBounds.minY) / boundsHeight(sceneBounds)) * canvasBox.height,
  };
}

export function canvasPointToScene(point: CanvasPoint, sceneBounds: Bounds, canvasBox: CanvasBox): CanvasPoint {
  return {
    x: sceneBounds.minX + ((point.x - canvasBox.x) / canvasBox.width) * boundsWidth(sceneBounds),
    y: sceneBounds.minY + ((point.y - canvasBox.y) / canvasBox.height) * boundsHeight(sceneBounds),
  };
}

export function rotationFromCanvasPoint(pointer: CanvasPoint, center: CanvasPoint) {
  const degrees = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;

  return clamp(formatCoordinate(degrees), CONTROL_LIMITS.rotationDeg.min, CONTROL_LIMITS.rotationDeg.max);
}

export function skewFromCanvasPoint(pointer: CanvasPoint, startX: number, endX: number) {
  const width = Math.max(1, endX - startX);
  const amount = clamp((pointer.x - startX) / width, 0, 1);
  const nextValue =
    CONTROL_LIMITS.skewXDeg.min +
    amount * (CONTROL_LIMITS.skewXDeg.max - CONTROL_LIMITS.skewXDeg.min);

  return clamp(formatCoordinate(nextValue), CONTROL_LIMITS.skewXDeg.min, CONTROL_LIMITS.skewXDeg.max);
}

export function fitScaleFromCanvasPoint(
  pointer: CanvasPoint,
  center: CanvasPoint,
  startFitScale: number,
  startDistance: number,
) {
  const currentDistance = Math.hypot(pointer.x - center.x, pointer.y - center.y);

  if (startDistance <= 1) {
    return clamp(startFitScale, CONTROL_LIMITS.fitScale.min, CONTROL_LIMITS.fitScale.max);
  }

  return clamp(
    formatCoordinate(startFitScale * (currentDistance / startDistance)),
    CONTROL_LIMITS.fitScale.min,
    CONTROL_LIMITS.fitScale.max,
  );
}

export function trailOffsetFromCanvasPoint(
  pointer: CanvasPoint,
  centerScene: CanvasPoint,
  sceneBounds: Bounds,
  canvasBox: CanvasBox,
) {
  const nextPoint = canvasPointToScene(pointer, sceneBounds, canvasBox);

  return {
    trailOffsetX: clamp(
      formatCoordinate(nextPoint.x - centerScene.x),
      CONTROL_LIMITS.trailOffset.min,
      CONTROL_LIMITS.trailOffset.max,
    ),
    trailOffsetY: clamp(
      formatCoordinate(nextPoint.y - centerScene.y),
      CONTROL_LIMITS.trailOffset.min,
      CONTROL_LIMITS.trailOffset.max,
    ),
  };
}

export function getCanvasHandleGeometry(
  asset: NormalizedSvgAsset,
  controls: StudioControls,
  canvasBox: CanvasBox,
): CanvasHandleGeometry {
  const assetBounds = projectedAssetBounds(asset, controls);
  const sceneBounds = getPreviewSceneBounds(asset.viewBox, controls);
  const centerScene = {
    x: (assetBounds.minX + assetBounds.maxX) / 2,
    y: (assetBounds.minY + assetBounds.maxY) / 2,
  };
  const assetSpan = Math.max(boundsWidth(assetBounds), boundsHeight(assetBounds));
  const radiusScene = Math.max(assetSpan * 0.58, 18);
  const rotateHandleScene = pointOnCircle(centerScene, radiusScene, controls.rotationDeg - 90);
  const scaleHandleScene = pointOnCircle(centerScene, radiusScene * 1.12, 36);
  const skewGuideHalf = Math.max(boundsWidth(assetBounds) * 0.42, 24);
  const skewGuideY = assetBounds.minY - Math.max(boundsHeight(assetBounds) * 0.16, 14);
  const skewGuideStartScene = { x: centerScene.x - skewGuideHalf, y: skewGuideY };
  const skewGuideEndScene = { x: centerScene.x + skewGuideHalf, y: skewGuideY };
  const skewAmount =
    (controls.skewXDeg - CONTROL_LIMITS.skewXDeg.min) /
    (CONTROL_LIMITS.skewXDeg.max - CONTROL_LIMITS.skewXDeg.min);
  const skewHandleScene = {
    x: skewGuideStartScene.x + (skewGuideEndScene.x - skewGuideStartScene.x) * skewAmount,
    y: skewGuideY,
  };
  const trailHandleScene = {
    x: centerScene.x + controls.trailOffsetX,
    y: centerScene.y + controls.trailOffsetY,
  };

  return {
    sceneBounds,
    assetBounds,
    centerScene,
    center: scenePointToCanvas(centerScene, sceneBounds, canvasBox),
    rotateHandle: scenePointToCanvas(rotateHandleScene, sceneBounds, canvasBox),
    scaleHandle: scenePointToCanvas(scaleHandleScene, sceneBounds, canvasBox),
    skewGuideStart: scenePointToCanvas(skewGuideStartScene, sceneBounds, canvasBox),
    skewGuideEnd: scenePointToCanvas(skewGuideEndScene, sceneBounds, canvasBox),
    skewHandle: scenePointToCanvas(skewHandleScene, sceneBounds, canvasBox),
    trailHandle: scenePointToCanvas(trailHandleScene, sceneBounds, canvasBox),
  };
}
