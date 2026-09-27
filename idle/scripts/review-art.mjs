import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..'),m=JSON.parse(await fs.readFile(path.join(root,'assets/manifest.json'),'utf8')),assets=Object.fromEntries(m.assets.map(x=>[x.id,x]));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
async function sheet(ids,name,cols=3,w=300,h=520){const height=Math.ceil(ids.length/cols)*h,composite=[];for(let i=0;i<ids.length;i++){const a=assets[ids[i]],left=(i%cols)*w,top=Math.floor(i/cols)*h;composite.push({input:await sharp(path.join(root,a.path)).resize(w-20,h-54,{fit:'contain',background:'#f2ede3'}).png().toBuffer(),left:left+10,top:top+8});composite.push({input:Buffer.from('<svg width="'+w+'" height="40"><text x="12" y="19" font-family="sans-serif" font-size="13" fill="#24313c">'+esc(a.id)+'</text><text x="12" y="35" font-family="sans-serif" font-size="11" fill="#64717a">'+a.width+' x '+a.height+' / full composition</text></svg>'),left,top:top+h-42});}await sharp({create:{width:cols*w,height,channels:3,background:'#f2ede3'}}).composite(composite).jpeg({quality:88}).toFile(path.join(root,'docs/review/'+name+'.jpg'));}
for(const id of ['zeke','lumi','queen','jasmine','luna'])await sheet([id,'archive_'+id+'_01','bond_'+id+'_01'],'comparison-'+id);
await sheet(m.assets.filter(a=>a.id.startsWith('archive_')||a.id.startsWith('bond_')||a.id.startsWith('s01_')).map(a=>a.id),'memory-contact-sheet',4,260,426);
await sheet(m.assets.filter(a=>!a.id.startsWith('archive_')&&!a.id.startsWith('bond_')&&!a.id.startsWith('s01_')).map(a=>a.id),'original-contact-sheet',6,180,306);
console.log('Five original/archive/bond comparisons and two complete contact sheets; source files untouched.');
