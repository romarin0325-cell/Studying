import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const before=Boolean(process.env.CARD_DISPLAY_BASELINE);
const htmlPath=process.env.CARD_DISPLAY_BASELINE || process.env.CARD_DISPLAY_ARTIFACT || path.join(root,'dist/DREAMWEAVER.html');
const output=path.join(root,'test-results/skill-study');
await fs.mkdir(output,{recursive:true});
const html=await fs.readFile(htmlPath,'utf8');
if(!before){assert(!/résumé|Résumé/.test(html));assert(html.includes('café'));assert(html.includes('class="study-text'));}
const browser=await chromium.launch({headless:true});
const errors=[],records=[];
const sizes=[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}];
async function reset(page){await page.evaluate(()=>{document.querySelectorAll('.modal.active').forEach(el=>el.classList.remove('active'));});}
async function study(page,kind){
 await reset(page);
 await page.evaluate(kind=>{
  const openSet=(set,index=0)=>{
   RPG.state.currentToeicSession={set,qIndex:index,expandedQuestions:set.questions,shuffledOptions:set.questions.map(q=>GameUtils.shuffle(q.options)),results:[],options:{suppressDate:true,countHiddenUnlock:false,countMonthly:false}};
   const modal=document.querySelector('#modal-toeic-practice');modal.classList.add('active');modal.classList.remove('is-review','is-explanation');RPG.renderToeicQuestion();
  };
  const resume=VOCAB_DATA.find(v=>v.word==='resume');
  if(kind==='part5'||kind==='review'||kind==='explanation'){
   openSet(TOEIC_DATA.find(s=>s.id===68),2);
   if(kind==='review'){
    const session=RPG.state.currentToeicSession;
    session.results=[{id:'68-3',isCorrect:false,userAnswer:'contract',correctAnswer:'itinerary'}];
    RPG.showToeicReviewQuestion(2);
   }
   if(kind==='explanation')RPG.showToeicExplanation();
  }else if(kind.startsWith('part6')){
   openSet(TOEIC_DATA.find(s=>(s.passage||'').includes('Additional Materials')));
   if(kind==='part6-passage')RPG.showToeicPassage();else RPG.showToeicQuestions();
  }else if(kind.startsWith('part7')){
   const entries=TOEIC_DATA.filter(s=>s.type==='part7').flatMap(set=>set.questions.map((q,index)=>({set,index,length:Math.max(...q.options.map(o=>o.length))})));
   const longest=entries.sort((a,b)=>b.length-a.length)[0];openSet(longest.set,longest.index);
   if(kind==='part7-passage')RPG.showToeicPassage();else RPG.showToeicQuestions();
  }else if(kind==='cafe'){
   const q=GRAMMAR_DATA.flatMap(s=>s.quizzes).find(q=>q.question.includes('café'));
   QuizEngine.show(QuizEngine.buildGrammarQuiz(q));
  }else if(kind==='vocab'||kind==='reverse'){
   const pick=QuizEngine.pickWeighted;
   try{QuizEngine.pickWeighted=()=>resume;QuizEngine.show(kind==='reverse'?QuizEngine.buildChaosQuiz(()=>{}):QuizEngine.buildVocabQuiz(()=>{}));}
   finally{QuizEngine.pickWeighted=pick;}
  }else if(kind==='collocation'){
   QuizEngine.show(QuizEngine.buildCollocationQuiz(()=>{}));
  }else if(kind==='tutoring-review'){
   QuizEngine.show(QuizEngine.buildTutoringQuiz({type:'vocab',data:resume},()=>{},()=>{}));
  }else if(kind==='wordbook'){
   document.querySelector('#wordbook-filter-wrong').checked=false;RPG.openWordbook();
   const entry=[...document.querySelectorAll('.wordbook-entry')].find(el=>el.querySelector('.wordbook-word')?.textContent==='resume');entry.scrollIntoView({block:'center'});
  }else if(kind==='wrong-wordbook'){
   RPG.state.wrongWords=['resume'];document.querySelector('#wordbook-filter-wrong').checked=true;RPG.openWordbook();
  }else if(kind==='lecture')RPG.showLecture(35);
 },kind);
}
async function inspect(page,selector,label,{studyText=false}={}){
 await page.evaluate(()=>document.fonts.ready);
 const measurements=await page.locator(selector).evaluate(el=>{
  const rect=el.getBoundingClientRect(),css=getComputedStyle(el);
  return {text:el.innerText,font:css.fontFamily,weight:css.fontWeight,size:css.fontSize,left:rect.left,right:rect.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
 });
 if(!before){
  assert(measurements.left>=-1&&measurements.right<=page.viewportSize().width+1,label+' outside viewport');
  assert(measurements.scrollWidth<=measurements.clientWidth+1,label+' horizontal overflow '+JSON.stringify(measurements));
  assert(!/undefined|NaN|\[object Object\]/.test(measurements.text),label+' malformed output');
  if(studyText){assert(!measurements.font.includes('DreamJua'),label+' decorative font');assert(measurements.font.includes('Segoe UI'),label+' unexpected body font');}
 }
 return measurements;
}
async function fonts(page,selector){
 const cdp=await page.context().newCDPSession(page);
 try{await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});return (await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;}
 finally{await cdp.detach();}
}
async function capture(page,label){await page.screenshot({path:path.join(output,`${before?'before':'after'}-${label}.png`)});}
try{
 for(const size of sizes){
  const context=await browser.newContext({viewport:size,reducedMotion:'reduce',offline:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));
  await page.route(/^https?:/,route=>route.abort());
  await page.goto(pathToFileURL(htmlPath).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Astra.ready&&RPG._featuresInstalled);
  await page.evaluate(()=>{
   RPG.loadGlobalData();Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:20,enemyScale:0,deck:['rumi','gold_dragon','luna'],inventory:['rumi','gold_dragon','luna','night_rabbit_valentine'],artifacts:[],chaosBuffs:[],wrongWords:[],wrongCollocations:[],tutoredItems:[],completedToeicSets:[],quiz_stats:{correct:0,total:0}});
   RPG.toMenu();
  });
  for(const theme of ['strawberry','astra','dreamsky']){
   await page.evaluate(t=>Astra.setTheme(t),theme);
   const prefix=`${theme}-${size.width}x${size.height}`;
   for(const id of ['night_rabbit_valentine','gold_dragon','rumi','trans_lumi','blessing_tail','alchemist','venom']){
    await reset(page);await page.evaluate(id=>RPG.showCardInfo(id),id);
    const m=await inspect(page,'#md-skills',prefix+' '+id);
    if(!before)assert(!/\(x[\d.]|MP undefined/.test(m.text));
    await capture(page,prefix+'-card-'+id);
    if(id==='trans_lumi'){
     await page.locator('#md-skills').evaluate(el=>{const scroll=el.closest('.modal-scroll');scroll.scrollTop=scroll.scrollHeight;});
     await capture(page,prefix+'-dream-effects');
     if(!before)assert((await page.locator('#md-skills').innerText()).includes('운명의서약이 있으면 배율 +10'));
    }
   }
   await reset(page);await page.evaluate(()=>{
    RPG.battle={players:[],activeTraits:[],fieldBuffs:[],turn:5,currentPlayerIdx:0};
    RPG.battle.players=RPG.state.deck.map((id,i)=>buildBattlePlayer(RPG,id,i,GameUtils.getAllCards()));
    RPG.battle.enemy=buildBattleEnemy(RPG);RPG.showScreen('screen-battle');RPG.renderBattlefield();RPG.setupControls(RPG.battle.players[0]);
    RPG.showBattleStat('player',0);
   });
   await inspect(page,'#info-content',prefix+' player detail');await capture(page,prefix+'-player');
   await reset(page);await page.evaluate(()=>{const p=RPG.battle.players[0];p.mp=0;RPG.setupControls(p);});
   if(!before){assert.equal(await page.locator('#battle-controls button').count(),4);assert.equal(await page.locator('#battle-controls button:disabled').count(),3);}
   await inspect(page,'#battle-controls',prefix+' controls');await capture(page,prefix+'-mp-short');
   await reset(page);await page.evaluate(()=>{
    RPG.state.pendingEnemyId='pharaoh';RPG.state.pendingEnemyStage=RPG.state.enemyScale;RPG.battle.enemy=buildBattleEnemy(RPG);RPG.showBattleStat('enemy',0);
   });
   await inspect(page,'#info-content',prefix+' pharaoh');await capture(page,prefix+'-pharaoh');
   await page.locator('#info-content').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   await capture(page,prefix+'-pharaoh-skills');
   for(const kind of ['part5','part6-passage','part6-question','part7-passage','part7-question','review','explanation','vocab','reverse','collocation','cafe','wordbook','wrong-wordbook','tutoring-review','lecture']){
    await study(page,kind);
    let selector=kind.startsWith('part')||kind==='review'?'#toeic-q-text':'#quiz-question';
    if(kind.endsWith('passage'))selector='#toeic-passage-scroll';
    if(kind==='explanation')selector='#toeic-explanation-scroll';
    if(kind.includes('wordbook'))selector='#wordbook-list';
    if(kind==='lecture')selector='#lecture-content';
    const m=await inspect(page,selector,prefix+' '+kind,{studyText:true});
    let option=null,optionFonts=[];
    if(['part5','part6-question','part7-question','review','vocab','reverse','collocation','cafe','tutoring-review'].includes(kind)){
     const optSelector=selector.startsWith('#toeic')?'#toeic-options button:first-child':'#quiz-options button:first-child';
     option=await inspect(page,optSelector,prefix+' '+kind+' option',{studyText:true});
     optionFonts=await fonts(page,optSelector);
     if(!before){assert.equal(m.font,option.font);assert.equal(m.weight,option.weight);}
    }
    let fontSelector=selector;
    if(kind.includes('wordbook')){
     await page.evaluate(()=>{const word=[...document.querySelectorAll('#wordbook-list .wordbook-word')].find(el=>el.textContent==='resume');word.dataset.fontProbe='resume';});
     fontSelector='#wordbook-list [data-font-probe=resume]';
    }
    const renderedFonts=await fonts(page,fontSelector);
    if(!before){assert(renderedFonts.some(f=>f.glyphCount>0),prefix+' '+kind+' no rendered glyphs');assert(renderedFonts.every(f=>!f.familyName.includes('Jua')),prefix+' '+kind+' rendered Jua');}
    if(!before&&option)assert(optionFonts.some(f=>f.glyphCount>0)&&optionFonts.every(f=>!f.familyName.includes('Jua')),prefix+' '+kind+' option rendered font');
    if(!before&&kind==='part5'){
     assert(m.text.includes('tomorrow’s'));
     assert.deepEqual((await page.locator('#toeic-options button').allTextContents()).sort(),['contract','inventory','itinerary','resume']);
    }
    if(!before&&kind==='part6-passage')assert(m.text.includes('review of your resume'));
    if(!before&&kind==='cafe'){assert(m.text.includes('café'));assert.equal(new Set(renderedFonts.map(f=>f.familyName)).size,1,'café accent must use the same rendered face as the sentence');}
    if(!before&&kind.includes('wordbook'))assert(m.text.includes('(동) 재개하다; (명) 이력서'));
    records.push({theme,size,kind,measurements:m,option,renderedFonts,optionFonts});
    await capture(page,prefix+'-'+kind);
   }
  }
  if(!before&&size.width===390){
   await reset(page);
   const checks=await page.evaluate(()=>{
    const texts=[];RPG.battle.fieldBuffs=[];
    // Exhaustive formatter comparisons verify wiring; semantic regressions below
    // use literal expectations independently of SkillDisplay.
    for(const proto of [...GameUtils.getAllCards(),...GameUtils.getBattleOnlyForms()]){
     RPG.showCardInfo(proto.id);
     const expected=[RPG.NORMAL_ATTACK,...proto.skills].map(s=>SkillDisplay.text(s,{entity:proto}));
     const actual=[...document.querySelectorAll('#md-skills .skill-detail')].map(el=>el.innerText);
     if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Card detail renderer '+proto.id);
     RPG.closeModal();
    }
    const cancel=' 발동 전에 시전자가 사망하면 예약 취소.';
    for(const [id,name,expected] of [
     ['blessing_tail','홀리블레싱','1턴 후 필드 버프 ‘성역’ 부여 예약.'+cancel],
     ['alchemist','은빛마법진','1턴 후 필드 버프 ‘달의축복’ 부여 예약.'+cancel],
     ['venom','플래이그','사용 후 1·2·3·4·5턴에 각각 위력 1배로 공격 예약. 각 예약 발동 시 적에게 ‘약화·침묵·부식·저주·암흑·디바인·작열·유혹’ 중 무작위 1종 부여.'+cancel],
     ['fireworks_girl','페스티벌나이트','사용 후 1·2·3턴에 각각 위력 1.5배로 공격 예약. 각 예약 발동 시 적이 작열 상태이면 배율 ×2.'+cancel]
    ]){
     const body=selector=>[...document.querySelectorAll(selector+' .skill-detail')].find(el=>el.querySelector('b').textContent.startsWith(name+' · '))?.querySelector('.skill-detail-body').textContent;
     RPG.showCardInfo(id);
     if(body('#md-skills')!==expected)throw new Error('Card semantic detail '+id);
     RPG.closeModal();
     RPG.battle.players=[buildBattlePlayer(RPG,id,0,GameUtils.getAllCards())];
     RPG.showBattleStat('player',0);
     if(body('#info-content')!==expected)throw new Error('Player semantic detail '+id);
     RPG.closeInfoModal();
    }
    for(const mode of ['origin','artifact','puzzle','perfect_plan','dream_corridor'])for(const proto of ENEMIES){
     Object.assign(RPG.state,{mode,enemyScale:35,pendingEnemyStage:35,pendingEnemyId:proto.id});
     const enemy=buildBattleEnemy(RPG);RPG.battle.enemy=enemy;RPG.showBattleStat('enemy',0);
     const text=document.querySelector('#info-content').innerText;
     if(/undefined|NaN|\[object Object\]|타입 미확인| · MP |티어|\(x[\d.]/.test(text))throw new Error(mode+' '+enemy.id+' '+text);
     const headings=[...document.querySelectorAll('#info-content .skill-detail-heading')].map(e=>e.textContent);
     enemy.skills.forEach((skill,i)=>{if(headings[i]!==skill.name+' · '+SkillTypes.label(skill.type))throw new Error('Wrong execution type');});
     if(enemy.id==='iris_love'){
      const soul=[...document.querySelectorAll('#info-content .skill-detail')].find(el=>el.querySelector('b').textContent==='소울드레인 · 마법');
      if(soul?.querySelector('.skill-detail-body').textContent!=='적의 현재 MP 전부 제거. 7턴째 발동.')throw new Error('Soul Drain semantic detail '+mode);
     }
     texts.push({mode,id:enemy.id,text});RPG.closeInfoModal();
    }
    const rng=Math.random;
    try{
     Math.random=()=>0;
     for(const [scale,id] of [[30,'flora'],[31,'gray'],[32,'thor'],[33,'poseidon'],[34,'ares']]){
      Object.assign(RPG.state,{mode:'origin',enemyScale:scale,pendingEnemyId:null,pendingEnemyStage:null});
      if(buildBattleEnemy(RPG).id!==id)throw new Error('Hidden generation path '+id);
     }
     const season=RPG.getCurrentSpecialSeason,visible=RPG.isSpecialMissionVisible;
     try{
      RPG.isSpecialMissionVisible=()=>true;
      for(const id of ['flora_valentine','thor_swimsuit','ares_halloween','astea_christmas']){
       RPG.getCurrentSpecialSeason=()=>({bossId:id});Object.assign(RPG.state,{enemyScale:35,pendingEnemyId:null,pendingEnemyStage:null});
       if(buildBattleEnemy(RPG).id!==id)throw new Error('Season generation '+id);
      }
     }finally{RPG.getCurrentSpecialSeason=season;RPG.isSpecialMissionVisible=visible;}
     for(const id of ['ares','ares_halloween','creator_god','astea_christmas']){
      const enemy=buildBattleEnemy({state:RPG.state,getCurrentStageEnemyData:()=>ENEMIES.find(e=>e.id===id)});
      const turn=id.startsWith('ares')?3:4;Math.random=()=>id.startsWith('ares')?0:0.4;
      const charge=Logic.decideEnemyAction(enemy,turn);
      if(!charge.isChargeStart)throw new Error('Charge action '+id);
      enemy.skills=[charge];RPG.battle.enemy=enemy;RPG.showBattleStat('enemy',0);
      if(!document.querySelector('#info-content').innerText.includes('힘을 모은다'))throw new Error('Charge detail');
     }
    }finally{Math.random=rng;}
    Object.assign(RPG.state,{mode:'origin',enemyScale:0,deck:['rumi','gold_dragon','luna'],pendingEnemyId:null,pendingEnemyStage:null});
    RPG.battle={players:[],activeTraits:[],fieldBuffs:[],turn:1,currentPlayerIdx:0};
    const p=buildBattlePlayer(RPG,'rumi',0,GameUtils.getAllCards());p.skills=cloneSkillsWithCostModifiers({battle:{players:[{proto:{trait:{type:'party_all_stats_mana_cost',costMult:2}}}]},hasArtifact:()=>false},p.proto.skills);
    RPG.battle.players=[p];RPG.battle.enemy=buildBattleEnemy(RPG);RPG.showBattleStat('player',0);
    if(!document.querySelector('#info-content').innerText.includes('밀키웨이엑스터시 · 마법 · MP 60'))throw new Error('Current cost detail');
    RPG.setupControls(p);if(!document.querySelector('#battle-controls button:nth-child(2)').getAttribute('aria-label').includes('MP 60'))throw new Error('Current cost accessibility');
    const execute=RPG.executeSkill;let count=0;
    try{RPG.executeSkill=()=>count++;const button=document.querySelector('#battle-controls button');button.click();button.click();if(count!==1)throw new Error('Double action');}
    finally{RPG.executeSkill=execute;}
    return texts;
   });
   await fs.writeFile(path.join(output,'boss-render-audit.json'),JSON.stringify(checks,null,2));
   // Go through actual library/deck entry points and ensure they expose the same text.
   await reset(page);await page.evaluate(()=>{RPG.openCollection();});
   await page.locator('#collection-grid [data-card-id=rumi]').click();
   const collection=await page.locator('#md-skills').innerText();
   await reset(page);await page.evaluate(()=>{RPG.openDeck();});
   // The deck uses this same existing detail entry point after card selection.
   await page.evaluate(()=>RPG.showCardInfo('rumi'));
   assert.equal(await page.locator('#md-skills').innerText(),collection);
   await study(page,'part5');
   const options=await page.locator('#toeic-options button').allTextContents();assert.equal(new Set(options).size,4);
   await page.locator('#toeic-options button').filter({hasText:/^itinerary$/}).click();
   assert.equal(await page.evaluate(()=>RPG.state.currentToeicSession.results.length),1);
   assert.deepEqual(await page.evaluate(()=>RPG.state.currentToeicSession.results[0]),{id:'68-3',question:'Please review the attached ______ for tomorrow’s client visit and notify me of any scheduling conflicts.',isCorrect:true,userAnswer:'itinerary',correctAnswer:'itinerary'});
   await page.waitForFunction(()=>!RPG.state.currentToeicSession?.isAnswering);
   await study(page,'part5');await page.locator('#toeic-options button').filter({hasText:/^resume$/}).click();
   assert.equal(await page.evaluate(()=>RPG.state.currentToeicSession.results[0].isCorrect),false);
   assert.equal(await page.evaluate(()=>RPG.state.currentToeicSession.results[0].id),'68-3');
   await page.waitForFunction(()=>!RPG.state.currentToeicSession?.isAnswering);
   await study(page,'vocab');await page.evaluate(()=>{RPG._displayQuizCallbacks=0;RPG.state.wrongWords=[];Storage.remove(Storage.keys.VOCAB);const pick=QuizEngine.pickWeighted;try{QuizEngine.pickWeighted=()=>VOCAB_DATA.find(v=>v.word==='resume');const config=QuizEngine.buildVocabQuiz(()=>RPG._displayQuizCallbacks++);config.wrongDelay=50;QuizEngine.show(config);}finally{QuizEngine.pickWeighted=pick;}});
   const wrong=page.locator('#quiz-options button').filter({hasText:'가정하다'});await wrong.click();await page.waitForFunction(()=>RPG._displayQuizCallbacks===1);
   assert.equal(await page.evaluate(()=>RPG.state.wrongWords.includes('resume')),true);
   assert.equal(await page.evaluate(()=>Storage.load(Storage.keys.VOCAB,[]).includes('resume')),true);
  }
  await context.close();
 }
 await fs.writeFile(path.join(output,`${before?'before':'after'}-render-audit.json`),JSON.stringify(records,null,2));
 assert.deepEqual(errors,[],'Runtime errors');
 console.log(before?'BASELINE captured: 3 themes × 4 viewports, skill details and 15 study paths with rendered fonts.':'PASS skill/study browser: 3 themes × 4 viewports, 75 boss detail renders, charge actions, adjusted costs, rendered fonts, 15 study paths, real grading and wrong-word storage.');
}finally{await browser.close();}
