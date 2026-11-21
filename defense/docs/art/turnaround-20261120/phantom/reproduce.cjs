'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const child = require('node:child_process');
const base = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const input = __dirname;
const sharp = require(path.join(path.resolve(base, '..', '..', '..', '..'), 'node_modules', 'sharp'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = hash(base);
if (source !== '35ac0caf9359d6244cbd6d1b9a39aff4a5da090be6bb55d9f78d495e4aaae4dc') throw Error('Baseline PNG mismatch: '+source);
if (fs.existsSync(out)) throw Error('Use an unused reproduction output directory: '+out);
fs.mkdirSync(out,{recursive:true});
function trial(name,opt) {
 child.execFileSync(process.execPath,[path.join(input,'register-hair.cjs'),base,name,...opt.map(String)],{env:{...process.env,PHANTOM_TRIAL_DIR:out},stdio:'inherit'});
}
function check(label,a,b){const h=hash(a);if(h!==b)throw Error(label+' SHA-256 mismatch: '+h+' vs '+b);return h;}
async function bustSheet(source,name){
 const tiles=[];
 for(let side=0;side<2;side++){
  const tile=await sharp(source).extract({left:122+512*side,top:597,width:260,height:300}).resize(468,540).png().toBuffer();
  tiles.push({input:tile,left:22+512*side,top:246});
 }
 await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(tiles).png().toFile(path.join(out,name));
}
async function main(){
 const claims=JSON.parse(fs.readFileSync(path.join(input,'verification.json'),'utf8'));
 const treatmentJob=JSON.parse(fs.readFileSync(path.join(input,'treatment-job.json'),'utf8'));
 const history={baseline:source};
 for(const file of ['mask.png','imagegen-native.png','treatment-native.png'])fs.copyFileSync(path.join(input,file),path.join(out,file),fs.constants.COPYFILE_EXCL);
 history.firstNative=check('First native tool receipt',path.join(out,'imagegen-native.png'),claims.process.nativeFirst);
 history.lastNative=check('Second native tool receipt',path.join(out,'treatment-native.png'),claims.process.nativeSecond);
 history.allowedMask=hash(path.join(out,'mask.png'));
 trial('B',[8,235,0,3,193]);
 await bustSheet(path.join(out,'registration-studies','B.png'),'turn-heads-treatment-base.png');
 await bustSheet(base,'turn-heads-flow-reference.png');
 history.secondJobInputs=treatmentJob.refs.map(q=>check('Actual second-job reference',path.join(out,path.basename(q.file)),q.sha256));
 const normal=await sharp(path.join(out,'treatment-native.png')).resize(1024,1024).png().toBuffer();
 const tiles=[];
 for(let side=0;side<2;side++){
  const tile=await sharp(normal).extract({left:22+512*side,top:246,width:468,height:540}).resize(260,300).png().toBuffer();
  tiles.push({input:tile,left:122+side*512,top:597});
 }
 await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(tiles).png().toFile(path.join(out,'treatment-registered.png'));
 trial('T5',[0,237,0,8,198,21]);
 const recreated=path.join(out,'registration-studies','T5.png');
 history.final=check('Final registered file',recreated,'9eae3bf6da53b86d96ccd4e98a1a75a2c428e388e0f3b26d5925c5fffc89a9dd');
 fs.copyFileSync(recreated,path.join(out,'candidate.png'),fs.constants.COPYFILE_EXCL);
 const a=await sharp(base).ensureAlpha().raw().toBuffer(),b=await sharp(recreated).ensureAlpha().raw().toBuffer();
 const changed=Buffer.alloc(1024*1024),mask=await sharp(path.join(out,'mask.png')).greyscale().raw().toBuffer();
 let count=0,outside=0;
 for(let i=0;i<changed.length;i++){const k=i*4;if(!a.subarray(k,k+4).equals(b.subarray(k,k+4))){changed[i]=255;count++;if(!mask[i])outside++;}}
 await sharp(changed,{raw:{width:1024,height:1024,channels:1}}).png().toFile(path.join(out,'actual-changed-mask.png'));
 if(outside || count!==32676)throw Error('Pixel proof failed.');
 history.finalChanged=count;history.outsidePermission=outside;history.absoluteDifferences=hash(path.join(out,'actual-changed-mask.png'));history.generator='The two native generated images are supplied as historical stochastic inputs; no call or new paint is made in this replay.';
 fs.writeFileSync(path.join(out,'reproduction.json'),JSON.stringify(history,null,2)+'\n');
 console.log(JSON.stringify(history));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
