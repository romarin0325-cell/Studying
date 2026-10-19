// Rumi's explanation of a wrong answer through the Gemini API or DeepSeek on Coral Bricks (the player's own key, entered in Settings).
// Keys live only in this browser's localStorage (never in the save profile or its backups).
// Coral Bricks accepts browser calls only from its own site (CORS), so DeepSeek goes through the local relay in scripts/serve.mjs.
import {COURSE} from './course.js';
import {lectureById,termById} from './quiz.js';

const STORE='star-garden-tutor';
const ROOT='https://generativelanguage.googleapis.com/v1beta/models';
export const TUTOR_PROVIDERS=Object.freeze([{id:'gemini',label:'Google Gemini',keyName:'Gemini API 키'},{id:'deepseek',label:'DeepSeek · Coral Bricks',keyName:'Coral Bricks API 키'}]);
export const TUTOR_MODELS=Object.freeze([{id:'gemini-3.8-flash',provider:'gemini',label:'Gemini 3.8 Flash · 빠름'},{id:'gemini-4-argon',provider:'gemini',label:'Gemini 4 Argon · 깊이'},{id:'gemini-3.5-flash-lite',provider:'gemini',label:'Gemini 3.5 Flash Lite · 가벼움'},
  {id:'deepseek-v4.1-flash-fast',provider:'deepseek',label:'DeepSeek V4.1 Flash · 빠름'},{id:'deepseek-v4.1-flash-fast:high',provider:'deepseek',label:'DeepSeek V4.1 Flash · 깊이(추론)'}]);
export const DEEPSEEK_RELAY='http://127.0.0.1:4178/coralbricks/v1';
const str=v=>typeof v==='string'?v.trim():'';
function stored(){try{const s=JSON.parse(localStorage.getItem(STORE)||'{}');return s&&typeof s==='object'?s:{};}catch{return {};}}
const pickModel=(provider,id)=>{const own=TUTOR_MODELS.filter(m=>m.provider===provider);return own.some(m=>m.id===id)?id:own[0].id;};
// Each provider keeps its own key and model; `key` and `model` are the active provider's.
export function tutorSettings(){
  const s=stored(),provider=TUTOR_PROVIDERS.some(p=>p.id===s.provider)?s.provider:'gemini';
  const keys={gemini:str(s.key),deepseek:str(s.deepseekKey)},models={gemini:pickModel('gemini',s.model),deepseek:pickModel('deepseek',s.deepseekModel)};
  return {provider,key:keys[provider],model:models[provider],keys,models,base:str(s.deepseekBase)||DEEPSEEK_RELAY};
}
// Saves the active provider's key/model (and the relay address); the other provider's entries stay.
export function saveTutorSettings({provider,key,model,base}={}){
  try{
    const now=tutorSettings(),p=TUTOR_PROVIDERS.some(x=>x.id===provider)?provider:now.provider;
    const keys={...now.keys},models={...now.models};if(key!==undefined)keys[p]=str(key);if(model!==undefined)models[p]=pickModel(p,model);
    localStorage.setItem(STORE,JSON.stringify({provider:p,key:keys.gemini,model:models.gemini,deepseekKey:keys.deepseek,deepseekModel:models.deepseek,deepseekBase:base===undefined?(now.base===DEEPSEEK_RELAY?'':now.base):str(base)}));
    return true;
  }catch{return false;}
}
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
  const lecture=question.lecture?lectureById(question.lecture):null,term=question.term?termById(question.term):null,letters='①②③④⑤⑥';
  return [`[문제] ${question.prompt}`,...question.choices.map((c,i)=>`${letters[i]} ${c}`),`[정답] ${letters[question.answer]} ${question.choices[question.answer]}`,
    chosen>=0&&chosen!==question.answer?`[형아가 고른 답] ${letters[chosen]} ${question.choices[chosen]}`:'',`[교재 해설] ${question.explain}`,
    question.source?`[출전] ${question.source}`:'',
    lecture?`[관련 강의] 제${lecture.no}강 ${lecture.title}(${lecture.titleJa}) — ${lecture.core}\n${lecture.body.join('\n')}\n원칙: ${lecture.principles.join(' / ')}\n헷갈리기 쉬운 점: ${lecture.confusion}\n시험 포인트: ${lecture.point}`:'',
    term?`[관련 용어] ${term.termJa} = ${term.termKo}\n${term.explain}\n시험 힌트: ${term.hint}`:''].filter(Boolean).join('\n');
}
// Returns the explanation text, or throws an Error with a Korean message.
export async function explainWithRumi(question,chosen,{signal}={}){
  const settings=tutorSettings(),{key,model}=settings;
  if(!key)throw new Error(`설정에서 ${TUTOR_PROVIDERS.find(p=>p.id===settings.provider).keyName}를 먼저 넣어 주세요.`);
  if(settings.provider==='deepseek')return explainWithDeepSeek(question,chosen,settings,signal);
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
// OpenAI-style chat completions; the ':high' model turns reasoning on.
async function explainWithDeepSeek(question,chosen,{key,model,base},signal){
  const [id,effort]=model.split(':'),body={model:id,messages:[{role:'system',content:PERSONA},{role:'user',content:tutorPrompt(question,chosen)}],temperature:.6,max_tokens:effort?8192:4096};
  if(effort)body.reasoning_effort=effort;
  let response;
  try{response=await fetch(`${base.replace(/\/+$/,'')}/chat/completions`,{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(body)});}
  catch(error){if(error?.name==='AbortError')throw error;throw new Error(base===DEEPSEEK_RELAY?'중계 서버에 연결하지 못했어요. PC에서 node defense_test/scripts/serve.mjs 를 켜 두었는지 확인해 주세요.':'인터넷에 연결되어 있지 않거나 요청이 막혔어요.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error?.message?`API 오류: ${data.error.message}`:`API 오류 (${response.status})`);
  const answer=String(data.choices?.[0]?.message?.content||'').trim();
  if(!answer)throw new Error('루미가 대답을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  return answer;
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
