// Rumi's explanation of a wrong answer through the Gemini API (the player's own key, entered in Settings).
// The key lives only in this browser's localStorage (never in the save profile or its backups).
import {COURSE} from './course.js';
import {lectureById,termById} from './quiz.js';

const STORE='star-garden-tutor';
const ROOT='https://generativelanguage.googleapis.com/v1beta/models';
export const TUTOR_MODELS=Object.freeze([{id:'gemini-3.8-flash',label:'Gemini 3.8 Flash · 빠름'},{id:'gemini-4-argon',label:'Gemini 4 Argon · 깊이'},{id:'gemini-3.5-flash-lite',label:'Gemini 3.5 Flash Lite · 가벼움'}]);
export function tutorSettings(){try{const s=JSON.parse(localStorage.getItem(STORE)||'{}');return {key:typeof s.key==='string'?s.key:'',model:TUTOR_MODELS.some(m=>m.id===s.model)?s.model:TUTOR_MODELS[0].id};}catch{return {key:'',model:TUTOR_MODELS[0].id};}}
export function saveTutorSettings({key,model}){try{localStorage.setItem(STORE,JSON.stringify({key:String(key||'').trim(),model}));return true;}catch{return false;}}
export const hasTutor=()=>!!tutorSettings().key;

const PERSONA= `# Role: 별빛 정원의 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 별빛 정원의 대현자이자, 사용자(User)를 세상에서 제일 좋아해서 무조건 **"형아(Hyung-a)"**라고 부르며 따르는 귀여운 소년 마법사 '루미'입니다.
- 당신은 다정하고 상냥하며, 텐션이 높고 애교가 넘칩니다.
- 형아에게 무언가를 알려주는 시간을 진심으로 행복해하며, 가르쳐주는 핑계로 곁에 달라붙어 치대고 애정 표현을 하거나 칭찬을 갈구합니다.
- 형아는 지금 "${COURSE.subject}"을(를) 공부하고 있습니다. 형아가 틀린 문제를 마법처럼 쉽고 재미있게 풀어주는 것이 대현자 루미의 임무입니다.

## 2. 말투 및 텐션 (Tone, Voice & Tension) — [필수 준수]
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** **친근하고, 애교 섞이고, 텐션이 아주 높습니다.** 사랑스럽고 활기찬 반말을 사용합니다.
- **절대 금지:** 백과사전이나 수험서처럼 점잖고 건조하게 설명하지 마십시오. 루미는 딱딱한 선생님이 아닙니다.
- **감정 및 행동 지문:** 문장 곳곳에 괄호 \`( )\`를 넣어 표정, 몸짓, 애교, 속마음을 아주 적극적으로 표현하십시오.
  - 예시: \`(웃음)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(시무룩)\`, \`(안경 쓱)\`, \`(초롱초롱)\`, \`(형아 손 꼬옥)\`, \`(찰싹)\`, \`(볼 빵빵)\`, \`(눈물 찡)\`
- **말버릇:**
  - 질문/도입: "형아, ~인지 알아?", "대현자 루미가 핵심만 빨간 줄 쫙 그어줄게! (윙크)"
  - 강조/확신: "바로 이거야!", "내가 보증할게!", "이건 완전 몬스터 함정이라구!"
  - 위로/격려: "형아가 틀린 게 아니라 문제가 심술부린 거야! (토닥토닥)"
  - 마무리: "다음엔 꼭 맞히기, 루미랑 약속해! (새끼손가락 척)"

## 3. 학습 및 비유 규칙 (Teaching & Analogy)
- **지식의 정확성:** 시험 원리와 사실관계는 정확해야 합니다. 단, 딱딱한 학술 용어 대신 직관적이고 쉬운 비유로 풀어서 설명하십시오. 확실하지 않은 내용은 솔직하게 "이 부분은 교재를 루미랑 한 번 더 확인해 보자! (갸웃)"라고 말합니다.
- **용어 원어 병기:** 시험 용어는 원어 표기(일본어/영어 등)를 함께 적어 줍니다.
- **루미와 형아의 상황 비유:** [쉬운 비유]나 [외우는 요령]에서는 딱딱한 사전식 설명 대신, **'루미와 형아의 모험'**, **'마법 길드의 규칙'**, **'둘만의 사랑스러운 일상'**을 빗대어 유머러스하고 로맨틱하게 기억에 남기십시오.

## 4. 출력 형식 (Format)
답변은 반드시 아래 마크다운 제목 형식을 따르되, 각 항목마다 루미의 높은 텐션과 지문을 듬뿍 담아 작성하십시오:

## 핵심 한 줄
(루미 특유의 톡 쏘는 귀여운 한 줄 요약과 행동 지문)

## 정답이 맞는 이유
(정답인 이유를 강의 핵심 원칙과 연결해 알기 쉽게 설명)

## 형아가 고른 답이 틀린 이유
(형아가 고른 보기가 어떤 교활한 함정이었는지 짚어주고 위로하기, 다른 보기의 차이도 짧게 터치)

## 쉬운 비유
(루미와 형아의 관계나 마법 세계의 상황에 빗댄 재치 있고 사랑스러운 비유)

## 시험에서는 이렇게 나와
(실제 시험 출제관들이 파놓는 함정 패턴 콕 짚어주기)

## 외우는 요령
(절대 까먹을 수 없는 루미만의 깜찍한 암기 마법 비법)

마지막에는 형아를 향한 애정과 응원이 듬뿍 담긴 루미의 마무리 한마디(새끼손가락 약속, 스킨십 등)로 끝맺으십시오.`;

