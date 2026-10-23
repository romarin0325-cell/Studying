import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSafeOutputDir} from '../scripts/art/output-guard.mjs';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(game, 'assets');
const units = path.join(assets, 'merge/units');

test('the SD packers refuse every directory under defense/assets', () => {
  for (const dir of [units, units + path.sep, path.join(units, 'review'), path.relative(process.cwd(), units),
    path.join(assets, 'merge'), assets, path.join(assets, 'optimized'), path.join(game, 'assets/../assets/merge'),
    path.join(assets, 'merge/not-yet-created/deeper')]) {
    assert.throws(() => assertSafeOutputDir(dir), /Refusing to write/, dir);
  }
  assert.throws(() => assertSafeOutputDir(path.join(assets, 'merge'), 'proof'), /Refusing to write the proof/);
});

test('a link into defense/assets is followed and refused, a dangling link is refused', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sd-guard-'));
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  const link = path.join(dir, 'units-link'), dangling = path.join(dir, 'dangling');
  // Remove the links themselves first: a recursive delete must never walk through a junction into assets/.
  // rmdir without recursion drops a junction or fails on a real directory; it never deletes its contents.
  const unlinkOnly = file => fs.unlink(file).catch(() => fs.rmdir(file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  t.after(async () => { await unlinkOnly(link); await unlinkOnly(dangling); await fs.rm(dir, {recursive: true, force: true}); });
  await fs.symlink(units, link, type);
  assert.throws(() => assertSafeOutputDir(link), /Refusing to write/);
  assert.throws(() => assertSafeOutputDir(path.join(link, 'new-subdir')), /Refusing to write/);
  const missing = path.join(dir, 'missing-target');
  await fs.mkdir(missing);
  await fs.symlink(missing, dangling, type);
  await fs.rm(missing, {recursive: true});
  assert.throws(() => assertSafeOutputDir(path.join(dangling, 'out')), /Refusing to write through/);
});

test('the SD packers still accept review directories outside defense/assets', () => {
  assert.doesNotThrow(() => assertSafeOutputDir(path.join(os.tmpdir(), 'sd-pack-review')));
  assert.doesNotThrow(() => assertSafeOutputDir(path.join(game, 'test-results/sd-pack')));
  assert.doesNotThrow(() => assertSafeOutputDir(path.join(game, 'assets-review')));
});
