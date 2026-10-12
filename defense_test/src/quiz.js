// Quiz helpers over the course data (course.js). A question is {kind, id, prompt, choices[], answer, explain, lecture?}.
// Concept questions are authored; term questions are built from the term list (the meaning plus three other meanings).
import {COURSE} from './course.js';

const shuffled=(list,rand)=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const lectureById=id=>COURSE.lectures.find(l=>l.id===id)||null;
export const termById=id=>COURSE.terms.find(t=>t.id===id)||null;
export function conceptQuestion(id){const c=COURSE.concepts.find(q=>q.id===id);return c?{kind:'concept',...c}:null;}
// Term question: "「original」의 뜻은?" with the term's meaning among others. The choice order is seeded by the id,
// so the same term always shows the same order (a stored wrong choice index stays meaningful).
export function termQuestion(id){
  const t=termById(id);if(!t)return null;
  let seed=[...id].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,7)||1;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  const others=shuffled(COURSE.terms.filter(o=>o.id!==id),rand).slice(0,3).map(o=>o.meaning);
  const choices=shuffled([t.meaning,...others],rand);
  return {kind:'term',id,prompt:`「${t.original}」(${t.term})의 뜻으로 알맞은 것은?`,choices,answer:choices.indexOf(t.meaning),explain:t.explain};
}
export const questionOf=(kind,id)=>kind==='term'?termQuestion(id):conceptQuestion(id);
// Picks a question of a kind, avoiding the last one shown when possible.
export function pickQuestion(kind,rand=Math.random,avoid=null){
  const pool=(kind==='term'?COURSE.terms:COURSE.concepts).map(q=>q.id),choices=pool.length>1?pool.filter(id=>id!==avoid):pool;
  return choices.length?questionOf(kind,choices[Math.floor(rand()*choices.length)]):null;
}
export const KIND_NAME={concept:'개념',term:'용어'};
