import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {replaceMemorials} from '../scripts/art/replace-memorials.mjs';
import {gameRoot,assetFile} from '../scripts/local-inputs.mjs';
import {MEMORIAL_MEDIA_MANIFEST} from '../src/memorial-media.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const record={sourceFilename:'old.png',sourceSha256:'old-source',avifPath:'./assets/memorial/sample.avif',
  webp:{path:'./assets/memorial-webp/sample.webp'},bodySha256:'unchanged-story',titleLine:1,bodyStartLine:2,bodyEndLine:3};
const catalog=records=>'export const MEMORIAL_MEDIA_MANIFEST = '+JSON.stringify(records,null,2)+';\n';
const readRecord=async root=>JSON.parse((await fs.readFile(path.join(root,'src/memorial-media.js'),'utf8')).split(' = ')[1].slice(0,-2)).sample;
async function fixture(t){
  const parent=path.join(gameRoot,'test-results');await fs.mkdir(parent,{recursive:true});
  const root=await fs.mkdtemp(path.join(parent,'memorial-replace-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const dir of ['src','input','assets/memorial','assets/memorial-webp'])await fs.mkdir(path.join(root,dir),{recursive:true});
  await fs.writeFile(path.join(root,'src/memorial-media.js'),catalog({sample:record}));
  await fs.writeFile(path.join(root,record.avifPath),'previous AVIF');await fs.writeFile(path.join(root,record.webp.path),'previous WebP');
  const png=await sharp({create:{width:720,height:1080,channels:3,background:'#5e82ac'}}).png().toBuffer();
  await fs.writeFile(path.join(root,'input/new.png'),png);
  return {root,dir:path.join(root,'input'),png};
}

test('replacement retains original PNG bytes, old paintings and earlier replacements across reruns',async t=>{
  const {root,dir,png}=await fixture(t);
  await replaceMemorials(dir,['sample=new.png'],{root});
  const first=await readRecord(root),firstCatalog=await fs.readFile(path.join(root,'src/memorial-media.js'));
  assert.deepEqual(await fs.readFile(path.join(root,first.sourcePath)),png);
  assert.equal(first.sourceSha256,hash(png));assert.equal(first.sourceBytes,png.length);
  assert.equal(first.bodySha256,record.bodySha256);assert.equal(first.bodyStartLine,record.bodyStartLine);
  for(const [relative,expected] of [[record.avifPath,'previous AVIF'],[record.webp.path,'previous WebP']])assert.equal(await fs.readFile(path.join(root,relative),'utf8'),expected);
  const retained=new Map();
  for(const [relative,sha] of [[first.sourcePath,first.sourceSha256],[first.avifPath,first.outputSha256],[first.webp.path,first.webp.outputSha256]]){
    const bytes=await fs.readFile(path.join(root,relative));assert.equal(hash(bytes),sha);assert.ok(relative.includes(sha));retained.set(relative,bytes);
  }
  await replaceMemorials(dir,['sample=new.png'],{root});
  assert.deepEqual(await fs.readFile(path.join(root,'src/memorial-media.js')),firstCatalog,'rerun is identical');
  const nextPng=await sharp({create:{width:720,height:1080,channels:3,background:'#ad5040'}}).png().toBuffer();
  await fs.writeFile(path.join(dir,'next.png'),nextPng);await replaceMemorials(dir,['sample=next.png'],{root});
  const next=await readRecord(root);assert.notEqual(next.sourcePath,first.sourcePath);assert.notEqual(next.avifPath,first.avifPath);
  for(const [relative,bytes] of retained)assert.deepEqual(await fs.readFile(path.join(root,relative)),bytes,'previous version retained');
});

test('invalid batches and conflicting preserved files fail before changing the catalog or installing files',async t=>{
  const {root,dir,png}=await fixture(t),file=path.join(root,'src/memorial-media.js'),before=await fs.readFile(file);
  for(const pairs of [['sample=new.png','unknown=new.png'],['sample=new.png','sample=new.png'],['bad-pair']]){
    await assert.rejects(replaceMemorials(dir,pairs,{root}));
    assert.deepEqual(await fs.readFile(file),before);
    await assert.rejects(fs.access(path.join(root,'assets/memorial-sources')),{code:'ENOENT'});
  }
  const source=path.join(root,'assets/memorial-sources/sample',hash(png)+'.png');
  await fs.mkdir(path.dirname(source),{recursive:true});await fs.writeFile(source,'preserved conflict');
  await assert.rejects(replaceMemorials(dir,['sample=new.png'],{root}),/Refusing to overwrite preserved memorial/);
  assert.equal(await fs.readFile(source,'utf8'),'preserved conflict');assert.deepEqual(await fs.readFile(file),before);
  await assert.rejects(fs.access(path.join(root,'assets/memorial/replacements')),{code:'ENOENT'});
});

test('a separate companion catalog can be updated without changing the main catalog',async t=>{
  const {root,dir,png}=await fixture(t),main=path.join(root,'src/memorial-media.js');
  const before=await fs.readFile(main),separate='src/new-memorial-media.js';
  await fs.writeFile(path.join(root,separate),catalog({sample:record}));
  await replaceMemorials(dir,['sample=new.png'],{root,catalog:separate});
  const next=JSON.parse((await fs.readFile(path.join(root,separate),'utf8')).split(' = ')[1].slice(0,-2)).sample;
  assert.equal(next.sourceSha256,hash(png));assert.equal(next.bodySha256,record.bodySha256);
  assert.deepEqual(await fs.readFile(main),before);
});

test('all eight installed replacements retain their PNG sources and the paintings from before pass 18',async()=>{
  const preservation=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/art/pass18-memorials/manifest.json'),'utf8'));
  assert.deepEqual(preservation.paintings.map(p=>p.id).sort(),['venom','antropy','toffee_apple','sunflower','underdog','behemoth','joker','cure_master'].sort());
  for(const {id,previous} of preservation.paintings){
    const media=MEMORIAL_MEDIA_MANIFEST[id],source=await fs.readFile(assetFile(media.sourcePath));
    assert.equal(hash(source),media.sourceSha256,id+' PNG');assert.equal(source.length,media.sourceBytes);
    const meta=await sharp(source).metadata();assert.equal(meta.format,'png');assert.equal(meta.width,media.sourceWidth);assert.equal(meta.height,media.sourceHeight);
    for(const original of [previous.avif,previous.webp])assert.equal(hash(await fs.readFile(assetFile(original.path))),original.sha256,id+' previous painting');
    for(const [relative,sha] of [[media.avifPath,media.outputSha256],[media.webp.path,media.webp.outputSha256]]){
      assert.match(relative,/\/replacements\//);assert.ok(relative.includes(sha));assert.equal(hash(await fs.readFile(assetFile(relative))),sha,id+' replacement');
      assert.notEqual(relative,previous.avif.path);assert.notEqual(relative,previous.webp.path);
    }
  }
});
