import { PLACEHOLDER_ASSET, createDefaultControls } from "@/lib/studio/constants";
import {
  CONTROL_LIMITS,
  fitScaleFromCanvasPoint,
  getCanvasHandleGeometry,
  rotationFromCanvasPoint,
  skewFromCanvasPoint,
  trailOffsetFromCanvasPoint,
} from "@/lib/studio/canvas-handles";

describe("canvas handle helpers", () => {
  it("maps a top-of-ring pointer to neutral rotation", () => {
    expect(rotationFromCanvasPoint({ x: 100, y: 40 }, { x: 100, y: 100 })).toBe(0);
  });

  it("maps skew guide positions to the supported range", () => {
    expect(skewFromCanvasPoint({ x: 0, y: 0 }, 0, 100)).toBe(CONTROL_LIMITS.skewXDeg.min);
    expect(skewFromCanvasPoint({ x: 100, y: 0 }, 0, 100)).toBe(CONTROL_LIMITS.skewXDeg.max);
  });

  it("scales fit proportionally and clamps it", () => {
    expect(fitScaleFromCanvasPoint({ x: 120, y: 100 }, { x: 100, y: 100 }, 1.5, 10)).toBe(2.3);
    expect(fitScaleFromCanvasPoint({ x: 103, y: 100 }, { x: 100, y: 100 }, 1.5, 10)).toBe(0.5);
  });

  it("converts a dragged trail handle back into scene offsets", () => {
    const result = trailOffsetFromCanvasPoint(
      { x: 260, y: 80 },
      { x: 50, y: 30 },
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      { x: 0, y: 0, width: 200, height: 200 },
    );

    expect(result).toEqual({
      trailOffsetX: 80,
      trailOffsetY: 10,
    });
  });

  it("builds pose and trail handle geometry inside the rendered canvas box", () => {
    const controls = createDefaultControls();
    const geometry = getCanvasHandleGeometry(PLACEHOLDER_ASSET, controls, {
      x: 10,
      y: 12,
      width: 520,
      height: 440,
    });

    expect(geometry.center.x).toBeGreaterThan(10);
    expect(geometry.center.x).toBeLessThan(530);
    expect(geometry.rotateHandle.y).toBeLessThan(geometry.center.y);
    expect(geometry.trailHandle.x).toBeGreaterThan(geometry.center.x);
  });
});
