import { prepareArt } from './prepare_defense_art.mjs';
import { build, transform } from "esbuild";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
export const APP_ROOT = path.join(REPOSITORY_ROOT, "defense");
export const DEFAULT_OUTPUT = path.join(APP_ROOT, "dist-local", "HeroCoreDefense.html");
export const EXPECTED_RELEASE_ASSET_COUNT = 27;

const ENTRY_PATH = "./merge/main.js";
const ASSET_MODULE_PATH = path.join(APP_ROOT, "merge", "content.js");
const STYLESHEET_PATHS = Object.freeze([
  "./merge/style.css",
]);
const MIME_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".webp": "image/webp",
});

function escapeInlineBlock(source, closingTag) {
  return source.replace(new RegExp(`</${closingTag}`, "gi"), `<\\/${closingTag}`);
}

function normalizeResourcePath(value) {
  return String(value ?? "")
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\//, "");
}

function getQuotedAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function isReleaseRequired(entry) {
  return entry?.releaseRequired !== false;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveInsideApp(relativePath) {
  const resolved = path.resolve(APP_ROOT, relativePath);
  if (resolved !== APP_ROOT && !resolved.startsWith(`${APP_ROOT}${path.sep}`)) {
    throw new Error(`Asset path escapes defense: ${relativePath}`);
  }
  return resolved;
}

const localModulePlugin = {
  name: "hero-defense-v2-local-modules",
  setup(buildApi) {
    buildApi.onResolve({ filter: /^\./ }, (args) => {
      const baseDirectory = args.resolveDir || path.dirname(args.importer);
      const resolved = path.resolve(baseDirectory, args.path);
      if (resolved !== APP_ROOT && !resolved.startsWith(`${APP_ROOT}${path.sep}`)) {
        return { errors: [{ text: `Module escapes defense: ${args.path}` }] };
      }
      return { path: resolved, namespace: "hero-defense-v2-local" };
    });
    buildApi.onLoad({ filter: /.*/, namespace: "hero-defense-v2-local" }, async (args) => ({
      contents: await readFile(args.path, "utf8"),
      loader: "js",
      resolveDir: path.dirname(args.path),
    }));
  },
};

async function collectEmbeddedAssets({ requireReleaseAssets }) {
  const assetModule = await import(pathToFileURL(ASSET_MODULE_PATH).href);
  const manifest = assetModule.ASSET_MANIFEST;
  if (!Array.isArray(manifest)) {
    throw new TypeError("defense/merge/content.js must export ASSET_MANIFEST as an array.");
  }

  const releaseEntries = manifest.filter(isReleaseRequired);
  if (requireReleaseAssets && releaseEntries.length !== EXPECTED_RELEASE_ASSET_COUNT) {
    throw new Error(
      `V2 release asset manifest must contain ${EXPECTED_RELEASE_ASSET_COUNT} required entries; found ${releaseEntries.length}.`,
    );
  }

  const embeddedAssets = {};
  const embeddedPaths = {};
  const missingAssets = [];
  let embeddedBytes = 0;

  for (const entry of manifest) {
    const entryPath = String(entry?.path ?? "").trim();
    if (!entryPath) throw new TypeError(`Asset ${entry?.id ?? "(missing id)"} has no path.`);
    const sourcePath = resolveInsideApp(entryPath);
    if (!(await fileExists(sourcePath))) {
      missingAssets.push(entryPath);
      if (requireReleaseAssets && isReleaseRequired(entry)) {
        throw new Error(`Required V2 release asset is missing: ${entryPath}`);
      }
      continue;
    }

    const mimeType = MIME_TYPES[path.extname(sourcePath).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported V2 asset format: ${entryPath}`);
    const bytes = await readFile(sourcePath);
    embeddedAssets[entry.id] = `data:${mimeType};base64,${bytes.toString("base64")}`;
    embeddedPaths[normalizeResourcePath(entryPath)] = embeddedAssets[entry.id];
    embeddedBytes += bytes.length;
  }

  return {
    embeddedAssets,
    embeddedPaths,
    embeddedBytes,
    manifestCount: manifest.length,
    missingAssets,
    releaseRequiredCount: releaseEntries.length,
  };
}

function assertBundledCss(css) {
  if (/\@import\b/i.test(css)) {
    throw new Error("Bundled V2 CSS still contains @import; link all three source stylesheets explicitly.");
  }
  for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    const value = match[2].trim();
    if (value && !value.startsWith("data:") && !value.startsWith("#")) {
      throw new Error(`Bundled V2 CSS contains an external resource URL: ${value}`);
    }
  }
}

function inlineStylesheets(html, bundledCss) {
  const expected = new Set(STYLESHEET_PATHS.map(normalizeResourcePath));
  const matches = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => {
      const rel = getQuotedAttribute(tag, "rel");
      return rel?.toLowerCase().split(/\s+/).includes("stylesheet");
    })
    .map((tag) => ({ tag, href: normalizeResourcePath(getQuotedAttribute(tag, "href")) }))
    .filter(({ href }) => expected.has(href));

  const found = new Set(matches.map(({ href }) => href));
  const missing = [...expected].filter((stylesheet) => !found.has(stylesheet));
  if (missing.length) {
    throw new Error(`V2 index.html must link all source stylesheets; missing: ${missing.join(", ")}`);
  }

  let output = html;
  let inserted = false;
  for (const { tag } of matches) {
    const replacement = inserted
      ? ""
      : `<style data-bundled-from="${STYLESHEET_PATHS.join(",")}">\n${escapeInlineBlock(bundledCss, "style")}\n</style>`;
    output = output.replace(tag, () => replacement);
    inserted = true;
  }
  return output;
}

function inlineEntrypoint(html, javascript) {
  const scripts = [...html.matchAll(/<script\b[^>]*>\s*<\/script>/gi)].map((match) => match[0]);
  const entryTag = scripts.find((tag) => normalizeResourcePath(getQuotedAttribute(tag, "src")) === normalizeResourcePath(ENTRY_PATH));
  if (!entryTag) throw new Error(`V2 index.html does not load ${ENTRY_PATH}.`);
  return html.replace(
    entryTag,
    () => `<script data-bundled-from="${ENTRY_PATH}">\n${escapeInlineBlock(javascript, "script")}\n</script>`,
  );
}

function injectDistributionMetadata(html) {
  const meta = '<meta name="astra-defense-distribution" content="single-file-offline" />';
  const themeMeta = /<meta\b[^>]*name=["']theme-color["'][^>]*>/i;
  if (themeMeta.test(html)) return html.replace(themeMeta, `${meta}\n    $&`);
  return html.replace(/<head\b[^>]*>/i, `$&\n    ${meta}`);
}

function assertNoExternalHtmlResources(html) {
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) throw new Error("Bundled V2 HTML still has an external script.");
  if (/<link\b[^>]*\brel\s*=\s*(["'])stylesheet\1/i.test(html)) {
    throw new Error("Bundled V2 HTML still has an external stylesheet.");
  }
  if (/<script\b[^>]*\btype\s*=\s*(["'])module\1/i.test(html)) {
    throw new Error("Bundled V2 HTML still has a module script.");
  }

  // Inspect actual markup, not the HTML templates inside the bundled runtime.
  const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  const resourceTags = markup.match(/<(?:img|source|audio|video|track|iframe|object|link)\b[^>]*>/gi) ?? [];
  for (const tag of resourceTags) {
    for (const attribute of ["src", "srcset", "poster", "data", "href"]) {
      const value = getQuotedAttribute(tag, attribute)?.trim();
      if (!value || value.startsWith("data:") || value.startsWith("#")) continue;
      throw new Error(`Bundled V2 HTML still references an external resource: ${value}`);
    }
  }
}

export async function buildHeroDefenseV2Local({
  outputPath = DEFAULT_OUTPUT,
  minify = true,
  requireReleaseAssets = true,
} = {}) {
  if (requireReleaseAssets) await prepareArt();
  const [htmlTemplate, cssSources, assetData] = await Promise.all([
    readFile(path.join(APP_ROOT, "index.html"), "utf8"),
    Promise.all(STYLESHEET_PATHS.map((stylesheet) => readFile(resolveInsideApp(stylesheet), "utf8"))),
    collectEmbeddedAssets({ requireReleaseAssets }),
  ]);

  const embeddedAssetBanner = [
    "globalThis.__ASTRA_LOCAL_FILE__=true;",
    `globalThis.__ASTRA_ASSETS__=Object.freeze(${JSON.stringify(assetData.embeddedAssets)});`,
  ].join("");
  const entrySource = await readFile(path.join(APP_ROOT, "merge", "main.js"), "utf8");
  const bundle = await build({
    stdin: {
      contents: entrySource,
      loader: "js",
      resolveDir: path.join(APP_ROOT, "merge"),
      sourcefile: "main.js",
    },
    bundle: true,
    charset: "utf8",
    format: "iife",
    legalComments: "none",
    minify,
    platform: "browser",
    plugins: [localModulePlugin],
    target: ["chrome90", "safari15"],
    write: false,
    banner: { js: embeddedAssetBanner },
  });
  const javascript = bundle.outputFiles[0]?.text;
  if (!javascript) throw new Error("esbuild produced no V2 JavaScript output.");

  const cssInput = cssSources
    .map((source, index) => {
      const embedded=source.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,(match,quote,value)=>{
        if(value.startsWith('data:')||value.startsWith('#'))return match;
        const relative=path.relative(APP_ROOT,resolveInsideApp(path.join(path.dirname(STYLESHEET_PATHS[index]),value))).replace(/\\/g,'/');
        const data=assetData.embeddedPaths[relative];
        if(!data)throw new Error('Stylesheet asset is not embedded: '+relative);
        return `url("${data}")`;
      });
      return `/* ${STYLESHEET_PATHS[index]} */\n${embedded}`;
    })
    .join("\n");
  const bundledCss = (await transform(cssInput, {
    charset: "utf8",
    legalComments: "none",
    loader: "css",
    minify,
  })).code;
  assertBundledCss(bundledCss);

  let outputHtml = inlineStylesheets(htmlTemplate, bundledCss);
  outputHtml = inlineEntrypoint(outputHtml, javascript);
  outputHtml = injectDistributionMetadata(outputHtml);
  outputHtml = outputHtml.replace(
    /<!doctype html>/i,
    '<!doctype html>\n<!-- Generated by npm run build:defense-local. Edit defense source files, not this file. -->',
  );
  outputHtml = `${outputHtml.replace(/\r\n/g, "\n").replace(/^[\t ]+$/gm, "").trimEnd()}\n`;
  assertNoExternalHtmlResources(outputHtml);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, outputHtml, "utf8");
  const outputStats = await stat(outputPath);
  return {
    outputPath,
    outputBytes: outputStats.size,
    embeddedAssetCount: Object.keys(assetData.embeddedAssets).length,
    embeddedAssetBytes: assetData.embeddedBytes,
    manifestCount: assetData.manifestCount,
    missingAssets: [...assetData.missingAssets],
    releaseRequiredCount: assetData.releaseRequiredCount,
  };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const result = await buildHeroDefenseV2Local();
  console.log(`Hero Core Defense single HTML created: ${result.outputPath}`);
  console.log(
    `Size: ${(result.outputBytes / 1024 / 1024).toFixed(2)} MiB; embedded release assets: ${result.embeddedAssetCount}`,
  );
}
