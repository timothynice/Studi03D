import { DEFAULT_CONTROLS, createDefaultControls } from "@/lib/studio/constants";
import {
  applyMatrixToPoint,
  buildTrailGhosts,
  calculateSceneBounds,
  createProjectionMatrix,
  parseViewBox,
} from "@/lib/studio/transform";

describe("transform helpers", () => {
  it("keeps geometry unchanged when projection controls are neutral", () => {
    const viewBox = parseViewBox("0 0 100 100");
    const matrix = createProjectionMatrix(viewBox, {
      ...DEFAULT_CONTROLS,
      rotationDeg: 0,
      skewXDeg: 0,
      scaleY: 1,
      fitScale: 1,
      trailCount: 0,
    });

    const point = applyMatrixToPoint(matrix, 20, 40);
    expect(point.x).toBeCloseTo(20);
    expect(point.y).toBeCloseTo(40);
  });

  it("builds trail ghosts in farthest-first render order", () => {
    const ghosts = buildTrailGhosts({
      ...DEFAULT_CONTROLS,
      trailCount: 3,
      trailOffsetX: 10,
      trailOffsetY: -5,
      opacityStart: 0.1,
      opacityEnd: 0.5,
    });

    expect(ghosts).toEqual([
      { step: 3, offsetX: 30, offsetY: -15, opacity: 0.1, matte: false },
      { step: 2, offsetX: 20, offsetY: -10, opacity: 0.3, matte: false },
      { step: 1, offsetX: 10, offsetY: -5, opacity: 0.5, matte: false },
    ]);
  });

  it("reverses the trail direction", () => {
    const ghosts = buildTrailGhosts({
      ...DEFAULT_CONTROLS,
      trailCount: 2,
      trailOffsetX: 12,
      trailOffsetY: 6,
      reverseTrail: true,
    });

    expect(ghosts[0]?.offsetX).toBe(-24);
    expect(ghosts[1]?.offsetY).toBe(-6);
  });

  it("builds custom trail rows with gaps and matte slots", () => {
    const controls = createDefaultControls();
    controls.useCustomTrailPattern = true;
    controls.trailPattern = controls.trailPattern.map((cell, index) => ({
      enabled: index === 0 || index === 3,
      opacity: index === 0 ? 0.22 : 0.48,
      matte: index === 3,
    }));
    controls.trailOffsetX = 8;
    controls.trailOffsetY = -4;

    expect(buildTrailGhosts(controls)).toEqual([
      { step: 4, offsetX: 32, offsetY: -16, opacity: 0.48, matte: true },
      { step: 1, offsetX: 8, offsetY: -4, opacity: 0.22, matte: false },
    ]);
  });

  it("expands scene bounds when trail offsets are applied", () => {
    const baseBounds = calculateSceneBounds("0 0 24 24", {
      ...DEFAULT_CONTROLS,
      rotationDeg: 0,
      skewXDeg: 0,
      scaleY: 1,
      fitScale: 1,
      trailCount: 0,
    });
    const trailedBounds = calculateSceneBounds("0 0 24 24", {
      ...DEFAULT_CONTROLS,
      rotationDeg: 0,
      skewXDeg: 0,
      scaleY: 1,
      fitScale: 1,
      trailCount: 4,
      trailOffsetX: 18,
      trailOffsetY: -6,
    });

    expect(trailedBounds.maxX).toBeGreaterThan(baseBounds.maxX);
    expect(trailedBounds.minY).toBeLessThan(baseBounds.minY);
  });
});
