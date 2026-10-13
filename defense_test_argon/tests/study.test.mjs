import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {COURSE} from '../src/course.js';
import {conceptQuestion,termQuestion,lectureQuestions,termQuestions,questionOf,pickQuestion,lectureById} from '../src/quiz.js';
import {CONSTELLATIONS,LIBRARY_ART,LIBRARY_STARS,constellationAt} from '../src/library.js';
import {tutorPrompt,tutorHtml} from '../src/tutor.js';
import {assetFile} from '../scripts/local-inputs.mjs';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('course data has the swappable shape: lectures, concept questions tied to lectures, unique terms',()=>{
  assert.ok(COURSE.id&&COURSE.title&&COURSE.subject);
  const ids=[...COURSE.lectures,...COURSE.concepts,...COURSE.terms].map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const l of COURSE.lectures){
    for(const k of ['title','original','summary','analogy','point','oneLine'])assert.ok(l[k],l.id+' '+k);
    assert.equal(lectureQuestions(l.id).length,3,l.id+' has 3 linked lecture questions');
  }
  for(const c of COURSE.concepts){
    assert.ok(lectureById(c.lecture),c.id);
    assert.ok(Number.isInteger(c.answer)&&c.answer>=0&&c.answer<c.choices.length,c.id);
    assert.equal(new Set(c.choices).size,c.choices.length,c.id);
    assert.ok(c.explain,c.id);
  }
  assert.equal(new Set(COURSE.terms.map(t=>t.meaning)).size,COURSE.terms.length);
  for(const t of COURSE.terms){
    const qs=termQuestions(t.id);
    assert.equal(qs.length,2,t.id+' has 2 linked term questions');
    for(const q of qs){
      assert.equal(q.kind,'term');assert.equal(q.termId,t.id);
      assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length,q.id);
      assert.ok(q.explain,q.id);
    }
  }
});

test('term questions offer the meaning among three others in a fixed order per term',()=>{
  for(const t of COURSE.terms){
    const q=termQuestion(t.id);
    assert.equal(q.kind,'term');assert.equal(q.choices.length,Math.min(4,COURSE.terms.length));
    assert.equal(q.choices[q.answer],t.meaning);
    assert.deepEqual(termQuestion(t.id).choices,q.choices,'stable order keeps a stored wrong choice meaningful');
  }
  assert.equal(conceptQuestion('C001').kind,'concept');
  assert.equal(questionOf('term','T001').id,'T001');
  assert.equal(questionOf('concept','missing'),null);
});

test('picking a question avoids the one just shown when another exists',()=>{
  for(let i=0;i<20;i++)assert.notEqual(pickQuestion('concept',Math.random,'C001').id,'C001');
  assert.equal(pickQuestion('term',()=>0).kind,'term');
});

test('seven constellations: rising star counts, valid lines, every star joined, art inside the asset folder',async()=>{
  assert.equal(CONSTELLATIONS.length,7);
  assert.equal(LIBRARY_STARS,CONSTELLATIONS.reduce((n,c)=>n+c.stars.length,0));
  let last=0;
  for(const c of CONSTELLATIONS){
    assert.ok(c.stars.length>=last,c.id);last=c.stars.length;
    for(const [x,y] of c.stars)assert.ok(x>=0&&x<=100&&y>=0&&y<=100,c.id);
    const joined=new Set();
    for(const [a,b] of c.lines){assert.ok(c.stars[a]&&c.stars[b]&&a!==b,c.id);joined.add(a);joined.add(b);}
    assert.equal(joined.size,c.stars.length,c.id+' has a lonely star');
    assert.ok(c.name&&c.title&&c.line,c.id);
    const bytes=await fs.readFile(assetFile(LIBRARY_ART[c.id]));
    assert.ok(bytes.length<150*1024&&bytes.subarray(8,12).toString()==='WEBP',c.id);
  }
  assert.equal(constellationAt(99).id,'moon');
});