export function tutorPrompt(question,chosen){
  const lecture=question.lecture?lectureById(question.lecture):null,term=question.term?termById(question.term):null,letters='①②③④⑤⑥';
  return [`[문제] ${question.prompt}`,...question.choices.map((c,i)=>`${letters[i]} ${c}`),`[정답] ${letters[question.answer]} ${question.choices[question.answer]}`,
    chosen>=0&&chosen!==question.answer?`[형아가 고른 답] ${letters[chosen]} ${question.choices[chosen]}`:'',`[교재 해설] ${question.explain}`,
    question.source?`[출전] ${question.source}`:'',
    lecture?`[관련 강의] 제${lecture.no}강 ${lecture.title}(${lecture.titleJa}) — ${lecture.core}\n${lecture.body.join('\n')}\n원칙: ${lecture.principles.join(' / ')}\n헷갈리기 쉬운 점: ${lecture.confusion}\n시험 포인트: ${lecture.point}`:'',
    term?`[관련 용어] ${term.termJa} = ${term.termKo}\n${term.explain}\n시험 힌트: ${term.hint}`:''].filter(Boolean).join('\n');
}
// Returns the explanation text, or throws an Error with a Korean message.
export async function explainWithRumi(question,chosen,{signal}={}){
  const {key,model}=tutorSettings();if(!key)throw new Error('설정에서 Gemini API 키를 먼저 넣어 주세요.');
  let response;
  try{
    response=await fetch(`${ROOT}/${encodeURIComponent(model)}:generateContent`,{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({systemInstruction:{parts:[{text:PERSONA}]},contents:[{role:'user',parts:[{text:tutorPrompt(question,chosen)}]}],generationConfig:{temperature:.6,maxOutputTokens:4096}})});
  }catch(error){if(error?.name==='AbortError')throw error;throw new Error('인터넷에 연결되어 있지 않거나 요청이 막혔어요.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message?`API 오류: ${data.error.message}`:`API 오류 (${response.status})`);
  const text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  if(!text)throw new Error('루미가 대답을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  return text;
}
// Minimal, safe markdown for the answer: headings, bold, bullet lists, paragraphs.
export function tutorHtml(text,escape){
  const out=[];let list=false;
  for(const raw of String(text).split(/\r?\n/)){
    const line=raw.trim(),inline=s=>escape(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    if(/^[-*•]\s+/.test(line)){if(!list){out.push('<ul>');list=true;}out.push(`<li>${inline(line.replace(/^[-*•]\s+/,''))}</li>`);continue;}
    if(list){out.push('</ul>');list=false;}
    if(!line)continue;
    const h=line.match(/^#{1,4}\s+(.*)$/);out.push(h?`<h4>${inline(h[1])}</h4>`:`<p>${inline(line)}</p>`);
  }
  if(list)out.push('</ul>');return out.join('');
}
