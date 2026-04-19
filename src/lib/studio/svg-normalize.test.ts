import { normalizeImportedSvg } from "@/lib/studio/svg-normalize";

describe("normalizeImportedSvg", () => {
  it("normalizes stroked icons and preserves fill none", () => {
    const asset = normalizeImportedSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
        <path d="M4 4H20V20H4Z" stroke="#223344" stroke-width="2" />
      </svg>
    `);

    expect(asset.hasStroke).toBe(true);
    expect(asset.hasFill).toBe(false);
    expect(asset.sanitizedSvg).toContain('stroke="currentColor"');
    expect(asset.sanitizedSvg).toContain("--studio-stroke-scale");
    expect(asset.sanitizedSvg).toContain('fill="none"');
  });

  it("normalizes flat filled icons to currentColor", () => {
    const asset = normalizeImportedSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M4 4H20V20H4Z" />
      </svg>
    `);

    expect(asset.hasFill).toBe(true);
    expect(asset.sanitizedSvg).toContain('fill="currentColor"');
    expect(asset.detectedColorCount).toBe(1);
  });

  it("detects multicolor input and emits a warning", () => {
    const asset = normalizeImportedSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <rect x="1" y="1" width="8" height="8" fill="#ff0000" />
        <rect x="15" y="15" width="8" height="8" fill="#0000ff" />
      </svg>
    `);

    expect(asset.detectedColorCount).toBe(2);
    expect(asset.warningCodes).toContain("multi-color-flattened");
  });

  it("creates a viewBox from width and height when missing", () => {
    const asset = normalizeImportedSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">
        <rect x="0" y="0" width="160" height="90" fill="#111111" />
      </svg>
    `);

    expect(asset.viewBox).toBe("0 0 160 90");
    expect(asset.warningCodes).toContain("missing-viewbox");
  });

  it("rejects invalid markup", () => {
    expect(() => normalizeImportedSvg("<svg><path></svg")).toThrow("The SVG markup could not be parsed.");
  });
});
