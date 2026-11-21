import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {composeCandidate} from '../../../../scripts/art/sd-pipeline/artifacts.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const proof=JSON.parse(await fs.readFile(path.join(dir,'pixel-proof.json'),'utf8'));
const output=await composeCandidate({
  baseFile:path.resolve(dir,'../../../../assets/cast-selected-20261109/time_magician.png'),
  maskFile:path.join(dir,'feather-mask.png'),
  protectedRects:[[0,0,1024,512],[0,512,512,512],[512,721,512,303]],allowIsotropicCanvasResample:true
},path.join(dir,'native.png'));
const digest=createHash('sha256').update(output.png).digest('hex');
assert.equal(digest,proof.candidateSha256);
if(process.argv[2])await fs.writeFile(path.resolve(process.argv[2]),output.png,{flag:'wx'});
console.log(digest);
