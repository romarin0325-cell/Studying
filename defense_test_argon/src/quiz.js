// Quiz helpers over the course data (course.js). A question is {kind, id, prompt, choices[], answer, explain, lecture?, termId?}.
// Each lecture has 3 linked concept questions; each term has 2 linked term questions (meaning + past-exam application).
import {COURSE} from './course.js';

const shuffled=(list,rand)=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const lectureById=id=>COURSE.lectures.find(l=>l.id===id)||null;
export const baseTermId=id=>String(id||'').replace(/-2$/,'');
export const termById=id=>COURSE.terms.find(t=>t.id===baseTermId(id))||null;
export function conceptQuestion(id){const c=COURSE.concepts.find(q=>q.id===id);return c?{kind:'concept',...c}:null;}
// Term question 1 (id="T001"): "「original」의 뜻은?" with the term's meaning among others in a seeded fixed order.
// Term question 2 (id="T001-2"): the linked past-exam application question for that term.
export function termQuestion(id){
  const raw=String(id||''),isExam=raw.endsWith('-2'),t=termById(raw);if(!t)return null;
  if(isExam){
    if(!t.exam)return null;
    return {kind:'term',id:raw,termId:t.id,prompt:t.exam.prompt,choices:t.exam.choices,answer:t.exam.answer,explain:t.exam.explain};
  }
  let seed=[...t.id].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,7)||1;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  const others=shuffled(COURSE.terms.filter(o=>o.id!==t.id),rand).slice(0,3).map(o=>o.meaning);
  const choices=shuffled([t.meaning,...others],rand);
  return {kind:'term',id:t.id,termId:t.id,prompt:`「${t.original}」(${t.term})의 뜻으로 알맞은 것은?`,choices,answer:choices.indexOf(t.meaning),explain:t.explain};
}
export const lectureQuestions=lectureId=>COURSE.concepts.filter(c=>c.lecture===lectureId).map(c=>conceptQuestion(c.id));
export const termQuestions=termId=>{const t=termById(termId);if(!t)return [];return [termQuestion(t.id),t.exam?termQuestion(`${t.id}-2`):null].filter(Boolean);};
export const termQuestionIds=()=>COURSE.terms.flatMap(t=>t.exam?[t.id,`${t.id}-2`]:[t.id]);
export const questionOf=(kind,id)=>kind==='term'?termQuestion(id):conceptQuestion(id);
// Picks a question of a kind, avoiding the last one shown when possible.
export function pickQuestion(kind,rand=Math.random,avoid=null){
  const pool=kind==='term'?termQuestionIds():COURSE.concepts.map(q=>q.id),choices=pool.length>1?pool.filter(id=>id!==avoid):pool;
  return choices.length?questionOf(kind,choices[Math.floor(rand()*choices.length)]):null;
}
export const KIND_NAME={concept:'개념',term:'용어'};
