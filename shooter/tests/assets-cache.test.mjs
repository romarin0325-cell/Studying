import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAssets } from '../prepare-assets.mjs';

test('committed WebP cache matches its sources and processor without invoking image preprocessing', async () => {
  const report = await prepareAssets();
  assert.equal(report.cache.hit, true, 'run npm run build --prefix shooter and commit generated-assets after changing source art or preprocessing');
  assert.equal(report.output.fileCount, 94);
  assert.equal(report.output.files.length, 94);
  assert.ok(report.output.files.every(file => file.file.endsWith('.webp') && typeof file.sha256 === 'string'));
});
