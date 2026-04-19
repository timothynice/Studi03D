import { expect, test } from "@playwright/test";

const SAMPLE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="10" y="8" width="28" height="32" rx="8" stroke="#d9e2ff" stroke-width="3" />
  </svg>
`;

test("imports, edits, persists, and exports a draft", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SVG Isometric Trail Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide left rail" })).toBeVisible();

  await page.getByLabel("Import SVG file").setInputFiles({
    name: "card.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(SAMPLE_SVG),
  });

  await expect(page.getByText(/Loaded SVG with 1 detected source color/)).toBeVisible();
  await page.getByRole("spinbutton", { name: "Rotation" }).fill("-18");
  await page.getByRole("spinbutton", { name: "Stroke weight" }).fill("1.2");
  await page.getByRole("spinbutton", { name: "Trail count" }).fill("4");
  await page.locator("#art-color").fill("#93b6ff");
  await page.locator("#preview-color").fill("#111827");
  await page.getByLabel("Draft name").fill("Orbit Card");
  await expect(page.getByText("viewBox 0 0 48 48")).toBeVisible();

  await page.getByLabel("Use custom trail row").check();
  await page.getByRole("button", { name: "4" }).click();
  await page.getByLabel("Active gap cell").check();
  await page.getByRole("spinbutton", { name: "Slot opacity" }).fill("0.44");
  await page.getByLabel("Dense / matte trail").check();

  await page.getByRole("button", { name: "New draft" }).click();
  await page.getByRole("button", { name: /Orbit Card/i }).click();

  const [svgDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export SVG" }).click(),
  ]);
  expect(svgDownload.suggestedFilename()).toContain("orbit-card");

  const [pngDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PNG" }).click(),
  ]);
  expect(pngDownload.suggestedFilename()).toContain("orbit-card");

  await page.reload();
  await expect(page.locator("#draft-name")).toHaveValue("Orbit Card");
  await expect(page.getByText("SVG ready")).toBeVisible();
});
