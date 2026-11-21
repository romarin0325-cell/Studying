// From the repository root:
//   node card_pixel/game/tools/build-sprites.mjs --import "<review bundle>"
//     Copy the original PNGs and registration data to card_pixel/art/pixel-v2.
//   node card_pixel/game/tools/build-sprites.mjs
//     Crop the repository copies and rebuild the game sprites and sprites.json.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const sourceDir = fileURLToPath(new URL('../../art/pixel-v2/', import.meta.url));
const outputDir = fileURLToPath(new URL('../assets/', import.meta.url));
const poses = ['idle', 'attack', 'hurt'];
const repairsDir = 'repairs-20261121';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function readFrame(file, sha256) {
  const png = fs.readFileSync(file);
  assert.equal(createHash('sha256').update(png).digest('hex'), sha256, file);
  return png;
}

function importCharacter(bundle, subject, repair) {
  const { id, name, kind, heightGroup, posture, metadata } = subject;
  const original = readJson(path.join(bundle, metadata));
  const repairMarks = path.posix.join(repairsDir, id, 'marks-final.json');
  const marksSource = repair && fs.existsSync(path.join(bundle, repairMarks)) ? repairMarks : metadata;
  const marks = marksSource === metadata ? original.marks : readJson(path.join(bundle, marksSource));
  const frames = {};
  for (const pose of poses) {
    const { file, sha256, width, height, bodyCenterX, feetBaselineY, alphaBounds } =
      (repair ?? original).frames.find(frame => frame.pose === pose);
    frames[pose] = { source: file, sha256, width, height, bodyCenterX, feetBaselineY, alphaBounds };
  }

  return {
    id, name, kind, heightGroup, posture, revision: (repair ?? subject).revision, marksSource, frames,
    marks: Object.fromEntries(poses.map((pose, index) =>
      [pose, marks?.find(mark => mark?.pose === pose) ?? marks?.[index] ?? null]))
  };
}

function importBundle(bundle) {
  const manifestFile = path.join(bundle, 'manifest.json');
  const { characters: subjects } = readJson(manifestFile);
  const { characters: repairs } = readJson(path.join(bundle, repairsDir, 'manifest.json'));
  const repairsById = new Map(repairs.map(repair => [repair.id, repair]));
  const characters = subjects.map(subject => importCharacter(bundle, subject, repairsById.get(subject.id)));
  const copies = characters.map(({ id, frames }) => ({
    id,
    pngs: poses.map(pose => {
      const { source, sha256 } = frames[pose];
      return readFrame(path.join(bundle, source), sha256);
    })
  }));

  for (const { id, pngs } of copies) {
    const directory = path.join(sourceDir, id);
    fs.mkdirSync(directory, { recursive: true });
    for (const [index, pose] of poses.entries()) fs.writeFileSync(path.join(directory, pose + '.png'), pngs[index]);
  }
  writeJson(path.join(sourceDir, 'manifest.json'), { characters });
  console.log('Imported', characters.length, 'characters to card_pixel/art/pixel-v2');
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
}

const heightClass = ({ kind, heightGroup }) => kind + ':' + heightGroup;

function headMedians(characters) {
  const groups = new Map();
  for (const character of characters) {
    const { crown, chin, eye } = character.marks.idle ?? {};
    if (!crown || !chin || !eye) continue;
    const key = heightClass(character);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ height: chin[1] - crown[1], eyeOffset: eye[1] - crown[1] });
  }
  return new Map([...groups].map(([key, samples]) => [key, {
    height: median(samples.map(sample => sample.height)),
    eyeOffset: median(samples.map(sample => sample.eyeOffset))
  }]));
}

function faceFromMarks(mark, crop, typical) {
  const { crown, chin, eye } = mark ?? {};
  const measured = crown && chin;
  if (!measured && !(typical && eye)) return null;

  const points = [crown, chin, eye].filter(Boolean);
  const center = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const top = measured ? crown[1] : chin ? chin[1] - typical.height : eye[1] - typical.eyeOffset;
  const bottom = chin ? chin[1] : top + typical.height;
  const x = Math.min(crop.width - 1, Math.max(0, Math.round(center - crop.x)));
  const y = Math.min(crop.height - 1, Math.max(0, Math.round(top - crop.y)));
  const size = Math.min(crop.height - y, Math.max(1, Math.round(bottom - Math.max(top, crop.y))));
  return { x, y, size, source: measured ? 'marks' : 'estimated' };
}

async function faceFromSilhouette(png, width, height) {
  const size = Math.ceil(height * 0.35);
  const data = await sharp(png).ensureAlpha().raw().toBuffer();
  let left = width;
  let right = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[(y * width + x) * 4 + 3]) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  assert.ok(right >= left, 'Sprite crop has no visible pixels in its top rows');
  return { x: Math.round((left + right) / 2), y: 0, size, source: 'estimated' };
}

async function cropFrame(character, pose, typical) {
  const frame = character.frames[pose];
  const crop = frame.alphaBounds;
  const { x, y, width, height } = crop;
  const png = await sharp(readFrame(path.join(sourceDir, character.id, pose + '.png'), frame.sha256))
    .extract({ left: x, top: y, width, height }).png({ palette: false }).toBuffer();
  const metadata = {
    width, height,
    bodyCenterX: Math.round(frame.bodyCenterX - x),
    feetBaselineY: Math.round(frame.feetBaselineY) - y
  };
  if (pose === 'idle') {
    const mark = character.marks.idle;
    // For creatures with only an eye mark, the upper silhouette gives a better region.
    const estimate = character.kind === 'ally' || mark?.chin ? typical : undefined;
    metadata.face = faceFromMarks(mark, crop, estimate) ?? await faceFromSilhouette(png, width, height);
  }
  return { png, metadata };
}

async function buildSprites() {
  const { characters } = readJson(path.join(sourceDir, 'manifest.json'));
  const spritesFile = path.join(outputDir, 'sprites.json');
  const sprites = readJson(spritesFile);
  const frames = new Map(characters.flatMap(character =>
    poses.map(pose => [character.id + '-' + pose + '.png', { character, pose }])));
  const files = Object.keys(sprites).filter(file => file !== 'ash-fx.png');
  assert.ok(Object.hasOwn(sprites, 'ash-fx.png'));
  assert.equal(files.length, frames.size, 'Sprite key count');
  assert.ok(files.every(file => frames.has(file)), 'Sprite keys differ from the source manifest');

  const medians = headMedians(characters);
  const outputs = new Map();
  for (const file of files) {
    const { character, pose } = frames.get(file);
    const { png, metadata } = await cropFrame(character, pose, medians.get(heightClass(character)));
    const { face, ...geometry } = metadata;
    Object.assign(sprites[file], geometry);
    if (face) sprites[file].face = face;
    outputs.set(file, png);
  }

  for (const [file, png] of outputs) fs.writeFileSync(path.join(outputDir, file), png);
  writeJson(spritesFile, sprites);
  console.log('Built', outputs.size, 'sprite frames');
}

const args = process.argv.slice(2);
if (!args.length) await buildSprites();
else if (args.length === 2 && args[0] === '--import') importBundle(path.resolve(args[1]));
else throw new Error('Usage: node card_pixel/game/tools/build-sprites.mjs [--import "<review bundle>"]');
