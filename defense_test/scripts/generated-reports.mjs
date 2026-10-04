import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {balanceSnapshot,assetProvenance} from './report-data.mjs';
import {gameRoot} from './local-inputs.mjs';

export async function renderReports(){
  return new Map([
    ['BALANCE_SNAPSHOT.json',JSON.stringify(balanceSnapshot(),null,2)+'\n'],
    ['ASSET_PROVENANCE.json',JSON.stringify(await assetProvenance(),null,2)+'\n']
  ]);
}

// Read-only comparison: a build must never overwrite evidence before checking it.
export async function checkGeneratedReports(directory=path.join(gameRoot,'docs')){
  const expected=await renderReports(),different=[];
  for(const [name,content] of expected){
    let actual;
    try{actual=await fs.readFile(path.join(directory,name),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
    if(actual?.replace(/\r\n/g,'\n')!==content)different.push(name);
  }
  if(different.length)throw new Error('Generated reports differ from current local inputs: '+different.join(', ')+'. Run node defense_test/scripts/generated-reports.mjs and commit the regenerated JSON.');
}

export async function writeGeneratedReports(directory=path.join(gameRoot,'docs')){
  const reports=await renderReports();await fs.mkdir(directory,{recursive:true});
  for(const [name,content] of reports)await fs.writeFile(path.join(directory,name),content);
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2);
  if(args.length===0){await writeGeneratedReports();console.log('Regenerated BALANCE_SNAPSHOT.json and ASSET_PROVENANCE.json from local Star Garden inputs.');}
  else if(args.length===1&&args[0]==='--check'){await checkGeneratedReports();console.log('PASS: both generated reports match current local Star Garden inputs (read-only).');}
  else throw new Error('Usage: node defense_test/scripts/generated-reports.mjs [--check]');
}
