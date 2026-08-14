import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildHeroDefenseLocal } from "../../../scripts/build_hero_defense_local.mjs";

test("local distribution builds one self-contained HTML file", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "hero-defense-local-"));
  context.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputPath = path.join(outputDirectory, "HeroCoreDefense.html");
  const result = await buildHeroDefenseLocal({ outputPath });
  const files = await readdir(outputDirectory);
  const html = await readFile(outputPath, "utf8");

  assert.deepEqual(files, ["HeroCoreDefense.html"]);
  assert.ok(result.outputBytes > 100_000);
  assert.ok(html.split(/\r?\n/).length < 1_000, "generated HTML should stay compact");
  assert.match(html, /hero-defense-distribution" content="single-file-offline/);
  assert.match(html, /__HERO_DEFENSE_LOCAL_FILE__/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<script[^>]+type=["']module/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);
});
