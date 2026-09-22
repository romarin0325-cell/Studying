import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.dirname(scriptPath);
let sharp;
const getSharp = async () => sharp ||= (await import('sharp')).default;
const CACHE_VERSION = 1;
const GENERATED_ASSETS = path.join(root, 'generated-assets');
const EVENT_ASSETS = ['harmonious', 'gold-dragon', 'ancient-soul', 'behemoth', 'time-ruler'];
const ASSET_INPUTS = ['heroes', 'bosses', 'enemies', 'worlds', 'companions', 'secrets', 'sentinels', 'relics', 'tides', 'bloom-fx', 'tide-worlds', 'tide-relics', 'shield-relics', 'astea', 'celestial-relics', 'celestial-world', 'balance-relics', ...EVENT_ASSETS.flatMap(name => [name, `${name}-world`])];
const ART_WEBP = { quality: 88, alphaQuality: 100, effort: 6 };
const WORLD_WEBP = { quality: 84, alphaQuality: 100, effort: 6 };
const CHARACTER_KINDS = new Set(['heroes', 'companions', 'secrets']);
const KEEP_SOURCE_ALPHA = new Set(['tides', 'bloom-fx']);
const FACE_WIDTHS = {
  heroes: [.106, .102, .099, .101],
  companions: [.13, .110, .119, .105],
  secrets: [.078, .100, .103, .35]
};
const SHIELD_BOUNDS = [[8,4,350,351],[408,28,292,322],[750,25,340,330],[1165,30,256,320],[8,365,352,340],[390,350,346,368],[750,382,330,322],[1130,360,304,344],[5,700,357,360],[377,710,346,350],[750,720,340,340]];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const imagePath = name => path.join(root, 'assets', `${name}${name === 'worlds' ? '.jpg' : '.png'}`);
const webpPath = (destination, group, index) => path.join(destination, group, `${index}.webp`);
const sha256 = data => createHash('sha256').update(data).digest('hex');

async function sourceInventory() {
  return Promise.all(ASSET_INPUTS.map(async name => {
    const file = imagePath(name), data = await fs.readFile(file);
    return { file: path.basename(file), bytes: data.length, sha256: sha256(data) };
  }));
}

function cacheFilePath(directory, file) {
  const rootPath = path.resolve(directory), candidate = path.resolve(rootPath, file);
  return candidate.startsWith(`${rootPath}${path.sep}`) ? candidate : null;
}

async function readCachedReport(directory, fingerprint) {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    if (manifest.version !== CACHE_VERSION || manifest.sourceHash !== fingerprint.sourceHash || manifest.processorHash !== fingerprint.processorHash) return null;
    const files = manifest.report?.output?.files;
    if (!Array.isArray(files) || files.length !== 94) return null;
    for (const file of files) {
      const destination = cacheFilePath(directory, file.file);
      if (!destination || !Number.isInteger(file.bytes) || typeof file.sha256 !== 'string') return null;
      const data = await fs.readFile(destination);
      if (data.length !== file.bytes || sha256(data) !== file.sha256) return null;
    }
    return manifest.report;
  } catch {
    return null;
  }
}

