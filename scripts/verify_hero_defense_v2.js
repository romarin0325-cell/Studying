const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const APP_ROOT = path.resolve(__dirname, "..", "defense_hero_v2");
const JS_ROOT = path.join(APP_ROOT, "js");
const SYSTEM_ROOT = path.join(JS_ROOT, "battle", "systems");
const EXPECTED_RELEASE_ASSET_COUNT = 66;
const DIRECTIONS = Object.freeze(["front", "back", "left", "right"]);

const REQUIRED_FILES = Object.freeze([
  "index.html",
  "package.json",
  "README.md",
  "docs/README.md",
  "docs/ARCHITECTURE.md",
  "docs/RUNTIME_API.md",
  "docs/CONTENT_AUTHORING.md",
  "docs/UI_RENDERING_AND_RELEASE.md",
  "css/tokens.css",
  "css/app.css",
  "css/battle.css",
  "js/main.js",
  "js/app/GameApp.js",
  "js/app/SceneController.js",
  "js/app/screens/StageSelectScreen.js",
  "js/app/screens/FormationScreen.js",
  "js/app/screens/BattleScreen.js",
  "js/app/screens/ResultScreen.js",
  "js/core/GameLoop.js",
  "js/core/EventBus.js",
  "js/core/SeededRng.js",
  "js/core/CommandQueue.js",
  "js/core/enums.js",
  "js/content/combat.js",
  "js/content/heroes.js",
  "js/content/enemies.js",
  "js/content/stages.js",
  "js/content/buffs.js",
  "js/content/statuses.js",
  "js/content/effects.js",
  "js/content/assets.js",
  "js/content/validateContent.js",
  "js/battle/BattleSession.js",
  "js/battle/BattleState.js",
  "js/battle/systems/CommandSystem.js",
  "js/battle/systems/PlacementSystem.js",
  "js/battle/systems/WaveSystem.js",
  "js/battle/systems/MovementSystem.js",
  "js/battle/systems/DirectionSystem.js",
  "js/battle/systems/AuraSystem.js",
  "js/battle/systems/StatusSystem.js",
  "js/battle/systems/TargetingSystem.js",
  "js/battle/systems/SkillSystem.js",
  "js/battle/systems/BasicAttackSystem.js",
  "js/battle/systems/DamageSystem.js",
  "js/battle/systems/TraitSystem.js",
  "js/battle/systems/CleanupSystem.js",
  "js/battle/effects/ConditionRegistry.js",
  "js/battle/effects/OperationRegistry.js",
  "js/battle/effects/TraitCompiler.js",
  "js/render/AssetManager.js",
  "js/render/SpriteResolver.js",
  "js/render/ViewportLayout.js",
  "js/render/BattleRenderer.js",
  "js/render/EffectRenderer.js",
  "js/persistence/SaveRepositoryV2.js",
  "js/persistence/schemas.js",
]);

const FORBIDDEN_SYSTEM_PATTERNS = Object.freeze([
  { label: "characterId ===", pattern: /\bcharacterId\s*===/ },
  { label: "=== characterId", pattern: /===\s*characterId\b/ },
  { label: "hero.id ===", pattern: /\bhero\s*\.\s*id\s*===/ },
  { label: "=== hero.id", pattern: /===\s*hero\s*\.\s*id\b/ },
  { label: "switch(characterId)", pattern: /\bswitch\s*\(\s*characterId\s*\)/ },
]);

function collectFiles(directory, extension, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(absolute, extension, result);
    else if (entry.name.endsWith(extension)) result.push(absolute);
  }
  return result;
}

function relativeToApp(filePath) {
  return path.relative(APP_ROOT, filePath).replace(/\\/g, "/");
}

function verifyRequiredFiles() {
  const missing = REQUIRED_FILES.filter((relative) => !fs.existsSync(path.join(APP_ROOT, relative)));
  if (missing.length) throw new Error(`Missing required V2 files:\n- ${missing.join("\n- ")}`);
}

