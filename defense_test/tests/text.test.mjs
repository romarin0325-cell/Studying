import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,ARTIFACTS} from '../src/content.js';
import * as E from '../src/combat/engine.js';

test('every enhancement-scaled number in the hero sheet is written in that hero text, in order',()=>{
  for(const h of HEROES){
    const tokens=E.scaledTokens(h.id,1);
    for(const [kind,text] of [['trait',h.trait.text],['skill',h.skill.text]]){
      let pos=0;for(const [from,to] of tokens[kind]){const at=text.indexOf(from,pos);assert.ok(at>=0,`${h.id} ${kind}: ${from}`);assert.equal(to,from,`${h.id} ${kind}: base value matches the text`);pos=at+from.length;}
    }
  }
  assert.equal(E.scaledTokens('snow_rabbit',1.3).trait[0][1],'52%');assert.equal(E.scaledTokens('luna',1.5).trait[0][1],'50%');
});
test('hero texts state behaviour, not the general rules',()=>{
  for(const h of HEROES)for(const text of [h.trait.text,h.skill.text])assert.ok(!/성급이 오를수록|성급·|훈련으로 증가|상한이 없|그대로 적용|함께 적용됩니다|보스는 1초/.test(text),h.id+': '+text);
});
test('every relic scale token is written in that relic text',()=>{
  assert.equal(ARTIFACTS.length,24);
  for(const relic of ARTIFACTS){
    assert.ok(Array.isArray(relic.scale)&&relic.scale.length,relic.id);
    for(const token of relic.scale){
      const text=typeof token==='string'?token:token.t;
      assert.equal(typeof text,'string');assert.ok(relic.text.includes(text),relic.id+' '+text);
      if(token&&token.int)assert.equal(token.int,true);
    }
  }
  assert.equal(ARTIFACTS.find(relic=>relic.id==='tempo_bell').name,'이어지는 종');
  assert.deepEqual(ARTIFACTS.find(relic=>relic.id==='feather').scale,[{t:'3G',int:true},{t:'15G',int:true}]);
});
