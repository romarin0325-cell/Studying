import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY, makeQuestion, recordAnswer } from '../learning.js';
import { createProfile } from '../meta.js';

function variant(entryIndex, quizIndex) {
  const values=[(entryIndex+.5)/LIBRARY.collocation.length,(quizIndex+.5)/4];
  return makeQuestion('collocation',()=>values.shift());
}

test('all 520 attached collocation variants are reachable with their own answers and translations',()=>{
  const ids=new Set();
  assert.equal(LIBRARY.collocation.length,130);
  LIBRARY.collocation.forEach((entry,i)=>{
    assert.equal(entry.quizzes.length,4);
    entry.quizzes.forEach((quiz,j)=>{
      const q=variant(i,j);
      assert.equal(q.id,`collocation:${entry.id}${j?':'+j:''}`);
      assert.equal(q.prompt,quiz.question);assert.deepEqual(q.options,quiz.options);
      assert.notEqual(q.options,quiz.options);assert.equal(q.answer,quiz.answer);
      assert.ok(q.explanation.includes(quiz.translation));assert.ok(q.options.includes(q.answer));
      ids.add(q.id);
    });
  });
  assert.equal(ids.size,520);
  assert.equal(variant(102,3).answer,'breaks');
});

test('legacy representative mistakes survive saves and only the answered variant is cleared',()=>{
  let profile=createProfile();
  const first=variant(102,0),fourth=variant(102,3);
  const wrong=q=>q.options.find(o=>o!==q.answer);
  assert.equal(recordAnswer(profile,first,wrong(first)),false);
  assert.equal(recordAnswer(profile,fourth,wrong(fourth)),false);
  profile=createProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(profile.learning.mistakes.map(q=>q.id),['collocation:103:3','collocation:103']);
  const replay=profile.learning.mistakes[0];
  assert.equal(replay.prompt,fourth.prompt);assert.equal(replay.answer,'breaks');
  assert.equal(recordAnswer(profile,replay,replay.answer),true);
  assert.deepEqual(profile.learning.mistakes.map(q=>q.id),['collocation:103']);
  assert.equal(recordAnswer(profile,first,first.answer),true);
  assert.deepEqual(profile.learning.mistakes,[]);
});

test('legacy entries without nested quizzes still use the representative question',()=>{
  const entry=LIBRARY.collocation[0],quizzes=entry.quizzes;
  try {
    delete entry.quizzes;
    const q=makeQuestion('collocation',()=>0);
    assert.equal(q.id,'collocation:1');assert.equal(q.prompt,entry.question);
    assert.equal(q.answer,entry.answer);
  } finally {entry.quizzes=quizzes;}
});
