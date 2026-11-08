import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {here} from './runtime.mjs';
const explicit=process.env.DEFENSE_ART_SETUP_PYTHON,command=explicit||(process.platform==='win32'?'py':'python3');
const args=[...(!explicit&&process.platform==='win32'?['-3.12']:[]),path.join(here,'setup-audit.py'),...process.argv.slice(2)];
const r=spawnSync(command,args,{stdio:'inherit',windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}});
if(r.error)console.error('Python3.12 is required. Install it or set DEFENSE_ART_SETUP_PYTHON. '+r.error.message);
process.exitCode=r.status??1;
