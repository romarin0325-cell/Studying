import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {COURSE} from '../src/course.js';
import {conceptQuestion,termQuestion,questionOf,pickQuestion,lectureById,lectureQuestions,termQuestions,allQuestions} from '../src/quiz.js';
import {CONSTELLATIONS,LIBRARY_ART,LIBRARY_STARS,constellationAt} from '../src/library.js';
import {tutorPrompt,tutorHtml} from '../src/tutor.js';
import {assetFile} from '../scripts/local-inputs.mjs';

const sharp=createRequire(import.meta.url)('sharp');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const firstLecture=COURSE.lectures[0],firstTerm=COURSE.terms[0];

test('course shape: three questions per lecture, two per term, unique ids and valid answers',()=>{
  assert.ok(COURSE.id&&COURSE.title&&COURSE.subject);
  for(const l of COURSE.lectures){
    for(const k of ['title','titleJa','core','analogy','oneLine'])assert.ok(l[k],l.id+' '+k);
    assert.ok(l.body.length>=1,l.id);assert.equal(l.quizzes.length,3,l.id);
  }
  for(const t of COURSE.terms){for(const k of ['termJa','termKo','explain'])assert.ok(t[k],t.id+' '+k);assert.equal(t.quizzes.length,2,t.id);}
  const quizzes=[...COURSE.lectures.flatMap(l=>l.quizzes),...COURSE.terms.flatMap(t=>t.quizzes)],ids=[...COURSE.lectures,...COURSE.terms,...quizzes].map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const q of quizzes){assert.ok(q.prompt&&q.explain,q.id);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,q.id);assert.equal(new Set(q.choices).size,q.choices.length,q.id);}
});

test('questions are served by kind and linked back to their lecture or term',()=>{
  const c=conceptQuestion(firstLecture.quizzes[0].id),t=termQuestion(firstTerm.quizzes[1].id);
  assert.equal(c.kind,'concept');assert.equal(c.lecture,firstLecture.id);assert.equal(t.kind,'term');assert.equal(t.term,firstTerm.id);
  assert.deepEqual(lectureQuestions(firstLecture.id).map(q=>q.id),firstLecture.quizzes.map(q=>q.id));
  assert.deepEqual(termQuestions(firstTerm.id).map(q=>q.id),firstTerm.quizzes.map(q=>q.id));
  assert.equal(allQuestions('concept').length,COURSE.lectures.length*3);assert.equal(allQuestions('term').length,COURSE.terms.length*2);
  assert.equal(questionOf('term',firstLecture.quizzes[0].id),null,'a lecture question is not a term question');
  for(let i=0;i<20;i++)assert.notEqual(pickQuestion('concept',Math.random,c.id).id,c.id);
});

test('seven constellations: rising star counts, valid lines, every star joined, frames shaped like their paintings',async()=>{
  assert.equal(CONSTELLATIONS.length,7);
  assert.equal(LIBRARY_STARS,CONSTELLATIONS.reduce((n,c)=>n+c.stars.length,0));
  let last=0;
  for(const c of CONSTELLATIONS){
    assert.ok(c.stars.length>=last,c.id);last=c.stars.length;
    for(const [x,y] of c.stars)assert.ok(x>=0&&x<=100&&y>=0&&y<=100,c.id);
    const joined=new Set();
    for(const [a,b] of c.lines){assert.ok(c.stars[a]&&c.stars[b]&&a!==b,c.id);joined.add(a);joined.add(b);}
    assert.equal(joined.size,c.stars.length,c.id+' has a lonely star');
    const bytes=await fs.readFile(assetFile(LIBRARY_ART[c.id])),m=await sharp(bytes).metadata();
    assert.ok(bytes.length<150*1024&&m.format==='webp',c.id);
    assert.ok(Math.abs(m.width/m.height-c.ratio)<.01,`${c.id} frame ratio ${c.ratio} vs ${m.width}x${m.height}`);
  }
  assert.equal(constellationAt(99).id,'moon');
});

