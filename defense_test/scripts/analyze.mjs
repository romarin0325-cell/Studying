import fs from 'node:fs/promises';
import path from 'node:path';
import {balanceSnapshot} from './report-data.mjs';
import {gameRoot as game} from './local-inputs.mjs';
const snapshot=balanceSnapshot();
await fs.mkdir(path.join(game,'docs'),{recursive:true});
await fs.writeFile(path.join(game,'docs/BALANCE_SNAPSHOT.json'),JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({probability:snapshot.probability,enhancement:snapshot.enhancement.filter(r=>[0,1,2,5,10,15,20].includes(r.current)),levels:snapshot.levels,relics:snapshot.relics,stages:snapshot.stages,starter:snapshot.starter},null,2));
