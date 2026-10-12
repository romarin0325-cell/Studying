// Rumi's explanation of a wrong answer through the Gemini API (the player's own key, entered in Settings).
// The key lives only in this browser's localStorage (never in the save profile or its backups).
import {COURSE} from './course.js';
import {lectureById} from './quiz.js';

const STORE='star-garden-tutor';
const ROOT='https://generativelanguage.googleapis.com/v1beta/models';
export const TUTOR_MODELS=Object.freeze([{id:'gemini-3.8-flash',label:'Flash (권장)'},{id:'gemini-3.5-flash-lite',label:'Flash Lite (빠름)'},{id:'gemini-2.5-pro',label:'Pro (깊이)'}]);
export function tutorSettings(){try{const s=JSON.parse(localStorage.getItem(STORE)||'{}');return {key:typeof s.key==='string'?s.key:'',model:TUTOR_MODELS.some(m=>m.id===s.model)?s.model:TUTOR_MODELS[0].id};}catch{return {key:'',model:TUTOR_MODELS[0].id};}}
export function saveTutorSettings({key,model}){try{localStorage.setItem(STORE,JSON.stringify({key:String(key||'').trim(),model}));return true;}catch{return false;}}
export const hasTutor=()=>!!tutorSettings().key;

const PERSONA=`너는 별빛 정원의 대현자 '루미'야. 사용자를 "형아"라고 부르는 귀여운 남자아이 마법사이고, 반말로 친근하고 다정하게 말해.
형아는 지금 "${COURSE.subject}"을(를) 공부하고 있어. 형아가 틀린 문제를 정확하고 자세하게 설명해 주는 게 네 역할이야.
규칙:
- 사실은 정확해야 해. 확실하지 않은 내용은 지어내지 말고 "이 부분은 교재를 한 번 더 확인해 줘"라고 말해.
- 시험 용어는 원어 표기(일본어 등)를 함께 적어.
- 설명은 충분히 길고 친절하게. 단, 귀여운 말투가 내용을 가리지 않게 해.
- 형식(마크다운 제목과 목록 사용):
  ## 핵심 한 줄
  ## 정답이 맞는 이유
  ## 형아가 고른 답이 틀린 이유 (다른 선택지도 짧게)
  ## 쉬운 비유
  ## 시험에서는 이렇게 나와
  ## 외우는 요령
  마지막에 루미의 짧은 응원 한마디.`;

export function tutorPrompt(question,chosen){
  const lecture=question.lecture?lectureById(question.lecture):null,letters='①②③④⑤⑥';
  return [`[문제] ${question.prompt}`,...question.choices.map((c,i)=>`${letters[i]} ${c}`),`[정답] ${letters[question.answer]} ${question.choices[question.answer]}`,
    chosen>=0&&chosen!==question.answer?`[형아가 고른 답] ${letters[chosen]} ${question.choices[chosen]}`:'',`[교재 해설] ${question.explain}`,
    lecture?`[관련 강의] 제${lecture.no}강 ${lecture.title} — ${lecture.summary}\n${lecture.body.join('\n')}\n시험 포인트: ${lecture.point}`:''].filter(Boolean).join('\n');
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
