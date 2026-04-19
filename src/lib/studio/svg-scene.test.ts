import { PLACEHOLDER_ASSET } from "@/lib/studio/constants";
import { buildExportMarkup } from "@/lib/studio/svg-scene";

describe("svg scene export", () => {
  it("keeps exports transparent and honors explicit measured bounds", () => {
    const markup = buildExportMarkup(
      PLACEHOLDER_ASSET,
      {
        rotationDeg: 0,
        skewXDeg: 0,
        scaleY: 1,
        fitScale: 1,
        strokeScale: 1.4,
        trailCount: 0,
        trailOffsetX: 0,
        trailOffsetY: 0,
        opacityStart: 0.2,
        opacityEnd: 0.8,
        reverseTrail: false,
        useCustomTrailPattern: false,
        trailPattern: [],
        artColor: "#88ccff",
        previewBgColor: "#ff00ff",
      },
      {
        minX: 10,
        minY: 12,
        maxX: 170,
        maxY: 210,
      },
    );

    expect(markup).toContain('viewBox="6 8 168 206"');
    expect(markup).toContain('color="#88ccff"');
    expect(markup).toContain("--studio-stroke-scale:1.4");
    expect(markup).not.toContain("#ff00ff");
  });
});
