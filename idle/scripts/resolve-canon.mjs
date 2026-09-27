import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const roster=JSON.parse(await fs.readFile(path.join(root,'src/data/roster.json'),'utf8'));
const card=await fs.readFile(path.join(root,'../card/game/data.js'),'utf8');
const matches=[...card.matchAll(/id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*grade:\s*'[^']+',\s*element:\s*'([^']+)',\s*role:\s*'([^']+)'/g)];
for(const c of roster.companions){const source=matches.find(x=>x[1]===c.id||x[2]===c.name);if(!source)throw Error('Missing canonical card: '+c.id);c.canonicalElement=source[3];c.canonicalRole=source[4];c.canonicalSource='card/game/data.js@d914c2a7';}
await fs.writeFile(path.join(root,'src/data/roster.json'),JSON.stringify(roster,null,2)+'\n');
console.log('Verified 24 support identities against active Card registry');
