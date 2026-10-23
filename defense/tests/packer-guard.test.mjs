import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSafeOutputDir} from '../scripts/art/pack_defense_directions.mjs';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const units = path.join(game, 'assets/merge/units');

test('the SD packer refuses to write into the committed unit atlases and manifest', () => {
  assert.throws(() => assertSafeOutputDir(units), /Refusing to write/);
  assert.throws(() => assertSafeOutputDir(units + path.sep), /Refusing to write/);
  assert.throws(() => assertSafeOutputDir(path.join(units, 'review')), /Refusing to write/);
  assert.throws(() => assertSafeOutputDir(path.relative(process.cwd(), units)), /Refusing to write/);
});

test('the SD packer still accepts a separate review directory', () => {
  assert.doesNotThrow(() => assertSafeOutputDir(path.join(os.tmpdir(), 'sd-pack-review')));
  assert.doesNotThrow(() => assertSafeOutputDir(path.join(game, 'assets/merge/units-review')));
  assert.doesNotThrow(() => assertSafeOutputDir(path.join(game, 'assets/merge')));
});
