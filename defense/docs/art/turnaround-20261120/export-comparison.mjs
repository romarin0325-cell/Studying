// Materialize the reviewed offline HTML from the exact hashes in its compact template.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const target = process.argv[2];
if (!target || process.argv.length !== 3) throw new Error('Usage: node export-comparison.mjs <new-output.html>');
const template = await fs.readFile(path.join(here, 'cast-comparison.html.in'), 'utf8');
const tag = '<script id="payload" type="application/json">';
const start = template.indexOf(tag), end = template.indexOf('</script>', start + tag.length);
assert.ok(start >= 0 && end > start, 'Missing viewer payload');
const dataset = JSON.parse(template.slice(start + tag.length, end));
const versions = [
  ...dataset.actors, ...dataset.actors.filter(a => a.revision).map(a => a.revision.previous),
  ...dataset.references, dataset.octSiren,
];
for (const art of versions) {
  for (const type of ['source', 'game']) {
    const field = type + 'Data', value = art[field];
    if (!value) continue;
    const file = art[type + 'Path'];
    let bytes;
    if (value.startsWith('@repo/')) {
      assert.equal(value, '@repo/' + file);
      const rooted = path.resolve(repo, file);
      assert.ok(rooted.startsWith(path.join(repo, 'defense', 'assets') + path.sep), file);
      bytes = await fs.readFile(rooted);
    } else {
      const dataPrefix = 'data:image/webp;base64,';
      assert.ok(value.startsWith(dataPrefix), 'Bad embedded reference');
      bytes = Buffer.from(value.slice(dataPrefix.length), 'base64');
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), art[type + 'Hash'], file);
    art[field] = 'data:image/webp;base64,' + bytes.toString('base64');
  }
}
const packed = JSON.stringify(dataset).replace(/</g, '\\u003c');
const html = template.slice(0, start + tag.length) + packed + template.slice(end);
await fs.writeFile(path.resolve(target), html, {flag:'wx'});
console.log(dataset.actors.length + ' characters · ' + path.resolve(target));