function verifyRuntimeJavaScript() {
  const scripts = collectFiles(JS_ROOT, ".js").sort();
  if (!scripts.length) throw new Error("No Hero Core Defense V2 runtime JavaScript files were found.");

  for (const file of scripts) {
    const source = fs.readFileSync(file, "utf8");
    if (/\bMath\.random\s*\(/.test(source)) {
      throw new Error(`Direct Math.random call is forbidden: ${relativeToApp(file)}`);
    }
    const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (checked.status !== 0) {
      process.stderr.write(checked.stderr || checked.stdout);
      throw new Error(`JavaScript syntax check failed: ${relativeToApp(file)}`);
    }
  }
  return scripts.length;
}

function verifyNoCharacterDispatch() {
  const systems = collectFiles(SYSTEM_ROOT, ".js").sort();
  if (!systems.length) throw new Error("No V2 battle system modules were found.");
  for (const file of systems) {
    const source = fs.readFileSync(file, "utf8");
    for (const { label, pattern } of FORBIDDEN_SYSTEM_PATTERNS) {
      if (pattern.test(source)) {
        throw new Error(`Character-specific dispatch (${label}) is forbidden in ${relativeToApp(file)}.`);
      }
    }
  }
}

function assertSetEqual(actual, expected, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const unexpected = [...actual].filter((value) => !expected.has(value));
  if (missing.length || unexpected.length) {
    throw new Error(`${label} mismatch; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`);
  }
}

function addDirection(target, id, direction) {
  if (!target.has(id)) target.set(id, new Set());
  target.get(id).add(direction);
}

function verifyReleaseAssets(manifest) {
  if (!Array.isArray(manifest)) throw new TypeError("ASSET_MANIFEST must be an array.");
  const releaseEntries = manifest.filter((entry) => entry?.releaseRequired !== false);
  if (releaseEntries.length !== EXPECTED_RELEASE_ASSET_COUNT) {
    throw new Error(
      `V2 must declare ${EXPECTED_RELEASE_ASSET_COUNT} required release assets; found ${releaseEntries.length}.`,
    );
  }

  const ids = new Set();
  const paths = new Set();
  const portraits = new Set();
  const heroDirections = new Map();
  const bossDirections = new Map();

  for (const entry of releaseEntries) {
    const id = String(entry?.id ?? "").trim();
    const entryPath = String(entry?.path ?? "").trim().replace(/\\/g, "/");
    if (!id || !entryPath) throw new TypeError("Every required release asset needs a non-empty id and path.");
    if (entry.type !== "image") throw new Error(`Required release asset must be an image: ${id}`);
    if (ids.has(id)) throw new Error(`Duplicate required release asset id: ${id}`);
    if (paths.has(entryPath)) throw new Error(`Duplicate required release asset path: ${entryPath}`);
    ids.add(id);
    paths.add(entryPath);

    let match = entryPath.match(/^\.\/assets\/characters\/portraits\/([^/]+)\.webp$/);
    if (match) {
      portraits.add(match[1]);
    } else {
      match = entryPath.match(/^\.\/assets\/characters\/battle\/([^/]+)\/(front|back|left|right)\.webp$/);
      if (match) addDirection(heroDirections, match[1], match[2]);
      else {
        match = entryPath.match(/^\.\/assets\/bosses\/([^/]+)\/(front|back|left|right)\.webp$/);
        if (match) addDirection(bossDirections, match[1], match[2]);
        else throw new Error(`Required release asset does not follow the V2 file contract: ${entryPath}`);
      }
    }

    const absolute = path.resolve(APP_ROOT, entryPath);
    if (absolute !== APP_ROOT && !absolute.startsWith(`${APP_ROOT}${path.sep}`)) {
      throw new Error(`Required release asset escapes defense_hero_v2: ${entryPath}`);
    }
    if (!fs.existsSync(absolute)) throw new Error(`Required V2 release asset file is missing: ${entryPath}`);
  }

  if (portraits.size !== 10) throw new Error(`V2 requires 10 hero portraits; found ${portraits.size}.`);
  if (heroDirections.size !== 10) throw new Error(`V2 requires directional art for 10 heroes; found ${heroDirections.size}.`);
  if (bossDirections.size !== 4) throw new Error(`V2 requires directional art for 4 bosses; found ${bossDirections.size}.`);
  assertSetEqual(new Set(heroDirections.keys()), portraits, "Hero portrait and battle-art roster");
  const expectedDirections = new Set(DIRECTIONS);
  for (const [heroId, directions] of heroDirections) assertSetEqual(directions, expectedDirections, `Hero ${heroId} directions`);
  for (const [bossId, directions] of bossDirections) assertSetEqual(directions, expectedDirections, `Boss ${bossId} directions`);
}

async function verifyContent() {
  const validationModule = await import(pathToFileURL(path.join(JS_ROOT, "content", "validateContent.js")).href);
  if (typeof validationModule.validateContent !== "function") {
    throw new TypeError("validateContent.js must export validateContent().");
  }
  const validation = await validationModule.validateContent({ throwOnError: true });
  if (validation?.valid === false) {
    throw new Error(`V2 content validation failed:\n${(validation.errors ?? []).join("\n")}`);
  }

  const assetModule = await import(pathToFileURL(path.join(JS_ROOT, "content", "assets.js")).href);
  verifyReleaseAssets(assetModule.ASSET_MANIFEST);
}

async function main() {
  verifyRequiredFiles();
  const scriptCount = verifyRuntimeJavaScript();
  verifyNoCharacterDispatch();
  await verifyContent();
  console.log(
    `Hero Core Defense V2 static verification OK (${scriptCount} runtime modules, ${EXPECTED_RELEASE_ASSET_COUNT} release assets)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
