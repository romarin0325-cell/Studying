import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,gameRoot,sharp} from './runtime.mjs';
import {json,ref} from './core.mjs';
import {HEROES,ASSET_PATHS} from '../../../src/content.js';
export async function prepareBrief({id,original,design,equipment,frame,peers,out}){
 const h=HEROES.find(h=>h.id===id);assert.ok(h,'Unknown current hero '+id);
 assert.match(frame,/^(feminine|neutral|masculine)-(short|medium|tall)$/,'Choose the body frame after inspecting the original, not its accessory bounds');
 assert.ok(peers.length>=3,'At least three explicitly chosen comparison peers');
 const directory=path.dirname(path.resolve(out));await mkdir(directory,{recursive:true});const refs=path.join(directory,'references');await mkdir(refs,{recursive:true});
 const master=path.join(gameRoot,'docs/art/sol-cast-v2/structure-masters',frame+'.png'),style=path.join(gameRoot,'docs/art/sol-cast-v2/structure-masters/style-siren.webp'),baseline=path.resolve(gameRoot,ASSET_PATHS[h.art.atlas]);
 const frozen=JSON.parse(await readFile(path.join(gameRoot,'docs/art/sd-pipeline/style-reference.json'),'utf8'));assert.equal((await ref(style)).sha256,frozen.sha256,'Frozen style changed; review its probes and references deliberately');
 const visible=path.join(refs,'structure-visible.png'),front=path.join(refs,'frozen-style-front.png'),face=path.join(refs,'previous-face.png');
 await sharp(master).flatten({background:'#efe6d4'}).png().toFile(visible);await sharp(style).extract({left:0,top:0,width:512,height:512}).flatten({background:'#efe6d4'}).png().toFile(front);await sharp(baseline).extract({left:128,top:112,width:256,height:256}).flatten({background:'#efe6d4'}).png().toFile(face);
 const identityNotes=await readFile(design,'utf8'),equipmentNotes=await readFile(equipment,'utf8');assert.ok(identityNotes.trim().length>30&&equipmentNotes.trim().length>20,'Write observed design/expression and anatomical equipment notes before creating a run');
 const brief={id,name:h.name,heightClass:frame.split('-')[1],bodyFrame:frame,original:path.resolve(original),style,structure:master,baseline,identityNotes,equipmentNotes,portraitSize:250,styleSamples:frozen.styleSamples,peers:peers.map(id=>{const p=HEROES.find(h=>h.id===id);assert.ok(p,'Unknown peer '+id);return{id,name:p.name,file:path.resolve(gameRoot,ASSET_PATHS[p.art.atlas])};}),generationReferences:[{role:'frozen FRONT-only rendering style; not a profile-size template',file:front},{role:'complete actual compact body/head structure on a pale background',file:visible},{role:'ORIGINAL design and costume, not adult proportions',file:path.resolve(original)},{role:'old FRONT-face identity only, never a body-size template',file:face}],sourceDerivatives:{structure:{...await ref(master),operation:'Whole guide flatten on pale background; geometry unchanged'},style:{...await ref(style),operation:'Unscaled top-left512px crop then pale flatten'},identity:{...await ref(baseline),operation:'Fixed128,112,256,256 face crop then pale flatten'}},extraPrompt:'Image1 controls style, Image2 structure, Image3 original design, Image4 previous face identity. These input derivatives are not independent anatomical proof. Preserve tiny individual expression and quiet idle; do not clone a blank mannequin face.'};
 await writeFile(path.resolve(out),json(brief),{flag:'wx'});return brief;
}
async function main(){const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){assert.ok(args[i].startsWith('--')&&args[i+1],'Use --id --original --design --equipment --frame --peers --out');options[args[i].slice(2)]=args[i+1];}for(const k of ['id','original','design','equipment','frame','peers','out'])assert.ok(options[k],'Missing --'+k);options.peers=options.peers.split(',');const b=await prepareBrief(options);console.log(json({brief:path.resolve(options.out),id:b.id,frame:b.bodyFrame,inputApproval:'not performed; run create then actual A inspection',imageGenerationCalls:0}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main().catch(e=>{console.error(e.message);process.exitCode=1;});
