import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const result={},files=[];
for(const [file,symbol,key] of [['vocab_data.js','VOCAB_SOURCE','vocab'],['collocation_data.js','COLLOCATION_DATA','collocation'],['grammar_data.js','GRAMMAR_DATA','grammar']]){
 const code=(await fs.readFile(path.join(root,'../card/game',file),'utf8')).replace(/\r\n/g,'\n');
 result[key]=vm.runInNewContext(code+'\nJSON.parse(JSON.stringify('+symbol+'))',{}, {timeout:5000});
 files.push({file,sha256:createHash('sha256').update(code).digest('hex'),entries:result[key].length});
}
for(const l of result.grammar)for(const q of l.quizzes||[])if(!q.options.includes(q.answer)||!result.grammar.some(x=>x.id===q.lecture_id))throw Error('Invalid Card lecture reference');
await fs.writeFile(path.join(root,'src/data/learning.json'),JSON.stringify(result,(_key,value)=>typeof value==='string'?value.replace(/[ \t]+(?=\n)/g,''):value)+'\n');
await fs.writeFile(path.join(root,'src/data/learning-provenance.json'),JSON.stringify({source:'card/game',sourceCommit:'d914c2a7b48f391f2f66146b5448bdb9727a446c',normalization:'UTF-8 LF; remove trailing spaces before line breaks in copied text',files},null,2)+'\n');
console.log(files);
