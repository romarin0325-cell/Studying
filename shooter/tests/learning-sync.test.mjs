import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),script=fileURLToPath(new URL('sync-learning.mjs',root));
test('learning provenance verifies LF and CRLF equally and detects changed source',async()=>{
  const dir=new URL('artifacts/learning-eol/',root);await fs.mkdir(dir,{recursive:true});
  const files=['vocab_data.js','collocation_data.js','grammar_data.js'];
  for(const eol of ['\n','\r\n']){
    for(const f of files){const text=await fs.readFile(new URL(`../card/game/${f}`,root),'utf8');await fs.writeFile(new URL(f,dir),text.replace(/\r\n/g,'\n').replace(/\n/g,eol));}
    assert.doesNotThrow(()=>execFileSync(process.execPath,[script,fileURLToPath(dir),'--check'],{stdio:'pipe'}));
  }
  await fs.appendFile(new URL(files[0],dir),'\n// altered source\n');
  assert.throws(()=>execFileSync(process.execPath,[script,fileURLToPath(dir),'--check'],{stdio:'pipe'}),/out of sync/);
});