async function writeReport(report) {
  const reportDirectory = path.join(root, 'artifacts');
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(path.join(reportDirectory, 'asset-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

function cropPixels(data, sourceWidth, left, top, width, height) {
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((top + y) * sourceWidth + left) * 4;
    data.copy(output, y * width * 4, from, from + width * 4);
  }
  return output;
}

function chromaKey(data, width, height) {
  const keyed = new Uint8Array(width * height);
  for (let pixel = 0, offset = 0; pixel < keyed.length; pixel++, offset += 4) {
    const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
    if (green > 150 && green > red * 1.7 && green > blue * 1.65) {
      keyed[pixel] = 1;
      const alpha = clamp((Math.max(red, blue) - 45) / 80, 0, 1);
      data[offset + 3] = Math.round(alpha * 255);
      data[offset + 1] = Math.min(green, Math.max(red, blue) * 1.12);
    }
  }
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const pixel = y * width + x, offset = pixel * 4;
    if (!keyed[pixel] && (keyed[pixel - 1] || keyed[pixel + 1] || keyed[pixel - width] || keyed[pixel + width])) {
      const strongest = Math.max(data[offset], data[offset + 2]);
      const spill = data[offset + 1] - strongest;
      if (spill > 12) {
        data[offset + 1] = strongest + 5;
        data[offset + 3] = Math.round(data[offset + 3] * (1 - clamp((spill - 12) / 230, 0, .8)));
      }
    }
  }
  return data;
}

function alphaBounds(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let pixel = 0, offset = 3; pixel < width * height; pixel++, offset += 4) if (data[offset] > 30) {
    const x = pixel % width, y = Math.floor(pixel / width);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? { left: 0, top: 0, width: width, height: height } : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function resizeRaw(data, width, height, targetWidth, targetHeight) {
  const sharp = await getSharp();
  return sharp(data, { raw: { width, height, channels: 4 } })
    .resize(targetWidth, targetHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .raw().toBuffer();
}

async function containRaw(data, width, height, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / width, targetHeight / height);
  const resizedWidth = Math.max(1, Math.round(width * scale)), resizedHeight = Math.max(1, Math.round(height * scale));
  const resized = await resizeRaw(data, width, height, resizedWidth, resizedHeight);
  const output = Buffer.alloc(targetWidth * targetHeight * 4);
  const left = Math.floor((targetWidth - resizedWidth) / 2), top = Math.floor((targetHeight - resizedHeight) / 2);
  for (let y = 0; y < resizedHeight; y++) resized.copy(output, ((top + y) * targetWidth + left) * 4, y * resizedWidth * 4, (y + 1) * resizedWidth * 4);
  return output;
}

async function writeRaw(destination, data, width, height, options, outputs) {
  const sharp = await getSharp();
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await sharp(data, { raw: { width, height, channels: 4 } }).webp(options).toFile(destination);
  const output = await fs.readFile(destination);
  outputs.push({ file: path.relative(path.dirname(path.dirname(destination)), destination).replaceAll('\\', '/'), bytes: output.length, width, height, sha256: sha256(output) });
}

function cellGeometry(kind, index, sourceWidth, sourceHeight, columns) {
  const nominalWidth = sourceWidth * (kind === 'secrets' && index === 0 ? .52 : kind === 'secrets' && index === 1 ? .46 : 1 / columns);
  const left = Math.floor(kind === 'secrets' && index === 1 ? sourceWidth * .54 : (index % columns) * nominalWidth);
  const topFraction = kind === 'tides' ? (index < 2 ? 0 : .53) : kind === 'companions' && index === 3 ? .54 : kind === 'companions' && index === 2 ? .51 : Math.floor(index / columns) / columns;
  const bottomFraction = kind === 'tides' ? (index < 2 ? .53 : 1) : kind === 'companions' && index === 1 ? .535 : Math.floor(index / columns + 1) / columns;
  return {
    left,
    top: Math.floor(topFraction * sourceHeight),
    width: Math.min(sourceWidth - left, Math.floor(nominalWidth)),
    height: Math.min(sourceHeight - Math.floor(topFraction * sourceHeight), Math.floor((bottomFraction - topFraction) * sourceHeight))
  };
}

async function readRaw(name) {
  const sharp = await getSharp();
  const input = imagePath(name);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { input, data, width: info.width, height: info.height };
}

async function processSpriteSheet(name, destination, outputs) {
  const source = await readRaw(name);
  const standalone = name === 'astea' || EVENT_ASSETS.includes(name);
  const columns = standalone ? 1 : name === 'relics' ? 4 : 2;
  for (let index = 0; index < columns * columns; index++) {
    const area = cellGeometry(name, index, source.width, source.height, columns);
    let pixels = cropPixels(source.data, source.width, area.left, area.top, area.width, area.height);
    if (!KEEP_SOURCE_ALPHA.has(name)) pixels = chromaKey(pixels, area.width, area.height);
    let output, size;
    if (CHARACTER_KINDS.has(name)) {
      const box = alphaBounds(pixels, area.width, area.height);
      const cropped = cropPixels(pixels, area.width, box.left, box.top, box.width, box.height);
      const targetFace = name === 'secrets' && index === 0 ? 73 : 100;
      const scale = name === 'secrets' && index === 3 ? 470 / Math.max(box.width, box.height) : Math.min(targetFace / (source.width * FACE_WIDTHS[name][index]), 470 / Math.max(box.width, box.height));
      const resizedWidth = Math.max(1, Math.round(box.width * scale)), resizedHeight = Math.max(1, Math.round(box.height * scale));
      const resized = await resizeRaw(cropped, box.width, box.height, resizedWidth, resizedHeight);
      output = Buffer.alloc(512 * 512 * 4);
      const left = Math.floor((512 - resizedWidth) / 2), top = Math.floor((512 - resizedHeight) / 2);
      for (let y = 0; y < resizedHeight; y++) resized.copy(output, ((top + y) * 512 + left) * 4, y * resizedWidth * 4, (y + 1) * resizedWidth * 4);
      size = 512;
    } else if (standalone) {
      output = await containRaw(pixels, area.width, area.height, 384, 384);
      size = 384;
    } else {
      output = await resizeRaw(pixels, area.width, area.height, 384, 384);
      size = 384;
    }
    await writeRaw(webpPath(destination, name, index), output, size, size, ART_WEBP, outputs);
    if (name === 'companions' && index === 3) {
      const sharp = await getSharp();
      const dark = await sharp(output, { raw: { width: 512, height: 512, channels: 4 } }).negate({ alpha: false }).raw().toBuffer();
      await writeRaw(path.join(destination, 'companions', 'dark-fairy.webp'), dark, 512, 512, ART_WEBP, outputs);
    }
  }
}

async function processWorldAtlas(name, columns, destination, outputs) {
  const sharp = await getSharp();
  const input = imagePath(name), metadata = await sharp(input).metadata();
  for (let index = 0; index < columns; index++) {
    const left = Math.floor(index * metadata.width / columns), right = Math.floor((index + 1) * metadata.width / columns);
    const output = webpPath(destination, name, index);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await sharp(input).extract({ left, top: 0, width: right - left, height: metadata.height }).resize(450, 1200, { fit: 'fill' }).webp(WORLD_WEBP).toFile(output);
    const data = await fs.readFile(output); outputs.push({ file: `${name}/${index}.webp`, bytes: data.length, width: 450, height: 1200, sha256: sha256(data) });
  }
}

async function processTideRelics(destination, outputs) {
  const source = await readRaw('tide-relics');
  for (let index = 0; index < 6; index++) {
    const width = Math.floor(source.width / 3), height = Math.floor(source.height / 2);
    const pixels = cropPixels(source.data, source.width, index % 3 * width, Math.floor(index / 3) * height, width, height);
    await writeRaw(webpPath(destination, 'tide-relics', index), await resizeRaw(pixels, width, height, 384, 384), 384, 384, ART_WEBP, outputs);
  }
}

async function processShieldRelics(destination, outputs) {
  const source = await readRaw('shield-relics');
  for (let index = 0; index < SHIELD_BOUNDS.length; index++) {
    const [x, y, width, height] = SHIELD_BOUNDS[index];
    const left = Math.floor(x / 1448 * source.width), top = Math.floor(y / 1086 * source.height);
    const cropWidth = Math.floor(width / 1448 * source.width), cropHeight = Math.floor(height / 1086 * source.height);
    const pixels = cropPixels(source.data, source.width, left, top, cropWidth, cropHeight);
    const scale = 180 / Math.max(width, height), targetWidth = Math.max(1, Math.round(width * scale)), targetHeight = Math.max(1, Math.round(height * scale));
    const resized = await resizeRaw(pixels, cropWidth, cropHeight, targetWidth, targetHeight), output = Buffer.alloc(192 * 192 * 4);
    for (let offset = 0; offset < output.length; offset += 4) { output[offset] = 20; output[offset + 1] = 32; output[offset + 2] = 54; output[offset + 3] = 255; }
    const leftOut = Math.floor((192 - targetWidth) / 2), topOut = Math.floor((192 - targetHeight) / 2);
    for (let row = 0; row < targetHeight; row++) resized.copy(output, ((topOut + row) * 192 + leftOut) * 4, row * targetWidth * 4, (row + 1) * targetWidth * 4);
    await writeRaw(webpPath(destination, 'shield-relics', index), output, 192, 192, ART_WEBP, outputs);
  }
}

async function processSmallRelics(name, columns, rows, destination, outputs, boxes = null) {
  const source = await readRaw(name);
  for (let index = 0; index < columns * rows; index++) {
    const box = boxes?.[index] || [index % columns / columns, Math.floor(index / columns) / rows, 1 / columns, 1 / rows];
    const left = Math.floor(box[0] * source.width), top = Math.floor(box[1] * source.height);
    const width = Math.floor(box[2] * source.width), height = Math.floor(box[3] * source.height);
    const pixels = cropPixels(source.data, source.width, left, top, width, height);
    await writeRaw(webpPath(destination, name, index), await resizeRaw(pixels, width, height, 192, 192), 192, 192, ART_WEBP, outputs);
  }
}

async function qualityProbe() {
  const sharp = await getSharp();
  const probes = [];
  for (const name of ['heroes', 'worlds']) {
    const input = imagePath(name), sourceBytes = (await fs.stat(input)).size;
    const qualities = [];
    for (const quality of [72, 80, 88, 94]) qualities.push({ quality, bytes: (await sharp(input).webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer()).length });
    probes.push({ source: path.basename(input), sourceBytes, qualities });
  }
  return probes;
}

export async function prepareAssets({ outputDirectory = GENERATED_ASSETS, writeReport: shouldWriteReport = false } = {}) {
  const cacheDirectory = path.resolve(outputDirectory);
  if (!cacheDirectory.startsWith(`${root}${path.sep}`)) throw new Error(`Asset cache must stay inside shooter/: ${cacheDirectory}`);
  const source = await sourceInventory();
  const fingerprint = { sourceHash: sha256(JSON.stringify(source)), processorHash: sha256(await fs.readFile(scriptPath)) };
  const cached = await readCachedReport(cacheDirectory, fingerprint);
  if (cached) {
    const report = { ...cached, cache: { hit: true, directory: path.relative(root, cacheDirectory).replaceAll('\\', '/') } };
    if (shouldWriteReport) await writeReport(report);
    return report;
  }
  await fs.rm(cacheDirectory, { recursive: true, force: true });
  const outputs = [];
  for (const name of ['heroes', 'bosses', 'enemies', 'companions', 'secrets', 'sentinels', 'relics', 'tides', 'bloom-fx', 'astea', ...EVENT_ASSETS]) await processSpriteSheet(name, cacheDirectory, outputs);
  await processWorldAtlas('worlds', 4, cacheDirectory, outputs);
  await processWorldAtlas('tide-worlds', 2, cacheDirectory, outputs);
  await processWorldAtlas('celestial-world', 1, cacheDirectory, outputs);
  for (const name of EVENT_ASSETS) await processWorldAtlas(`${name}-world`, 1, cacheDirectory, outputs);
  await processTideRelics(cacheDirectory, outputs);
  await processShieldRelics(cacheDirectory, outputs);
  await processSmallRelics('celestial-relics', 2, 2, cacheDirectory, outputs, [[0,0,.5,.5],[.5,0,.5,.5],[.008,.455,.484,.484],[.5,.5,.5,.5]]);
  await processSmallRelics('balance-relics', 3, 2, cacheDirectory, outputs);
  const sourceBytes = source.reduce((total, item) => total + item.bytes, 0), outputBytes = outputs.reduce((total, item) => total + item.bytes, 0);
  const report = {
    source: { fileCount: source.length, bytes: sourceBytes, files: source },
    output: { fileCount: outputs.length, bytes: outputBytes, format: 'webp', files: outputs },
    reduction: { bytes: sourceBytes - outputBytes, percent: Number(((1 - outputBytes / sourceBytes) * 100).toFixed(2)) },
    qualityProbes: await qualityProbe()
  };
  await fs.writeFile(path.join(cacheDirectory, 'manifest.json'), `${JSON.stringify({ version: CACHE_VERSION, ...fingerprint, report }, null, 2)}\n`);
  const result = { ...report, cache: { hit: false, directory: path.relative(root, cacheDirectory).replaceAll('\\', '/') } };
  if (shouldWriteReport) await writeReport(result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await prepareAssets({ writeReport: true });
  console.log(JSON.stringify({ sourceBytes: report.source.bytes, outputBytes: report.output.bytes, reductionPercent: report.reduction.percent, files: report.output.fileCount, cacheHit: report.cache.hit }, null, 2));
}
