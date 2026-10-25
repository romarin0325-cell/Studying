// Re-break memorial stories into reading paragraphs (pass 18). The words never change: the script refuses any layout whose
// text, with all whitespace collapsed, differs from the current story. It rewrites only the paragraph arrays in
// src/memorial.js, the body hashes in the media catalogs and prints the old paragraph counts (for save migration).
// Usage: node defense/scripts/art/reflow-memorials.mjs <layout.mjs exporting LAYOUT={id:[paragraphs]}>
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {MEMORIAL_STORIES} from '../../src/memorial.js';
import {gameRoot} from '../local-inputs.mjs';
const {LAYOUT}=await import(pathToFileURL(path.resolve(process.argv[2])).href);
const norm=list=>list.join(' ').replace(/\s+/g,' ').trim(),hash=list=>createHash('sha256').update(list.join('\n')).digest('hex');
const storyFile=path.join(gameRoot,'src/memorial.js');let story=await fs.readFile(storyFile,'utf8');
const media={};for(const f of ['src/memorial-media.js','src/new-memorial-media.js'])media[f]=await fs.readFile(path.join(gameRoot,f),'utf8');
const legacy={};
for(const [id,next] of Object.entries(LAYOUT)){
  const old=MEMORIAL_STORIES[id]?.paragraphs;if(!old)throw Error('Unknown story '+id);
  if(norm(old)!==norm(next))throw Error(id+': words changed\n'+norm(old)+'\n'+norm(next));
  if(next.some(p=>!p.trim()||p!==p.trim()))throw Error(id+': empty or untrimmed paragraph');
  legacy[id]=old.length;
  const at=story.indexOf(`"${id}": {`);if(at<0)throw Error('No story block '+id);
  const open=story.indexOf('[',story.indexOf('"paragraphs"',at)),close=story.indexOf(']',open);
  // Keep the block's own indentation (the first paragraph line's leading spaces).
  const firstLine=story.slice(open+1).match(/\r?\n( +)/),indent=firstLine?firstLine[1]:'    ',nl=story.includes('\r\n')?'\r\n':'\n';
  const tail=story.slice(close-20,close).match(/\r?\n( *)$/)?.[1]??'';
  story=story.slice(0,open+1)+nl+next.map(p=>indent+JSON.stringify(p)).join(','+nl)+nl+tail+story.slice(close);
  const before=hash(old),after=hash(next);let found=false;
  for(const f of Object.keys(media))if(media[f].includes(before)){media[f]=media[f].replace(before,after);found=true;}
  if(!found)throw Error(id+': body hash not found in media catalogs');
}
await fs.writeFile(storyFile,story);
for(const [f,text] of Object.entries(media))await fs.writeFile(path.join(gameRoot,f),text);
console.log(JSON.stringify({changed:Object.keys(LAYOUT).length,legacy}));
