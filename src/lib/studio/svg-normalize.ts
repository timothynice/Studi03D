import DOMPurify from "dompurify";

import type { NormalizedSvgAsset, WarningCode } from "@/lib/studio/types";

const GRAPHIC_ELEMENTS = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "textPath",
  "tspan",
  "use",
]);

const FILLABLE_ELEMENTS = new Set([
  "circle",
  "ellipse",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "textPath",
  "tspan",
  "use",
]);

const STROKABLE_ELEMENTS = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "textPath",
  "tspan",
  "use",
]);

interface PresentationState {
  fill: string;
  stroke: string;
  color: string;
}

const DEFAULT_PRESENTATION: PresentationState = {
  fill: "#000000",
  stroke: "none",
  color: "#000000",
};

function parseStyle(style: string | null) {
  return style
    ?.split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, declaration) => {
      const [property, ...valueParts] = declaration.split(":");

      if (!property || !valueParts.length) {
        return accumulator;
      }

      accumulator[property.trim().toLowerCase()] = valueParts.join(":").trim();
      return accumulator;
    }, {}) ?? {};
}

function serializeStyle(styleMap: Record<string, string>) {
  return Object.entries(styleMap)
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function parseDimension(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^-?\d*\.?\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeStrokeWidthValue(value: string | null | undefined) {
  if (!value) {
    return "1px";
  }

  const trimmed = value.trim();
  if (/^-?\d*\.?\d+$/.test(trimmed)) {
    return `${trimmed}px`;
  }

  return trimmed;
}

function normalizePaintValue(rawValue: string | null | undefined, inheritedValue: string) {
  if (rawValue == null || rawValue === "") {
    return inheritedValue;
  }

  return rawValue.trim();
}

function resolvePaintToken(value: string, color: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "currentcolor") {
    return color.trim().toLowerCase();
  }

  return normalizedValue;
}

function isUnsupportedPaint(value: string) {
  const normalizedValue = value.toLowerCase();
  return (
    normalizedValue.includes("url(") ||
    normalizedValue.includes("context-fill") ||
    normalizedValue.includes("context-stroke") ||
    normalizedValue.includes("var(")
  );
}

function stripPaintStyling(element: Element, styleMap: Record<string, string>) {
  element.removeAttribute("fill");
  element.removeAttribute("stroke");
  element.removeAttribute("color");

  delete styleMap.fill;
  delete styleMap.stroke;
  delete styleMap.color;
}

function normalizeSvgMarkup(rawSvg: string) {
  try {
    return String(
      DOMPurify.sanitize(rawSvg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ["foreignObject", "script", "style"],
      }),
    );
  } catch {
    throw new Error("The SVG markup could not be parsed.");
  }
}

function collectWarnings(warnings: Set<WarningCode>, colorTokens: Set<string>) {
  if (colorTokens.size > 1) {
    warnings.add("multi-color-flattened");
  }

  return Array.from(warnings);
}

