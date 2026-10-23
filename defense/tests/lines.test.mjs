import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES} from '../src/content.js';
import {PARTNER_LINES,talkLines,greetLine,CLOSE_BOND} from '../src/lines.js';

test('every companion has its own lobby lines: three taps, a close line from six hearts, two greetings',()=>{
  assert.equal(Object.keys(PARTNER_LINES).length,HEROES.length);
  const all=new Set();
  for(const h of HEROES){
    const l=PARTNER_LINES[h.id];assert.ok(l,h.id);
    assert.equal(l.talk.length,3,h.id);assert.equal(l.greet.length,2,h.id);assert.ok(l.close,h.id);
    for(const line of [...l.talk,l.close,...l.greet]){assert.ok(line.length<=48,`${h.id}: ${line}`);assert.ok(!all.has(line),`duplicate: ${line}`);all.add(line);}
    assert.equal(talkLines(h.id,CLOSE_BOND-1).length,3);assert.deepEqual(talkLines(h.id,CLOSE_BOND),[...l.talk,l.close]);
    assert.ok(l.greet.includes(greetLine(h.id,'2026-10-13')));
  }
  assert.notEqual(greetLine('zeke','2026-10-13'),greetLine('zeke','2026-10-14'),'the greeting alternates by day');
});
