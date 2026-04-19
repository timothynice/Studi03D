import type { Bounds, NormalizedSvgAsset, StudioControls } from "@/lib/studio/types";
import {
  buildTrailGhosts,
  calculateSceneBounds,
  createProjectionMatrix,
  formatViewBox,
  matrixToSvgTransform,
  padBounds,
  parseViewBox,
  translateMatrix,
  multiplyMatrices,
} from "@/lib/studio/transform";

interface SceneParts {
  defsMarkup: string;
  bodyMarkup: string;
}

function extractSceneParts(asset: NormalizedSvgAsset): SceneParts {
  const innerMarkup =
    asset.sanitizedSvg.match(/^<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/i)?.[1] ?? asset.sanitizedSvg;
  let defsMarkup = "";
  const bodyMarkup = innerMarkup.replace(/<defs\b[^>]*>([\s\S]*?)<\/defs>/gi, (_, defsContent: string) => {
    defsMarkup += defsContent;
    return "";
  });

  return {
    defsMarkup,
    bodyMarkup,
  };
}

function buildSceneUses(asset: NormalizedSvgAsset, controls: StudioControls) {
  const viewBox = parseViewBox(asset.viewBox);
  const projectionMatrix = createProjectionMatrix(viewBox, controls);
  const ghostMarkup = buildTrailGhosts(controls)
    .map((ghost) => {
      const matrix = multiplyMatrices(translateMatrix(ghost.offsetX, ghost.offsetY), projectionMatrix);

      return `<use href="#asset-body" opacity="${ghost.opacity.toFixed(4)}" transform="${matrixToSvgTransform(matrix)}" />`;
    })
    .join("");
  const baseMarkup = `<use href="#asset-body" transform="${matrixToSvgTransform(projectionMatrix)}" />`;

  return `${ghostMarkup}${baseMarkup}`;
}

function buildRootMarkup(
  asset: NormalizedSvgAsset,
  controls: StudioControls,
  viewBox: string,
  layerMarkup: string,
) {
  const { defsMarkup, bodyMarkup } = extractSceneParts(asset);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" color="${controls.artColor}"><defs>${defsMarkup}<g id="asset-body">${bodyMarkup}</g></defs><g data-export-layer="true">${layerMarkup}</g></svg>`;
}

export function buildPreviewMarkup(asset: NormalizedSvgAsset, controls: StudioControls) {
  const paddedBounds = padBounds(calculateSceneBounds(asset.viewBox, controls), 34);
  const sceneMarkup = buildSceneUses(asset, controls);

  return buildRootMarkup(asset, controls, formatViewBox(paddedBounds), sceneMarkup);
}

export function buildExportMarkup(
  asset: NormalizedSvgAsset,
  controls: StudioControls,
  measuredBounds?: Bounds,
) {
  const fallbackBounds = padBounds(calculateSceneBounds(asset.viewBox, controls), asset.hasStroke ? 4 : 1.5);
  const exportBounds = measuredBounds ? padBounds(measuredBounds, asset.hasStroke ? 4 : 1.5) : fallbackBounds;
  const sceneMarkup = buildSceneUses(asset, controls);

  return buildRootMarkup(asset, controls, formatViewBox(exportBounds), sceneMarkup);
}
