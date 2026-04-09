import fs from "node:fs/promises";
import path from "node:path";

const playwrightModulePath = "file:///home/rorandri/Music/mety1/ft_transcendence/frontend/node_modules/playwright/index.mjs";
const { chromium } = await import(playwrightModulePath);

const outDir = "/home/rorandri/Music/mety1/ft_transcendence/frontend/visual-compare-intro";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const currentPage = await context.newPage();
const referencePage = await context.newPage();

await Promise.all([
  currentPage.goto("http://127.0.0.1:4175/", { waitUntil: "networkidle" }),
  referencePage.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" })
]);

const checkpoints = [1200, 3000, 5200, 7600];
const selectors = [
  "#title",
  "#subtitle",
  "#line",
  "#question",
  "#enter-btn",
  ".intro",
  ".event-horizon",
  ".singularity"
];

const startMs = Date.now();
const results = [];

for (const checkpointMs of checkpoints) {
  const elapsed = Date.now() - startMs;
  const toWait = Math.max(0, checkpointMs - elapsed);
  if (toWait > 0) {
    await new Promise((resolve) => setTimeout(resolve, toWait));
  }

  const currentShotPath = path.join(outDir, "current-" + checkpointMs + ".png");
  const referenceShotPath = path.join(outDir, "reference-" + checkpointMs + ".png");

  await Promise.all([
    currentPage.screenshot({ path: currentShotPath, fullPage: true }),
    referencePage.screenshot({ path: referenceShotPath, fullPage: true })
  ]);

  const collectState = async (page) =>
    page.evaluate((selectorsArg) => {
      const data = {};
      for (const selector of selectorsArg) {
        const element = document.querySelector(selector);
        if (!element) {
          data[selector] = { missing: true };
          continue;
        }

        const css = getComputedStyle(element);
        data[selector] = {
          missing: false,
          text: (element.textContent || "").trim(),
          className: element.className,
          opacity: css.opacity,
          transform: css.transform,
          filter: css.filter,
          display: css.display,
          visibility: css.visibility,
          animationName: css.animationName,
          animationDuration: css.animationDuration,
          color: css.color,
          fontSize: css.fontSize
        };
      }

      return {
        title: document.title,
        url: location.href,
        data
      };
    }, selectors);

  const [currentState, referenceState] = await Promise.all([
    collectState(currentPage),
    collectState(referencePage)
  ]);

  results.push({
    checkpointMs,
    current: currentState,
    reference: referenceState
  });
}

await fs.writeFile(path.join(outDir, "comparison.json"), JSON.stringify(results, null, 2));
await browser.close();

console.log("comparison generated at", outDir);