test('Rumi prompt carries the question, the pick, the answer, the source and the lecture; the reply renders as safe HTML',()=>{
  const q=conceptQuestion(firstLecture.quizzes[0].id),wrong=(q.answer+1)%q.choices.length,prompt=tutorPrompt(q,wrong);
  assert.match(prompt,/\[문제\]/);assert.ok(prompt.includes(`[형아가 고른 답] ${'①②③④'[wrong]}`));assert.ok(prompt.includes(`[정답] ${'①②③④'[q.answer]}`));
  assert.ok(prompt.includes(`제${firstLecture.no}강`));assert.ok(prompt.includes('[출전]'));
  assert.doesNotMatch(tutorPrompt(q,q.answer),/형아가 고른 답/);
  assert.ok(tutorPrompt(termQuestion(firstTerm.quizzes[0].id),0).includes(firstTerm.termKo));
  const html=tutorHtml('## 핵심 한 줄\n**중요** <script>x</script>\n- 하나\n- 둘\n\n끝',escape);
  assert.equal(html,'<h4>핵심 한 줄</h4><p><b>중요</b> &lt;script&gt;x&lt;/script&gt;</p><ul><li>하나</li><li>둘</li></ul><p>끝</p>');
});

test('wrong picks go to the notebook once (latest pick kept), correct ones count as solved; one star a day; a full constellation unlocks its art',async()=>{
  const {createProfile,command,validateProfile}=await import('../src/profile.js'),{calendar}=await import('../src/economy.js');
  const DAY=86400000,start=Date.UTC(2026,9,13,3),p=createProfile(start),c1=conceptQuestion(firstLecture.quizzes[0].id),t1=termQuestion(firstTerm.quizzes[0].id);
  assert.deepEqual(command(p,'answer',{kind:'concept',id:c1.id,choice:c1.answer},start),{ok:true,correct:true});
  assert.deepEqual(p.study.wrong,[]);assert.deepEqual(p.study.solved,[`concept:${c1.id}`]);
  command(p,'answer',{kind:'concept',id:c1.id,choice:(c1.answer+1)%4},start);command(p,'answer',{kind:'concept',id:c1.id,choice:(c1.answer+2)%4},start);
  assert.deepEqual(p.study.wrong.map(w=>[w.id,w.choice]),[[c1.id,(c1.answer+2)%4]]);
  assert.equal(command(p,'answer',{kind:'concept',id:'nope',choice:0},start).ok,false);
  assert.equal(command(p,'answer',{kind:'term',id:t1.id,choice:7},start).ok,false);
  assert.ok(validateProfile(p));
  assert.equal(command(p,'libraryStar',{kind:'term',id:t1.id},start).ok,false,'only notebook questions light a star');
  assert.equal(command(p,'libraryStar',{kind:'concept',id:c1.id},start).ok,true);
  assert.deepEqual([p.study.library.stars,p.study.wrong.length],[1,0]);
  command(p,'answer',{kind:'term',id:t1.id,choice:(t1.answer+1)%4},start);
  assert.equal(command(p,'libraryStar',{kind:'term',id:t1.id},start).ok,false,'one star a day');
  const need=CONSTELLATIONS[0].stars.length;let last;
  for(let d=1;d<need;d++){const t=start+d*DAY;command(p,'answer',{kind:'term',id:t1.id,choice:(t1.answer+1)%4},t);last=command(p,'libraryStar',{kind:'term',id:t1.id},t);assert.ok(last.ok,String(d));assert.ok(validateProfile(p));}
  assert.equal(last.completed,'boat');
  assert.deepEqual(p.study.library,{index:1,stars:0,unlocked:['boat'],day:calendar(start+(need-1)*DAY).day});
});

test('saves from before the library get an empty one; notebook entries outside the course are dropped',async()=>{
  const {createProfile,parseProfile}=await import('../src/profile.js');
  const old=createProfile(0);delete old.study;
  assert.deepEqual(parseProfile(JSON.stringify(old)).study,{wrong:[],solved:[],library:{index:0,stars:0,unlocked:[],day:''}});
  const keep=firstLecture.quizzes[0].id,swapped=createProfile(0);swapped.study.wrong=[{kind:'concept',id:'C001',choice:0,at:0},{kind:'concept',id:keep,choice:1,at:0}];delete swapped.study.solved;
  const parsed=parseProfile(JSON.stringify(swapped));assert.deepEqual(parsed.study.wrong.map(w=>w.id),[keep]);assert.deepEqual(parsed.study.solved,[]);
  const broken=createProfile(0);broken.study.library.stars=99;assert.equal(parseProfile(JSON.stringify(broken)),null);
});
