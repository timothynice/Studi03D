"use client";

import { optimize } from "svgo/browser";

import type { Bounds, NormalizedSvgAsset, StudioControls } from "@/lib/studio/types";
import { buildExportMarkup } from "@/lib/studio/svg-scene";
import { calculateSceneBounds } from "@/lib/studio/transform";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugifyFilename(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "studio-export"
  );
}

function renderToHiddenDom(markup: string) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "-10000px";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.innerHTML = markup;
  document.body.appendChild(wrapper);

  return wrapper;
}

export function measureExportBounds(asset: NormalizedSvgAsset, controls: StudioControls): Bounds | undefined {
  const fallback = calculateSceneBounds(asset.viewBox, controls);
  const wrapper = renderToHiddenDom(buildExportMarkup(asset, controls, fallback));

  try {
    const layer = wrapper.querySelector("[data-export-layer='true']") as SVGGraphicsElement | null;

    if (!layer || typeof layer.getBBox !== "function") {
      return fallback;
    }

    const bbox = layer.getBBox();

    if (!Number.isFinite(bbox.x) || !Number.isFinite(bbox.width) || bbox.width <= 0 || bbox.height <= 0) {
      return fallback;
    }

    return {
      minX: bbox.x,
      minY: bbox.y,
      maxX: bbox.x + bbox.width,
      maxY: bbox.y + bbox.height,
    };
  } finally {
    wrapper.remove();
  }
}

export function buildOptimizedExportSvg(
  asset: NormalizedSvgAsset,
  controls: StudioControls,
  measuredBounds?: Bounds,
) {
  const markup = buildExportMarkup(asset, controls, measuredBounds);

  return optimize(markup, {
    multipass: true,
  }).data;
}

export function exportTransparentSvg(
  documentName: string,
  asset: NormalizedSvgAsset,
  controls: StudioControls,
) {
  const bounds = measureExportBounds(asset, controls);
  const optimizedMarkup = buildOptimizedExportSvg(asset, controls, bounds);

  downloadBlob(
    new Blob([optimizedMarkup], { type: "image/svg+xml;charset=utf-8" }),
    `${slugifyFilename(documentName)}.svg`,
  );
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The PNG export image could not be rendered."));
    image.src = url;
  });
}

export async function exportTransparentPng(
  documentName: string,
  asset: NormalizedSvgAsset,
  controls: StudioControls,
) {
  const bounds = measureExportBounds(asset, controls);
  const optimizedMarkup = buildOptimizedExportSvg(asset, controls, bounds);
  const blob = new Blob([optimizedMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(svgUrl);
    const viewBox = bounds ?? calculateSceneBounds(asset.viewBox, controls);
    const width = Math.max(1, Math.ceil((viewBox.maxX - viewBox.minX) * 4));
    const height = Math.max(1, Math.ceil((viewBox.maxY - viewBox.minY) * 4));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("PNG export is unavailable in this browser.");
    }

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("PNG export failed."));
          return;
        }

        resolve(result);
      }, "image/png");
    });

    downloadBlob(pngBlob, `${slugifyFilename(documentName)}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
