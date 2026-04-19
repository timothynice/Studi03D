import type { Bounds, Matrix2D, StudioControls, TrailGhost, ViewBoxRect } from "@/lib/studio/types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function parseViewBox(viewBox: string): ViewBoxRect {
  const parts = viewBox
    .trim()
    .replaceAll(",", " ")
    .split(/\s+/)
    .map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    throw new Error("The SVG viewBox is invalid.");
  }

  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

export function boundsFromViewBox(viewBox: string): Bounds {
  const parsed = parseViewBox(viewBox);

  return {
    minX: parsed.x,
    minY: parsed.y,
    maxX: parsed.x + parsed.width,
    maxY: parsed.y + parsed.height,
  };
}

export function formatNumber(value: number) {
  return Number(value.toFixed(4)).toString();
}

function roundDecimal(value: number, precision = 4) {
  return Number(value.toFixed(precision));
}

export function formatViewBox(bounds: Bounds) {
  return [
    formatNumber(bounds.minX),
    formatNumber(bounds.minY),
    formatNumber(bounds.maxX - bounds.minX),
    formatNumber(bounds.maxY - bounds.minY),
  ].join(" ");
}

export function identityMatrix(): Matrix2D {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  };
}

export function translateMatrix(x: number, y: number): Matrix2D {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: x,
    f: y,
  };
}

export function scaleMatrix(x: number, y: number): Matrix2D {
  return {
    a: x,
    b: 0,
    c: 0,
    d: y,
    e: 0,
    f: 0,
  };
}

export function rotateMatrix(deg: number): Matrix2D {
  const radians = (deg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: 0,
    f: 0,
  };
}

export function skewXMatrix(deg: number): Matrix2D {
  const tangent = Math.tan((deg * Math.PI) / 180);

  return {
    a: 1,
    b: 0,
    c: tangent,
    d: 1,
    e: 0,
    f: 0,
  };
}

export function multiplyMatrices(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function applyMatrixToPoint(matrix: Matrix2D, x: number, y: number) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

export function matrixToSvgTransform(matrix: Matrix2D) {
  return `matrix(${formatNumber(matrix.a)} ${formatNumber(matrix.b)} ${formatNumber(matrix.c)} ${formatNumber(matrix.d)} ${formatNumber(matrix.e)} ${formatNumber(matrix.f)})`;
}

export function createProjectionMatrix(viewBox: ViewBoxRect, controls: StudioControls): Matrix2D {
  const centerX = viewBox.x + viewBox.width / 2;
  const centerY = viewBox.y + viewBox.height / 2;

  return [
    translateMatrix(centerX, centerY),
    scaleMatrix(controls.fitScale, controls.fitScale),
    scaleMatrix(1, controls.scaleY),
    skewXMatrix(controls.skewXDeg),
    rotateMatrix(controls.rotationDeg),
    translateMatrix(-centerX, -centerY),
  ].reduce((accumulator, matrix) => multiplyMatrices(accumulator, matrix), identityMatrix());
}

export function buildTrailGhosts(controls: StudioControls): TrailGhost[] {
  if (controls.trailCount <= 0) {
    return [];
  }

  return Array.from({ length: controls.trailCount }, (_, index) => {
    const step = controls.trailCount - index;
    const direction = controls.reverseTrail ? -1 : 1;
    const amount =
      controls.trailCount === 1 ? 0 : (controls.trailCount - step) / (controls.trailCount - 1);

    return {
      step,
      offsetX: controls.trailOffsetX * step * direction,
      offsetY: controls.trailOffsetY * step * direction,
      opacity: roundDecimal(clamp(lerp(controls.opacityStart, controls.opacityEnd, amount), 0, 1)),
    };
  });
}

function cornersForViewBox(viewBox: ViewBoxRect) {
  return [
    { x: viewBox.x, y: viewBox.y },
    { x: viewBox.x + viewBox.width, y: viewBox.y },
    { x: viewBox.x, y: viewBox.y + viewBox.height },
    { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
  ];
}

export function expandBounds(bounds: Bounds, x: number, y: number): Bounds {
  return {
    minX: Math.min(bounds.minX, x),
    minY: Math.min(bounds.minY, y),
    maxX: Math.max(bounds.maxX, x),
    maxY: Math.max(bounds.maxY, y),
  };
}

export function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}

export function calculateSceneBounds(viewBox: string, controls: StudioControls): Bounds {
  const parsedViewBox = parseViewBox(viewBox);
  const projection = createProjectionMatrix(parsedViewBox, controls);
  const corners = cornersForViewBox(parsedViewBox);
  const translatedMatrices = [
    projection,
    ...buildTrailGhosts(controls).map((ghost) =>
      multiplyMatrices(translateMatrix(ghost.offsetX, ghost.offsetY), projection),
    ),
  ];

  let bounds: Bounds | null = null;

  translatedMatrices.forEach((matrix) => {
    corners.forEach((corner) => {
      const point = applyMatrixToPoint(matrix, corner.x, corner.y);
      bounds = bounds
        ? expandBounds(bounds, point.x, point.y)
        : {
            minX: point.x,
            minY: point.y,
            maxX: point.x,
            maxY: point.y,
          };
    });
  });

  return bounds ?? boundsFromViewBox(viewBox);
}
