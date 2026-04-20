import { expect, test } from "@playwright/test";

const SAMPLE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <rect x="10" y="8" width="28" height="32" rx="8" stroke="#d9e2ff" stroke-width="3" />
  </svg>
`;

test("landing, redirect, and theme persistence work across routes", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "A quieter workspace for building isometric SVG trails." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.goto("/about");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/studio");
  await expect(page.getByRole("complementary", { name: "Library drawer" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Controls drawer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide library" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hide controls" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More information" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(
    true,
  );
});

test("imports, edits, persists, and exports a draft", async ({ page }) => {
  await page.goto("/studio");

  await expect(page.getByRole("complementary", { name: "Library drawer" })).toBeVisible();

  await page.getByLabel("Import SVG file").setInputFiles({
    name: "card.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(SAMPLE_SVG),
  });

  await expect(page.getByText(/Loaded SVG with 1 detected source color/)).toBeVisible();
  await page.getByRole("spinbutton", { name: "Trail count" }).fill("4");
  await page.getByRole("spinbutton", { name: "Stroke weight" }).fill("1.2");
  await page.locator("#art-color").fill("#93b6ff");
  await page.locator("#preview-color").fill("#111827");
  await page.locator("#draft-name").fill("Orbit Card");
  await expect(page.getByText("viewBox 0 0 48 48")).toBeVisible();
  await expect(page.getByTestId("canvas-handle-rotate")).toBeVisible();
  await expect(page.getByTestId("canvas-handle-trail")).toBeVisible();
  await expect(page.getByRole("button", { name: "More information" })).toHaveCount(0);

  const rotationTooltipAnchor = page
    .locator(".studio-range-header .studio-tooltip-anchor")
    .filter({ hasText: "Rotation" })
    .first();
  await rotationTooltipAnchor.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toHaveCount(1);

  const tooltipBox = await page.getByRole("tooltip").boundingBox();
  const viewport = page.viewportSize();
  if (!tooltipBox || !viewport) {
    throw new Error("Tooltip did not render a measurable box.");
  }
  expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
  expect(tooltipBox.y).toBeGreaterThanOrEqual(0);
  expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(viewport.width);
  expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(viewport.height);

  await rotationTooltipAnchor.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();

  const rotationInput = page.getByRole("spinbutton", { name: "Rotation" });
  const initialRotation = await rotationInput.inputValue();
  const rotateHandle = await page.getByTestId("canvas-handle-rotate").boundingBox();
  if (!rotateHandle) {
    throw new Error("Rotate handle did not render.");
  }
  await page.mouse.move(rotateHandle.x + rotateHandle.width / 2, rotateHandle.y + rotateHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateHandle.x + rotateHandle.width / 2 + 48, rotateHandle.y + rotateHandle.height / 2 + 24, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(rotationInput).not.toHaveValue(initialRotation);

  await page.getByLabel("Use custom trail row").check();
  await page.getByRole("button", { name: "Advanced trail" }).click();
  await page.getByRole("button", { name: "4" }).click();
  await page.getByLabel("Active trail cell").check();
  await page.getByRole("spinbutton", { name: "Slot opacity" }).fill("0.44");
  await page.getByLabel("Dense / matte trail").check();

  const offsetXInput = page.getByRole("spinbutton", { name: "Offset X" });
  const initialOffsetX = await offsetXInput.inputValue();
  const trailHandle = await page.getByTestId("canvas-handle-trail").boundingBox();
  if (!trailHandle) {
    throw new Error("Trail handle did not render.");
  }
  await page.mouse.move(trailHandle.x + trailHandle.width / 2, trailHandle.y + trailHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(trailHandle.x + trailHandle.width / 2 + 28, trailHandle.y + trailHandle.height / 2 - 20, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(offsetXInput).not.toHaveValue(initialOffsetX);

  await page.getByLabel("Collapse library drawer").click();
  await expect(page.getByLabel("Expand library drawer")).toBeVisible();
  await page.getByLabel("Expand library drawer").click();
  await expect(page.getByLabel("Collapse library drawer")).toBeVisible();

  await page.getByRole("button", { name: "New project" }).click();
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
  await expect(page.locator(".studio-stage-chip-row .studio-status-chip").first()).toHaveText("SVG ready");
});
