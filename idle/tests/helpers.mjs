import {newState} from '../src/core/state.js';import {reduce} from '../src/core/commands.js';
export const NOW=Date.UTC(2026,0,1,0);
export function harness(seed=23){let s=newState(NOW,seed),i=0;return {get s(){return s},set s(v){s=v},act(type,data={},now=NOW){const result=reduce(s,{id:'test-'+i++,type,expectedRevision:s.revision,...data},{now});s=result.state;return result.result;}};}
