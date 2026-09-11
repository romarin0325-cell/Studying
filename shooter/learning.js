import { LEARNING_DATA } from './learning/data.js';
export const LIBRARY = LEARNING_DATA;
export function makeQuestion(kind, random = Math.random) {
  const pick = arr => arr[Math.min(arr.length-1,Math.floor(random()*arr.length))];
  if(kind === 'grammar') {
    const candidates = LIBRARY.grammar.flatMap(l=>(l.quizzes||[]).map((q,i)=>({...q,id:`grammar:${l.id}:${i}`,lecture:LIBRARY.grammar.find(t=>t.id===q.lecture_id) || l})));
    const q=pick(candidates); return {...q,kind,prompt:q.question,explanation:q.desc || q.lecture.title};
  }
  if(kind === 'collocation') {
    const entry=pick(LIBRARY.collocation);
    return {id:`collocation:${entry.id}`,kind,prompt:entry.question,options:[...entry.options],answer:entry.answer,explanation:`${entry.expression} — ${entry.meaning}\n${entry.translation || ''}`};
  }
  const index=Math.floor(random()*LIBRARY.vocab.length),entry=LIBRARY.vocab[index];
  const wrong=[...new Set([entry.tm,...LIBRARY.vocab.map(v=>v.m)].filter(m=>m&&m!==entry.m))];
  const options=[entry.m]; for(let i=0;i<3&&wrong.length;i++) options.push(wrong.splice(Math.floor(random()*wrong.length),1)[0]);
  // Fisher-Yates preserves equal option-position probability.
  for(let i=options.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
  return {id:`vocab:${index}`,kind:'vocab',prompt:entry.w,options,answer:entry.m,explanation:`${entry.w} — ${entry.m}${entry.tw ? `\n혼동 주의: ${entry.tw} — ${entry.tm}`:''}`};
}
export function recordAnswer(profile, question, answer) {
  const l=profile.learning;
  l.total=(Number(l.total)||0)+1; const correct=answer===question.answer; l.correct=(Number(l.correct)||0)+(correct?1:0);
  l.mistakes=Array.isArray(l.mistakes)?l.mistakes:[];
  l.mistakes=l.mistakes.filter(q=>q.id!==question.id);
  if(!correct) l.mistakes.unshift({id:question.id,kind:question.kind,prompt:question.prompt,options:question.options,answer:question.answer,explanation:question.explanation,lectureId:question.lecture?.id});
  l.mistakes=l.mistakes.slice(0,200); return correct;
}