function walkAndNormalize(
  element: Element,
  inheritedState: PresentationState,
  colorTokens: Set<string>,
  warnings: Set<WarningCode>,
  flags: { hasFill: boolean; hasStroke: boolean },
) {
  const styleMap = parseStyle(element.getAttribute("style"));
  const fill = normalizePaintValue(styleMap.fill ?? element.getAttribute("fill"), inheritedState.fill);
  const stroke = normalizePaintValue(
    styleMap.stroke ?? element.getAttribute("stroke"),
    inheritedState.stroke,
  );
  const strokeWidth = normalizeStrokeWidthValue(
    styleMap["stroke-width"] ?? element.getAttribute("stroke-width"),
  );
  const color = normalizePaintValue(styleMap.color ?? element.getAttribute("color"), inheritedState.color);
  const presentationState: PresentationState = {
    fill,
    stroke,
    color,
  };
  const tag = element.tagName.toLowerCase();

  if (isUnsupportedPaint(fill) || isUnsupportedPaint(stroke) || isUnsupportedPaint(color)) {
    warnings.add("unsupported-paint");
  }

  stripPaintStyling(element, styleMap);
  element.removeAttribute("stroke-width");

  if (GRAPHIC_ELEMENTS.has(tag)) {
    if (FILLABLE_ELEMENTS.has(tag)) {
      const effectiveFill = resolvePaintToken(fill, color);

      if (effectiveFill === "none") {
        element.setAttribute("fill", "none");
      } else {
        element.setAttribute("fill", "currentColor");
        flags.hasFill = true;
        colorTokens.add(effectiveFill);
      }
    }

    if (STROKABLE_ELEMENTS.has(tag)) {
      const effectiveStroke = resolvePaintToken(stroke, color);

      if (effectiveStroke !== "none") {
        element.setAttribute("stroke", "currentColor");
        styleMap["stroke-width"] = `calc(var(--studio-stroke-scale, 1) * ${strokeWidth})`;
        flags.hasStroke = true;
        colorTokens.add(effectiveStroke);
      }
    }
  }

  const nextStyle = serializeStyle(styleMap);

  if (nextStyle) {
    element.setAttribute("style", nextStyle);
  } else {
    element.removeAttribute("style");
  }

  Array.from(element.children).forEach((child) =>
    walkAndNormalize(child, presentationState, colorTokens, warnings, flags),
  );
}

function parseNormalizedSvg(rawSvg: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(rawSvg, "image/svg+xml");
  const parseError = document.querySelector("parsererror");

  if (parseError) {
    throw new Error("The SVG markup could not be parsed.");
  }

  const root = document.documentElement;

  if (root.tagName.toLowerCase() !== "svg") {
    throw new Error("Only SVG documents are supported.");
  }

  return root;
}

export function normalizeImportedSvg(rawSvg: string): NormalizedSvgAsset {
  if (!rawSvg.trim()) {
    throw new Error("Paste or import an SVG file first.");
  }

  try {
    const sanitizedMarkup = normalizeSvgMarkup(rawSvg);
    const root = parseNormalizedSvg(sanitizedMarkup);
    const warnings = new Set<WarningCode>();
    const colorTokens = new Set<string>();
    const flags = {
      hasFill: false,
      hasStroke: false,
    };

    walkAndNormalize(root, DEFAULT_PRESENTATION, colorTokens, warnings, flags);

    const widthFromAttr = parseDimension(root.getAttribute("width"));
    const heightFromAttr = parseDimension(root.getAttribute("height"));
    const rawViewBox = root.getAttribute("viewBox");
    let width = widthFromAttr ?? 0;
    let height = heightFromAttr ?? 0;
    let viewBox = rawViewBox;

    if (viewBox) {
      const parts = viewBox
        .replaceAll(",", " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => Number(part));

      if (parts.length === 4 && parts.every((part) => !Number.isNaN(part))) {
        width = width || Math.abs(parts[2]);
        height = height || Math.abs(parts[3]);
        viewBox = parts.join(" ");
      } else {
        viewBox = null;
      }
    }

    if (!viewBox) {
      if (!width || !height) {
        width = width || 256;
        height = height || 256;
      }

      warnings.add("missing-viewbox");
      viewBox = `0 0 ${width} ${height}`;
    }

    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    root.setAttribute("viewBox", viewBox);
    root.removeAttribute("width");
    root.removeAttribute("height");

    if (!flags.hasFill && !flags.hasStroke) {
      throw new Error("The SVG did not contain supported filled or stroked artwork.");
    }

    return {
      sourceSvg: rawSvg,
      sanitizedSvg: root.outerHTML,
      width: width || 256,
      height: height || 256,
      viewBox,
      hasStroke: flags.hasStroke,
      hasFill: flags.hasFill,
      detectedColorCount: Math.max(colorTokens.size, 1),
      warningCodes: collectWarnings(warnings, colorTokens),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "Paste or import an SVG file first.",
        "Only SVG documents are supported.",
        "The SVG markup could not be parsed.",
        "The SVG did not contain supported filled or stroked artwork.",
      ].includes(error.message)
    ) {
      throw error;
    }

    throw new Error("The SVG markup could not be parsed.");
  }
}
