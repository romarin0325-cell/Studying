const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, devices } = require("playwright");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const APP_ROOT = path.join(REPOSITORY_ROOT, "defense_hero_v2");
const BUNDLE_PATH = path.join(APP_ROOT, "dist-local", "HeroCoreDefenseV2.html");
const ASSET_MODULE_PATH = path.join(APP_ROOT, "js", "content", "assets.js");
const EXPECTED_RELEASE_ASSET_COUNT = 66;
const DEBUG_GLOBAL = "__heroDefenseV2Debug";

function attachDiagnostics(page, bundleUrl) {
  const failures = [];
  const unexpectedRequests = [];
  // Chromium과 Node의 file:// URL은 드라이브 문자 대소문자/percent-encoding이
  // 다를 수 있으므로 WHATWG URL + 드라이브 문자 소문자로 정규화해 비교한다.
  const normalizeUrl = (url) => {
    try {
      return new URL(url).href.replace(/^file:\/\/\/([a-zA-Z]):/, (match, drive) => `file:///${drive.toLowerCase()}:`);
    } catch { return url; }
  };
  const normalizedBundleUrl = normalizeUrl(bundleUrl);
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (normalizeUrl(url) === normalizedBundleUrl || url === "about:blank" || url.startsWith("data:") || url.startsWith("blob:")) return;
    unexpectedRequests.push(url);
  });
  return { failures, unexpectedRequests };
}

async function waitForApp(page) {
  await page.waitForFunction((debugGlobal) => {
    const debug = globalThis[debugGlobal];
    return Boolean(debug && typeof debug.getState === "function");
  }, DEBUG_GLOBAL);
  const app = page.locator("#app");
  await app.waitFor({ state: "visible" });
  assert.ok((await app.innerText()).trim().length > 0, "V2 app rendered no visible text");
}

async function verifyContext(browser, bundleUrl, options, label) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, bundleUrl);
  try {
    await page.goto(bundleUrl, { waitUntil: "load" });
    await waitForApp(page);
    assert.equal(await page.locator('script[type="module"]').count(), 0, `${label}: module script remains`);
    assert.equal(await page.locator("script[src]").count(), 0, `${label}: external script remains`);
    assert.equal(await page.locator('link[rel~="stylesheet"]').count(), 0, `${label}: external stylesheet remains`);

    const storageProbe = `offline-${label}`;
    await page.evaluate((value) => localStorage.setItem("heroDefenseV2OfflineProbe", value), storageProbe);
    await page.reload({ waitUntil: "load" });
    await waitForApp(page);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("heroDefenseV2OfflineProbe")),
      storageProbe,
      `${label}: file:// localStorage did not survive reload`,
    );

    const externalPerformanceEntries = await page.evaluate((currentBundle) => {
      const normalize = (url) => {
        try {
          return new URL(url).href.replace(/^file:\/\/\/([a-zA-Z]):/, (match, drive) => `file:///${drive.toLowerCase()}:`);
        } catch { return url; }
      };
      const normalizedBundle = normalize(currentBundle);
      return performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => normalize(url) !== normalizedBundle && !url.startsWith("data:") && !url.startsWith("blob:"));
    }, bundleUrl);
    assert.deepEqual(externalPerformanceEntries, [], `${label}: external resource entries remain`);
    assert.deepEqual(diagnostics.unexpectedRequests, [], `${label}: external requests\n${diagnostics.unexpectedRequests.join("\n")}`);
    assert.deepEqual(diagnostics.failures, [], `${label}: browser errors\n${diagnostics.failures.join("\n")}`);
  } finally {
    await context.close();
  }
}

async function verifyVolatileStorageWarning(browser, bundleUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, bundleUrl);
  try {
    await page.goto(bundleUrl, { waitUntil: "load" });
    await waitForApp(page);
    const warning = page.locator("[data-storage-warning], #storage-warning").first();
    await warning.waitFor({ state: "visible" });
    assert.ok((await warning.innerText()).trim().length > 0, "volatile storage warning is empty");

    const persistenceState = await page.evaluate((debugGlobal) => {
      const state = globalThis[debugGlobal].getState();
      return state?.storagePersistent
        ?? state?.persistence?.persistent
        ?? state?.storage?.persistent
        ?? null;
    }, DEBUG_GLOBAL);
    if (persistenceState !== null) assert.equal(persistenceState, false, "debug state reports persistent storage");
    assert.deepEqual(diagnostics.unexpectedRequests, [], "volatile-storage run made external requests");
    assert.deepEqual(diagnostics.failures, [], `volatile-storage browser errors\n${diagnostics.failures.join("\n")}`);
  } finally {
    await context.close();
  }
}

async function verifyEmbeddedAssets(html) {
  const assetModule = await import(pathToFileURL(ASSET_MODULE_PATH).href);
  const manifest = assetModule.ASSET_MANIFEST;
  assert.ok(Array.isArray(manifest), "ASSET_MANIFEST must be an array");
  const releaseEntries = manifest.filter((entry) => entry?.releaseRequired !== false);
  assert.equal(
    releaseEntries.length,
    EXPECTED_RELEASE_ASSET_COUNT,
    `release manifest must contain ${EXPECTED_RELEASE_ASSET_COUNT} entries`,
  );
  for (const entry of releaseEntries) {
    const embeddedPrefix = `${JSON.stringify(entry.path)}:\"data:`;
    assert.ok(html.includes(embeddedPrefix), `release asset is not embedded: ${entry.path}`);
  }
}

async function main() {
  assert.ok(fs.existsSync(BUNDLE_PATH), "V2 single HTML is missing; run npm run build:defense-hero-v2-local first.");
  const outputEntries = fs.readdirSync(path.dirname(BUNDLE_PATH), { withFileTypes: true });
  assert.deepEqual(outputEntries.map((entry) => entry.name), ["HeroCoreDefenseV2.html"]);
  assert.equal(outputEntries[0].isFile(), true, "V2 local distribution entry must be a file");

  const html = fs.readFileSync(BUNDLE_PATH, "utf8");
  assert.match(html, /hero-defense-v2-distribution" content="single-file-offline/);
  assert.match(html, /__HERO_DEFENSE_V2_LOCAL_FILE__/);
  assert.match(html, /__HERO_DEFENSE_V2_EMBEDDED_ASSETS__/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<script[^>]+type=["']module/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);
  await verifyEmbeddedAssets(html);

  const bundleUrl = pathToFileURL(BUNDLE_PATH).href;
  const browser = await chromium.launch({ headless: true });
  try {
    await verifyContext(browser, bundleUrl, { viewport: { width: 1366, height: 768 } }, "desktop");
    await verifyContext(browser, bundleUrl, {
      ...devices["Pixel 7"],
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }, "mobile-portrait");
    await verifyContext(browser, bundleUrl, {
      ...devices["Pixel 7"],
      viewport: { width: 844, height: 390 },
      screen: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    }, "mobile-landscape");
    await verifyVolatileStorageWarning(browser, bundleUrl);
  } finally {
    await browser.close();
  }
  console.log("Hero Core Defense V2 single-file offline smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
