import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { COSTUMES } from '../meta.js';
import { prepareAssets } from '../prepare-assets.mjs';

test('committed WebP cache matches its sources and processor without invoking image preprocessing', async () => {
  const report = await prepareAssets({ requireCache: true });
  assert.equal(report.cache.hit, true, 'run npm run build --prefix shooter and commit generated-assets after changing source art or preprocessing');
  assert.equal(report.output.fileCount, 121);
  assert.equal(report.output.files.length, 121);
  assert.ok(report.output.files.every(file => file.file.endsWith('.webp') && typeof file.sha256 === 'string'));
});

test('fresh LF and CRLF SVG checkouts reuse the committed cache without image preprocessing', async () => {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const report=await prepareAssets({requireCache:true});
  const sandbox=await fs.mkdtemp(path.join(os.tmpdir(),'astral-bloom-cache-'));
  const costumeFiles=new Set(COSTUMES.map(costume=>`${costume.id}.png`));
  try {
    await fs.mkdir(path.join(sandbox,'assets','costumes'),{recursive:true});
    await fs.copyFile(path.join(root,'prepare-assets.mjs'),path.join(sandbox,'prepare-assets.mjs'));
    await fs.writeFile(path.join(sandbox,'package.json'),'{"type":"module"}');
    await fs.writeFile(path.join(sandbox,'meta.js'),`export const COSTUMES=${JSON.stringify(COSTUMES)};\n`);
    await fs.cp(path.join(root,'generated-assets'),path.join(sandbox,'generated-assets'),{recursive:true});
    for(const input of report.source.files) {
      const relative=costumeFiles.has(input.file)?path.join('costumes',input.file):input.file;
      const source=path.join(root,'assets',relative),destination=path.join(sandbox,'assets',relative);
      // Copy text before changing it; binary inputs remain untouched hard links.
      if(input.file.endsWith('.svg'))await fs.copyFile(source,destination);
      else await fs.link(source,destination).catch(()=>fs.copyFile(source,destination));
    }
    const svg=path.join(sandbox,'assets','costume-tickets.svg');
    const lf=(await fs.readFile(svg,'utf8')).replace(/\r\n/g,'\n');
    const manifestBefore=await fs.readFile(path.join(sandbox,'generated-assets','manifest.json'));
    const {prepareAssets:prepareCheckout}=await import(pathToFileURL(path.join(sandbox,'prepare-assets.mjs')).href);
    for(const [format,text] of [['LF',lf],['CRLF',lf.replace(/\n/g,'\r\n')]]) {
      await fs.writeFile(svg,text);
      const checked=await prepareCheckout({requireCache:true});
      assert.equal(checked.cache.hit,true,`${format} checkout must reuse the cache`);
      assert.equal(checked.output.fileCount,121);
      assert.deepEqual(await fs.readFile(path.join(sandbox,'generated-assets','manifest.json')),manifestBefore,'cache assertions must not regenerate output');
    }
  } finally {
    const resolved=path.resolve(sandbox),temporaryRoot=path.resolve(os.tmpdir())+path.sep;
    assert.ok(resolved.startsWith(temporaryRoot)&&path.basename(resolved).startsWith('astral-bloom-cache-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});
