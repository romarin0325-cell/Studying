import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderReports,checkGeneratedReports,writeGeneratedReports} from '../scripts/generated-reports.mjs';

async function fixture(t){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'star-garden-reports-'));
  t.after(async()=>{
    assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('star-garden-reports-'));
    await fs.rm(directory,{recursive:true,force:true});
  });
  await writeGeneratedReports(directory);return directory;
}

test('both generated reports match local inputs and CRLF checkouts compare consistently',async t=>{
  const directory=await fixture(t),reports=await renderReports();
  for(const [name,text] of reports)await fs.writeFile(path.join(directory,name),text.replaceAll('\n','\r\n'));
  await checkGeneratedReports(directory);
  for(const [name,text] of reports)assert.equal(await fs.readFile(path.join(directory,name),'utf8'),text.replaceAll('\n','\r\n'));
});

test('a forged balance snapshot fails and the comparison leaves the edited evidence untouched',async t=>{
  const directory=await fixture(t),file=path.join(directory,'BALANCE_SNAPSHOT.json');
  const data=JSON.parse(await fs.readFile(file,'utf8'));data.tuning.heroDrawCost+=1;
  const forged=JSON.stringify(data,null,2)+'\n';await fs.writeFile(file,forged);
  await assert.rejects(checkGeneratedReports(directory),/BALANCE_SNAPSHOT\.json/);
  assert.equal(await fs.readFile(file,'utf8'),forged);
});

test('forged asset hash, font hash, source path and missing texture entries each fail comparison',async t=>{
  const directory=await fixture(t),file=path.join(directory,'ASSET_PROVENANCE.json');
  const original=await fs.readFile(file,'utf8');
  for(const change of [data=>data.assets[0].sha256='0'.repeat(64),data=>data.font.sha256='0'.repeat(64),data=>data.assets[0].source='missing.webp',data=>data.assets.pop()]){
    const data=JSON.parse(original);change(data);const forged=JSON.stringify(data,null,2)+'\n';
    await fs.writeFile(file,forged);await assert.rejects(checkGeneratedReports(directory),/ASSET_PROVENANCE\.json/);
    assert.equal(await fs.readFile(file,'utf8'),forged);
  }
});

test('deleted or renamed generated JSON fails instead of becoming documentation-only success',async t=>{
  const directory=await fixture(t);
  for(const name of ['BALANCE_SNAPSHOT.json','ASSET_PROVENANCE.json']){
    const file=path.join(directory,name),moved=path.join(directory,'moved-'+name);
    await fs.rename(file,moved);await assert.rejects(checkGeneratedReports(directory),new RegExp(name.replace('.','\\.')));
    await fs.rename(moved,file);
  }
});
