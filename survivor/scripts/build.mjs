import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const game=path.join(root,'survivor');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await fs.readFile(path.join(game,'assets/prepared-manifest.json'),'utf8'));
const processorHash=sha((await fs.readFile(path.join(game,'scripts/prepare-assets.mjs'),'utf8')).replace(/\r\n/g,'\n'));
if(manifest.version!==1||processorHash!==manifest.processorHash)throw new Error('Asset preparation contract changed; run node survivor/scripts/prepare-assets.mjs');
if(!manifest.normalization||!manifest.reverie||!manifest.ordeal)throw new Error('Missing anatomical art review');
for(const item of [{source:manifest.normalization.source,sha256:manifest.normalization.sha256},{source:manifest.normalization.processor,sha256:manifest.normalization.processorSha256},{source:manifest.reverie.source,sha256:manifest.reverie.sha256},{source:manifest.ordeal.source,sha256:manifest.ordeal.sha256}])if(sha(await fs.readFile(path.join(root,item.source)))!==item.sha256)throw new Error('Art normalization changed: '+item.source);
if(!manifest.renewal)throw new Error('Missing reviewed renewal art');
for(const item of [{source:manifest.renewal.source,sha256:manifest.renewal.sha256},...manifest.renewal.references])if(sha(await fs.readFile(path.join(root,item.source)))!==item.sha256)throw new Error('Art review/reference changed: '+item.source);
const assets={};
for(const asset of manifest.assets){const source=await fs.readFile(path.join(root,asset.source)),bytes=await fs.readFile(path.join(game,'assets',asset.file));if(sha(source)!==asset.sourceSha256||sha(bytes)!==asset.sha256||bytes.length!==asset.bytes)throw new Error('Asset source/cache mismatch: '+asset.id);if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw new Error('Invalid WebP: '+asset.id);assets[asset.id]='data:image/webp;base64,'+bytes.toString('base64');}
const font=await fs.readFile(path.join(game,'assets/Jua-Nocturne.woff'));
const fontManifest=JSON.parse(await fs.readFile(path.join(game,'assets/font-manifest.json'),'utf8'));
const fontSource=await fs.readFile(path.join(root,fontManifest.source));
const fontProcessor=await fs.readFile(path.join(game,'scripts/prepare-font.py'),'utf8');
if(sha(font)!==fontManifest.sha256||sha(fontSource)!==fontManifest.sourceSha256||sha(fontProcessor.replace(/\r\n/g,'\n'))!==fontManifest.processorSha256)throw new Error('Font source/cache mismatch; run python3 survivor/scripts/prepare-font.py');
const glyphs=new Set(fontManifest.codePoints);
for(const name of await fs.readdir(path.join(game,'src'))){const text=await fs.readFile(path.join(game,'src',name),'utf8');for(const char of text){const cp=char.codePointAt(0);if(cp>=0xAC00&&cp<=0xD7A3&&!glyphs.has(cp))throw new Error('Missing Korean glyph '+char+'; run python3 survivor/scripts/prepare-font.py');}}
const css=(await fs.readFile(path.join(game,'src/style.css'),'utf8')).replace('__FONT__','data:font/woff;base64,'+font.toString('base64'));
const result=await build({entryPoints:[path.join(game,'src/app.js')],bundle:true,write:false,format:'iife',target:['es2020'],minify:true,legalComments:'inline',charset:'utf8'});
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const source=await fs.readFile(path.join(game,'index.html'),'utf8');
for(const token of ['/*__STYLE__*/','/*__ASSETS__*/','/*__SCRIPT__*/'])if(source.split(token).length!==2)throw new Error('Build placeholder mismatch: '+token);
const awaitLicensePlaceholder='FONT_LICENSE_CONTENT';
const html=source.replace('/*__STYLE__*/',()=>css).replace('/*__ASSETS__*/',()=>`globalThis.NOCTURNE_ASSETS=${JSON.stringify(assets)};globalThis.NOCTURNE_FRAMES=${JSON.stringify(manifest.frames)};`).replace('/*__SCRIPT__*/',()=>script).replace('</head>',()=>`<!-- Jua font: Copyright 2018 The Jua Project Authors. SIL Open Font License 1.1. ${awaitLicensePlaceholder} -->\n</head>`);
// License is embedded verbatim. No runtime URLs are needed.
const license=await fs.readFile(path.join(game,'assets/Jua-OFL.txt'),'utf8');
const final=html.replace(awaitLicensePlaceholder,license.replace(/--/g,'—'));
if(/__FONT__|\/\*__\w+__\*\//.test(final))throw new Error('Unresolved build placeholder');
await fs.mkdir(path.join(game,'dist'),{recursive:true});await fs.writeFile(path.join(game,'dist/AstraNocturne.html'),final);
console.log(`AstraNocturne.html: ${(Buffer.byteLength(final)/1024/1024).toFixed(2)} MiB · ${manifest.assets.length} embedded textures · offline`);
