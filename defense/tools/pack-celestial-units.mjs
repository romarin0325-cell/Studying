import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packDirections} from '../../scripts/pack_defense_directions.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const sourceDir=process.argv[2];
if(!sourceDir)throw new Error('Supply the directory containing the hash-bound expansion PNG sources.');
const entries=JSON.parse(await readFile(new URL('../docs/art/expansion/LANDMARKS.json',import.meta.url),'utf8'));
const out=path.join(root,'defense/assets/merge/units');
const prior=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
// Pack into a staging directory first. A rejected source cannot replace the
// approved manifest or any of the existing 21 characters.
const staging=path.join(sourceDir,'packed');
const added=await packDirections({sourceDir,entries,outputDir:staging,proofDir:path.join(sourceDir,'proof')});
for(const frame of added)await copyFile(path.join(staging,frame.file),path.join(out,frame.file));
const ids=new Set(added.map(x=>x.id));
prior.frames=[...prior.frames.filter(x=>!ids.has(x.id)),...added];
await writeFile(path.join(out,'manifest.json'),JSON.stringify(prior,null,2)+'\n');
const landmarksFile=path.join(root,'defense/docs/art/ANATOMICAL_LANDMARKS.json');
const existing=JSON.parse(await readFile(landmarksFile,'utf8'));
await writeFile(landmarksFile,JSON.stringify([...existing.filter(x=>!ids.has(x.id)),...entries],null,2)+'\n');
const portraits=Object.fromEntries(prior.frames.map(x=>[x.id,x.portrait]));
await writeFile(path.join(root,'defense/merge/art-frames.js'),'// Generated from hash-bound anatomical estimates and foot anchors.\nexport const PORTRAIT_FRAMES = '+JSON.stringify(portraits,null,2)+';\n');
console.log('Preserved '+(prior.frames.length-added.length)+' existing atlases; added '+added.length+' reviewed forms.');