test('Rumi prompt carries the question, the pick, the answer and the lecture; the reply renders as safe HTML',()=>{
  const q=conceptQuestion('C002'),prompt=tutorPrompt(q,0);
  assert.match(prompt,/\[문제\]/);assert.match(prompt,new RegExp('형아가 고른 답\\] ① '+q.choices[0].slice(0,6)));
  assert.match(prompt,/\[정답\] ②/);assert.match(prompt,/제2강/);
  assert.doesNotMatch(tutorPrompt(q,q.answer),/형아가 고른 답/);
  const html=tutorHtml('## 핵심 한 줄\n**중요** <script>x</script>\n- 하나\n- 둘\n\n끝',escape);
  assert.equal(html,'<h4>핵심 한 줄</h4><p><b>중요</b> &lt;script&gt;x&lt;/script&gt;</p><ul><li>하나</li><li>둘</li></ul><p>끝</p>');
});

test('wrong picks go to the notebook once (latest pick kept); one star a day; a full constellation unlocks its art',async()=>{
  const {createProfile,command,validateProfile}=await import('../src/profile.js'),{calendar}=await import('../src/economy.js');
  const DAY=86400000,start=Date.UTC(2026,9,13,3),p=createProfile(start),c1=conceptQuestion('C001'),t1=termQuestion('T001');
  assert.deepEqual(command(p,'answer',{kind:'concept',id:'C001',choice:c1.answer},start),{ok:true,correct:true});
  assert.equal(p.study.wrong.length,0);
  command(p,'answer',{kind:'concept',id:'C001',choice:(c1.answer+1)%4},start);command(p,'answer',{kind:'concept',id:'C001',choice:(c1.answer+2)%4},start);
  assert.deepEqual(p.study.wrong.map(w=>[w.id,w.choice]),[['C001',(c1.answer+2)%4]]);
  assert.equal(command(p,'answer',{kind:'concept',id:'C999',choice:0},start).ok,false);
  assert.equal(command(p,'answer',{kind:'term',id:'T001',choice:7},start).ok,false);
  assert.ok(validateProfile(p));
  assert.equal(command(p,'libraryStar',{kind:'term',id:'T001'},start).ok,false,'only notebook questions light a star');
  assert.equal(command(p,'libraryStar',{kind:'concept',id:'C001'},start).ok,true);
  assert.deepEqual([p.study.library.stars,p.study.wrong.length],[1,0]);
  command(p,'answer',{kind:'term',id:'T001',choice:(t1.answer+1)%4},start);
  assert.equal(command(p,'libraryStar',{kind:'term',id:'T001'},start).ok,false,'one star a day');
  const need=CONSTELLATIONS[0].stars.length;let last;
  for(let d=1;d<need;d++){const t=start+d*DAY;command(p,'answer',{kind:'term',id:'T001',choice:(t1.answer+1)%4},t);last=command(p,'libraryStar',{kind:'term',id:'T001'},t);assert.ok(last.ok,String(d));assert.ok(validateProfile(p));}
  assert.equal(last.completed,'boat');
  assert.deepEqual(p.study.library,{index:1,stars:0,unlocked:['boat'],day:calendar(start+(need-1)*DAY).day});
});

test('saves from before the library get an empty one; notebook entries outside the course are dropped',async()=>{
  const {createProfile,parseProfile}=await import('../src/profile.js');
  const old=createProfile(0);delete old.study;
  assert.deepEqual(parseProfile(JSON.stringify(old)).study,{wrong:[],library:{index:0,stars:0,unlocked:[],day:''}});
  const swapped=createProfile(0);swapped.study.wrong=[{kind:'concept',id:'C999',choice:0,at:0},{kind:'concept',id:'C001',choice:1,at:0}];
  assert.deepEqual(parseProfile(JSON.stringify(swapped)).study.wrong.map(w=>w.id),['C001']);
  const broken=createProfile(0);broken.study.library.stars=99;assert.equal(parseProfile(JSON.stringify(broken)),null);
});
