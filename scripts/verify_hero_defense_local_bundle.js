const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, devices } = require("playwright");

const repositoryRoot = path.resolve(__dirname, "..");
const bundlePath = path.join(repositoryRoot, "defense_hero", "dist-local", "HeroCoreDefense.html");

async function verifyContext(browser, options, label) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });

  await page.goto(pathToFileURL(bundlePath).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__heroDefenseDebug?.getState));
  await page.getByRole("heading", { name: /영웅의 빛으로/ }).waitFor();
  assert.equal(await page.locator('script[type="module"]').count(), 0, `${label}: module script remains`);
  assert.equal(await page.locator('link[rel="stylesheet"]').count(), 0, `${label}: external stylesheet remains`);

  const storageProbe = `offline-${label}`;
  await page.evaluate((value) => localStorage.setItem("heroDefenseOfflineProbe", value), storageProbe);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__heroDefenseDebug?.getState));
  assert.equal(
    await page.evaluate(() => localStorage.getItem("heroDefenseOfflineProbe")),
    storageProbe,
    `${label}: file storage did not survive reload`,
  );
  await page.getByRole("button", { name: "새 게임" }).click();
  await page.getByRole("heading", { name: "다음 작전을 선택하세요" }).waitFor();
  assert.equal((await page.evaluate(() => window.__heroDefenseDebug.getState().route.name)), "hub");
  await page.locator('[data-hub="expedition"]').click();
  await page.locator('[data-action="deck-next"]').click();
  await page.locator('[data-action="start-run"]').click();
  assert.ok(await page.evaluate(() => localStorage.getItem("heroDefenseRun")), `${label}: run was not saved`);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__heroDefenseDebug?.getState));
  await page.getByRole("button", { name: "계속하기" }).waitFor();

  assert.deepEqual(failures, [], `${label}: browser errors\n${failures.join("\n")}`);
  await context.close();
}

async function verifyVolatileStorageWarning(browser) {
  const context = await browser.newContext({ viewport: { width: 915, height: 412 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(bundlePath).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.__heroDefenseDebug?.getState));
  const warning = page.locator("#storage-warning");
  await warning.waitFor({ state: "visible" });
  assert.match(await warning.innerText(), /저장이 유지되지 않는 임시 실행/);
  assert.equal(await page.evaluate(() => window.__heroDefenseDebug.getState().storagePersistent), false);
  await context.close();
}

async function main() {
  assert.ok(fs.existsSync(bundlePath), "단일 HTML이 없습니다. 먼저 npm run build:defense-hero-local을 실행하세요.");
  const outputFiles = fs.readdirSync(path.dirname(bundlePath), { withFileTypes: true }).filter((entry) => entry.isFile());
  assert.deepEqual(outputFiles.map((entry) => entry.name), ["HeroCoreDefense.html"]);

  const html = fs.readFileSync(bundlePath, "utf8");
  assert.match(html, /hero-defense-distribution" content="single-file-offline/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);

  const browser = await chromium.launch({ headless: true });
  try {
    await verifyContext(browser, { viewport: { width: 1440, height: 900 } }, "desktop");
    await verifyContext(browser, {
      ...devices["Pixel 7"],
      viewport: { width: 915, height: 412 },
      screen: { width: 915, height: 412 },
      isMobile: true,
      hasTouch: true,
    }, "android-landscape");
    await verifyVolatileStorageWarning(browser);
  } finally {
    await browser.close();
  }
  console.log("Hero Defense single-file offline smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
