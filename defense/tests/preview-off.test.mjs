import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,command} from '../src/profile.js';

const NOW=Date.parse('2026-10-04T03:00:00Z');
const REFUSED='사용할 수 없는 동작입니다.';
const party={left:{deck:['star_boy','snow_rabbit','night_rabbit','siren','great_detective'],relics:[]},right:{deck:['silver_rabbit','mushroom_king','underdog','joker','sunflower'],relics:[]}};

test('preview commands stay closed when the preview flag is absent',()=>{
  const p=createProfile(NOW);
  assert.equal(p.oath,undefined);assert.equal(p.twin,undefined);assert.equal(p.requests,undefined);
  for(const [action,args] of [
    ['begin',{mode:'oath',tier:'easy',oaths:[]}],
    ['begin',{mode:'twin',tier:'easy',side:'left'}],
    ['twinParty',party],
    ['requestArrive',{}],
    ['requestSeen',{id:'night_rabbit-1'}],
    ['requestDecline',{id:'night_rabbit-1'}],
    ['requestThank',{id:'night_rabbit-1'}],
    ['requestAfterRead',{hero:'night_rabbit'}],
  ]){
    const r=command(p,action,args,NOW);
    assert.deepEqual(r,{ok:false,message:REFUSED});
  }
  assert.equal(p.active,null);assert.equal(p.oath,undefined);assert.equal(p.twin,undefined);assert.equal(p.requests,undefined);
  assert.equal(command(p,'begin',{mode:'nope'},NOW).message,'원정 종류를 확인하세요.');
  assert.equal(command(p,'begin',{mode:'main'},NOW).ok,true);
  assert.equal(p.active.mode,'main');
});
