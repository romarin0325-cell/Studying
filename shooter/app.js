import { HEROES, STAGES, DUNGEONS, clamp } from './content.js';
import { createProfile, heroAvailable, dailyHeroes, claimDungeon, DIFFICULTIES, normalizeDifficulty, randomHero } from './meta.js';
import { CampaignUI } from './menus.js';
import { Game } from './engine.js';
import { Renderer, loadArt } from './render.js';
import { AudioDirector } from './audio.js';

const $ = id => document.getElementById(id);
const app = $('app'), screen = $('screen'), modal = $('modal'), hud = $('hud'), world = $('world');
const audio = new AudioDirector();
const storeKey = 'astral-bloom-v1';
let saved = {}, storageAvailable = true;
try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch { storageAvailable = false; }
const preferences = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
const profile = createProfile(saved.campaign);
let chosenHero = clamp(Number(preferences.hero) || 0, 0, HEROES.length-1), chosenWeapon = 0, chosenStage = 0;
if(!heroAvailable(profile,chosenHero)) chosenHero=dailyHeroes()[0];
let difficulty = normalizeDifficulty(preferences.mode);
audio.enabled = preferences.sound !== false;
let art, renderer, game = null, paused = false, raf = 0, last = 0, accumulator = 0, hudTimer = 0;
let announcementTimer = 0, toastTimer = 0, pointer = null, keys = new Set(), frameSamples = [], startingStage = 0;
let runCount = 0;
let menus;
let chosenRandom = preferences.random === true;
function save() {
  saved.campaign = profile;
  saved.settings = { hero: chosenHero, random: chosenRandom, mode: difficulty, sound: audio.enabled };
  try { localStorage.setItem(storeKey, JSON.stringify(saved)); } catch { storageAvailable = false; }
}
function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 1800); }
function announce(eyebrow, title, copy = '', duration = 2400, bomb = false) {
  clearTimeout(announcementTimer); const el = $('announcement');
  el.innerHTML = `<small>${eyebrow}</small><h2>${title}</h2>${copy ? `<p>${copy}</p>` : ''}`;
  el.className = `visible ${bomb ? 'bomb-announcement' : ''}`;
  announcementTimer = setTimeout(() => el.classList.remove('visible'), duration);
}
function hideAnnouncement() { clearTimeout(announcementTimer); $('announcement').className = ''; }
function setModal(html) { modal.innerHTML = `<section class="panel" role="dialog" aria-modal="true">${html}</section>`; modal.hidden = false; modal.querySelector('button')?.focus({ preventScroll: true }); }
function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
function syncSound() { document.querySelectorAll('.sound-toggle').forEach(b => { b.textContent = audio.enabled ? '♪' : '♩'; b.setAttribute('aria-label', audio.enabled ? '소리 끄기' : '소리 켜기'); b.setAttribute('aria-pressed', String(audio.enabled)); }); }
function soundClick() { audio.setEnabled(!audio.enabled); if (audio.enabled && !paused) audio.start(); save(); syncSound(); }
function bindSounds() { document.querySelectorAll('.sound-toggle').forEach(b => { b.onclick = soundClick; }); syncSound(); }
function syncFullscreen() {
  const button=$('fullscreen');if(!button)return;
  const active=!!document.fullscreenElement;
  button.textContent=active?'⤢':'⛶';button.setAttribute('aria-label',active?'전체화면 나가기':'전체화면');button.setAttribute('aria-pressed',String(active));
}
async function toggleFullscreen() {
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else if(document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen({navigationUI:'hide'}); }
      catch { await document.documentElement.requestFullscreen(); }
    } else toast('이 브라우저는 전체화면을 지원하지 않아요. 홈 화면에 추가하면 더 넓게 볼 수 있어요.');
  } catch { toast('전체화면을 열지 못했어요. 브라우저에서 다시 시도해주세요.'); }
  syncFullscreen();
}
document.addEventListener('fullscreenchange',syncFullscreen);
function bestKey() { return `${difficulty}-${chosenStage}`; }
function showSortie() {
  cancelAnimationFrame(raf); game = null; paused = false; keys.clear(); pointer = null; audio.boss = false;
  hideAnnouncement(); closeModal(); hud.hidden = true; world.style.display = 'none'; screen.hidden = false;
  if (!chosenRandom && HEROES[chosenHero].hidden) chosenHero=dailyHeroes()[0];
  const hero = HEROES[chosenHero], stage = STAGES[chosenStage];
  app.style.setProperty('--accent', hero.color); app.style.setProperty('--scene', `url("${art.urls.worlds[chosenStage]}")`);
  $('ambient').style.backgroundImage = `url("${art.urls.worlds[chosenStage]}")`;
  screen.innerHTML = `<section class="sortie">
    <header class="masthead"><div class="brand"><i>✧</i> ASTRAL BLOOM</div><div class="masthead-actions"><button class="round-button" id="fullscreen" aria-label="전체화면">⛶</button><button class="round-button" id="help" aria-label="플레이 방법">?</button><button class="round-button sound-toggle" aria-label="소리 끄기">♪</button></div></header>
    <div class="sortie-top"><div class="hero-heading"><span class="small-caps">${chosenRandom?'새로운 만남을 향해':hero.title}</span><h1>${chosenRandom?'랜덤':hero.name}</h1><span class="english-name">${chosenRandom?'A CHANCE ENCOUNTER':hero.en}</span></div><span class="hero-index">0${chosenHero + 1}</span><div class="hero-aura"></div><img class="hero-large ${chosenRandom?'random-portrait':''}" src="${art.urls.heroes[chosenHero]}" alt="${hero.name}의 SD 일러스트"><p class="hero-quote">“${chosenRandom?'오늘의 수호자, 혹은 숨겨진 이야기와 만나요.':hero.quote}”</p></div>
    <div class="sortie-controls"><p class="rotation-note">${menus.rotationLabel()}</p><nav class="roster" aria-label="캐릭터 선택">${HEROES.flatMap((h, i) => h.hidden ? [] : `<button class="${!chosenRandom && i === chosenHero ? 'active' : ''}" data-hero="${i}" aria-label="${h.name} 선택${heroAvailable(profile,i)?'':' · 문법 해금'}" aria-pressed="${!chosenRandom && i === chosenHero}"><img src="${art.urls.heroes[i]}" alt=""><span>${heroAvailable(profile,i)?'':'◇ '}${h.name}</span></button>`).join('')}<button id="random-hero" class="${chosenRandom?'active':''}" aria-pressed="${chosenRandom}"><span class="random-sigil">✧</span><span>랜덤</span></button></nav>
    <div class="section-heading"><h2>공격 스타일</h2><small>${chosenRandom?'출격 전 만남과 스타일 선택':'두 가지 빛, 서로 다른 궤적'}</small></div>
    <div class="weapons" ${chosenRandom?'hidden':''}>${hero.weapons.map((w, i) => `<button class="weapon-card ${i === chosenWeapon ? 'selected' : ''}" data-weapon="${i}" aria-pressed="${i === chosenWeapon}"><strong>${w.name}</strong><small>${w.tag}</small></button>`).join('')}</div>
    <p class="weapon-description">${chosenRandom?'랜덤 출격에서만 히든 캐릭터를 만날 수 있어요. 히든 확률 20%. 만난 뒤 공격 스타일을 고를 수 있어요.':hero.weapons[chosenWeapon].description}</p>
    <nav class="route campaign-route" aria-label="출격 준비"><button id="dungeons"><small>던전 · ${DIFFICULTIES.find(d=>d.id===difficulty).name}</small><b>${stage.name} ⌄</b></button><button id="equipment"><small>유물 ${profile.equipped.length}/3 · 뽑기권 ${profile.tickets.length}</small><b>유물함</b></button><button id="library"><small>LEARNING</small><b>도서관</b></button></nav>
    <button class="launch" id="launch">${stage.name} 출격<span>THREE STAGES</span><b>→</b></button>
    <div class="footer-note"><span>◇ 다른 요일 수호자 · 문법으로 오늘 해금</span><span>BEST ${Number(saved.best?.[bestKey()] || 0).toLocaleString()}</span></div></div>
  </section>`;
  screen.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => menus.chooseHero(Number(b.dataset.hero),()=>{ chosenRandom = false; chosenHero = Number(b.dataset.hero); chosenWeapon = 0; save(); showSortie(); }));
  screen.querySelectorAll('[data-weapon]').forEach(b => b.onclick = () => { chosenWeapon = Number(b.dataset.weapon); showSortie(); });
  screen.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { chosenStage = Number(b.dataset.stage); showSortie(); });
  $('dungeons').onclick=()=>menus.dungeons(chosenStage,difficulty,(stage,mode)=>{chosenStage=stage;difficulty=mode;save();showSortie();});
  $('equipment').onclick=()=>menus.equipment(showSortie);$('library').onclick=()=>menus.library();
  $('help').onclick = () => showHelp(false);
  $('random-hero').onclick=()=>{chosenRandom=true;save();showSortie();};
  syncFullscreen();$('fullscreen').onclick=toggleFullscreen;
  $('launch').onclick = () => { audio.start(); if (!saved.tutorial) showHelp(true); else startGame(); };
  bindSounds();
}
function showHelp(launchAfter) {
  const hero = HEROES[chosenHero];
  setModal(`<span class="small-caps">YOUR FIRST FLIGHT</span><h2>별의 잔향</h2><p class="intro-copy">새로운 수호자들, 네 개의 던전.<br>손끝으로 작은 빛을 지켜주세요.</p>
    <div class="help-list"><div><em>↔</em><span><b>손가락을 편하게 드래그</b>누른 위치에서 움직인 만큼 이동해요. 공격은 자동이에요.</span></div><div><em><i class="core-dot"></i></em><span><b>중앙의 작은 코어만 조심</b>머리와 망토에는 맞아도 괜찮아요. 가까이 피하면 점수 보너스!</span></div><div><em>❖</em><span><b>${hero.bomb}</b>${hero.bombInfo}</span></div><div><em>✦</em><span><b>파워업과 보물 수집</b>P 세 개마다 화력 상승. 화면 위쪽으로 가면 보물이 모여요.</span></div></div>
    <p class="tiny-note">키보드: 방향키 / WASD 이동 · Shift 정밀 이동 · Space 봄 · Esc 일시정지<br>던전당 3스테이지. 1·2스테이지 뒤 퀴즈는 생명이나 봄 회복, 마지막 퀴즈는 최종 점수 +10%. 퀴즈 도전은 선택이에요. 주간 첫 클리어로 유물 뽑기권을 모아보세요.</p>
    <button class="primary" id="help-done">${launchAfter ? '준비됐어요 · 출격' : '알겠어요'}</button>`);
  $('help-done').onclick = () => { saved.tutorial = true; save(); closeModal(); if (launchAfter) startGame(); };
}
function startGame(stage = chosenStage, randomResolved = false) {
  if(chosenRandom && !randomResolved){
    chosenHero=randomHero(profile);chosenWeapon=0;
    const hero=HEROES[chosenHero];
    setModal(`<span class="small-caps">${hero.hidden?'HIDDEN ENCOUNTER':'YOUR COMPANION'}</span><h2>${hero.name}</h2><img class="result-hero" src="${art.urls.heroes[chosenHero]}" alt="${hero.name}"><p class="intro-copy">${hero.description}</p><div class="random-weapons">${hero.weapons.map((w,i)=>`<button class="secondary ${i===0?'selected':''}" data-random-weapon="${i}" aria-pressed="${i===0}"><b>${w.name}</b><small>${w.description}</small></button>`).join('')}</div><p class="tiny-note">필살기 · ${hero.bomb}<br>${hero.bombInfo}</p><button class="primary" id="random-launch">이 모습으로 출격</button><button class="secondary" id="random-cancel">출격 준비로</button>`);
    document.querySelectorAll('[data-random-weapon]').forEach(b=>b.onclick=()=>{chosenWeapon=Number(b.dataset.randomWeapon);document.querySelectorAll('[data-random-weapon]').forEach(item=>{const selected=Number(item.dataset.randomWeapon)===chosenWeapon;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected));});});
    $('random-launch').onclick=()=>startGame(stage,true);$('random-cancel').onclick=showSortie;return;
  }
  if(!chosenRandom && !heroAvailable(profile,chosenHero)) {menus.chooseHero(chosenHero,()=>startGame(stage),showSortie);return;}
  cancelAnimationFrame(raf); closeModal(); hideAnnouncement(); audio.start();
  screen.hidden = true; hud.hidden = false; world.style.display = 'block'; renderer.resize();
  paused = false; keys.clear(); pointer = null; accumulator = 0; last = 0; frameSamples = []; startingStage = stage;
  game = new Game({ hero: chosenHero, weapon: chosenWeapon, stage, artifacts:profile.equipped.filter(id=>profile.owned.includes(id)), height: renderer.height, mode: difficulty, seed: 1471 + ++runCount, onEvent: handleEvent });
  $('weapon-label').textContent = HEROES[chosenHero].weapons[chosenWeapon].name;
  $('bomb-label').textContent = HEROES[chosenHero].bomb;
  app.style.setProperty('--accent', HEROES[chosenHero].color);
  renderHud(); bindSounds(); raf = requestAnimationFrame(frame);
}
function handleEvent(event) {
  audio.event(event); renderer?.feedback(event.type);
  if (event.type === 'stage') {
    audio.stage = event.stage; audio.boss = false;
    $('stage-label').textContent = `${DUNGEONS[event.stage].name} · ${event.room+1}/3`;
    $('ambient').style.backgroundImage = `url("${art.urls.worlds[event.stage]}")`;
    announce(`STAGE ${event.room+1} / 3`, DUNGEONS[event.stage].rooms[event.room], '');
  }
  if (event.type === 'warning') { audio.boss = true; announce('GUARDIAN APPROACHING', STAGES[game.stageIndex].boss, `“${game.stage.intro}”`, 2900); }
  if (event.type === 'pattern') { $('pattern-name').textContent = event.name; if (event.phase > 0) toast(`✧ ${event.name}`); }
  if (event.type === 'bomb') announce('ASTRAL BLOOM', HEROES[event.hero].bomb, '', 1800, true);
  if (event.type === 'powerup') toast(`✦ SHOT POWER ${game.power}`);
  if (event.type === 'heal') toast('♡ 생명 회복');
  if (event.type === 'bossDefeated') { audio.boss = false; announce('SKY LIBERATED', '하늘을 되찾았어요', `“${game.stage.outro}”`, 3000); }
  if (event.type === 'sentinel') announce('SENTINEL APPROACHING',event.name,'관문을 지키는 수호자가 나타났어요.',2200);
  if (event.type === 'roomClear') announce('STAGE CLEAR','다음 하늘을 위한 한 페이지','잠시 쉬며 별의 말을 기억해요.',2600);
  if (event.type === 'quiz') showStageQuiz(event.kind);
  if (event.type === 'defeat') offerRevive();
  if (event.type === 'victory') finish(true);
}
function renderHud() {
  if (!game) return;
  $('score').textContent = String(Math.round(game.score)).padStart(6, '0');
  const lives = `${game.player.lives}/${game.maxLife}`; if ($('lives').dataset.value !== lives) { $('lives').dataset.value = lives; $('lives').innerHTML = Array.from({ length: game.maxLife }, (_, i) => `<span class="${i < game.player.lives ? '' : 'empty'}"></span>`).join(''); $('lives').setAttribute('aria-label', `생명 ${lives}`); }
  const power = String(game.power); if ($('power').dataset.value !== power) { $('power').dataset.value = power; $('power').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < game.power ? 'on' : ''}"></i>`).join(''); }
  $('bomb-count').textContent = String(game.bombs); $('bomb').disabled = game.bombTime > 0 || (game.bombs <= 0 && !(game.artifacts.has('mask')&&game.player.lives>1&&game.maskUses<3)) || !['wave', 'boss', 'warning'].includes(game.phase);
  $('combo-hud').style.opacity = game.combo > 1 ? '1' : '0'; $('combo').textContent = `${game.combo} COMBO`; $('multiplier').textContent = `SCORE ×${game.multiplier}`;
  $('combo-meter').style.transform = `scaleX(${Math.max(0, game.comboTime / 3.6)})`;
  const bossVisible = ['warning', 'boss'].includes(game.phase) && game.boss;
  $('boss-hud').hidden = !bossVisible;
  if (bossVisible) { $('boss-name').textContent = game.stage.boss; $('boss-phase').textContent = `PHASE ${Math.max(1, game.bossPattern + 1)} / 3`; $('boss-health').style.width = `${Math.max(0, game.boss.hp / game.boss.maxHp) * 100}%`; }
}
function frame(now) {
  if (!game || paused) return;
  const delta = last ? Math.min((now - last) / 1000, .1) : 1 / 60; last = now;
  if (delta > 0) { frameSamples.push(delta); if (frameSamples.length > 120) frameSamples.shift(); }
  if (keys.size && !game.finished && game.phase !== 'quiz') {
    const x = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
    const y = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
    const rate = keys.has('Shift') ? 160 : 390, norm = x && y ? Math.SQRT1_2 : 1;
    game.move(game.player.x + x * rate * delta * norm, game.player.y + y * rate * delta * norm);
  }
  accumulator += delta; let ticks = 0;
  while (accumulator >= 1 / 60 && ticks++ < 5) { game.update(1 / 60); accumulator -= 1 / 60; }
  if (ticks >= 5) accumulator = 0;
  renderer.render(game, delta); hudTimer += delta;
  if (hudTimer >= .085) { renderHud(); hudTimer = 0; }
  renderer.observeFrame(delta);
  if (!paused && !game.finished && game.phase !== 'quiz') raf = requestAnimationFrame(frame);
}
function pauseGame() {
  if (!game || game.finished || game.phase === 'quiz' || paused) return;
  paused = true; cancelAnimationFrame(raf); audio.pause(); keys.clear(); pointer = null; hideAnnouncement();
  setModal(`<span class="small-caps">A MOMENT BETWEEN STARS</span><h2>잠시, 숨 고르기</h2><p class="intro-copy">${game.stage.name}<br>별들은 여기서 기다리고 있어요.</p><button class="primary" id="resume">계속 날아가기</button><button class="secondary" id="restart">던전 처음부터 다시 시작</button><button class="secondary" id="return">출격 화면으로</button><p class="tiny-note">다시 시작하면 현재 던전의 1스테이지를 생명·화력·점수 초기 상태로 플레이해요.</p>`);
  $('resume').onclick = resumeGame; $('restart').onclick = () => startGame(game.stageIndex); $('return').onclick = showSortie;
}
function resumeGame() { if (!game || !paused) return; paused = false; closeModal(); audio.start(); last = 0; accumulator = 0; raf = requestAnimationFrame(frame); }
function continueFlight() {closeModal();audio.start();renderHud();last=0;accumulator=0;keys.clear();pointer=null;raf=requestAnimationFrame(frame);}
function resolveStageQuiz(reward=null){game.completeQuiz(reward);if(!game.finished)continueFlight();}
function showStageQuiz(kind) {
  hideAnnouncement();keys.clear();pointer=null;
  menus.offerQuiz('퀴즈에 도전하고 보상을 받을까요?', game.room===2?'정답을 맞히면 최종 점수가 10% 증가해요. 건너뛰어도 클리어 보상을 받을 수 있어요.':'정답을 맞히면 생명 1 또는 봄 1을 회복해요. 건너뛰면 바로 다음 스테이지로 이동해요.', ()=>menus.quiz(kind,'퀴즈',correct=>{
    if(!correct){resolveStageQuiz();return;}
    if(game.room===2){resolveStageQuiz('score');return;}
    setModal(`<span class="small-caps">A LITTLE RECOVERY</span><h2>기억이 힘이 되었어요</h2><p class="intro-copy">생명 ${game.player.lives}/${game.maxLife} · 봄 ${game.bombs}/${game.maxBombs}</p><button class="primary" id="reward-life">생명 1 회복</button><button class="secondary" id="reward-bomb">봄 1 회복</button>`);
    $('reward-life').onclick=()=>resolveStageQuiz('life');$('reward-bomb').onclick=()=>resolveStageQuiz('bomb');
  }),()=>resolveStageQuiz());
}
function offerRevive() {
  hideAnnouncement();if(game.reviveUsed)return finish(false);
  setModal(`<span class="small-caps">ONE MORE FLIGHT</span><h2>한 번 더 날아볼까요?</h2><p class="intro-copy">문법 문제를 맞히면 생명 ${Math.min(2,game.maxLife)}으로 부활해요.<br>한 번의 던전 도전에서 기회는 한 번뿐이에요.</p><button class="primary" id="revive-quiz">문법으로 다시 일어나기</button><button class="secondary" id="revive-decline">이번 비행 마치기</button>`);
  $('revive-decline').onclick=()=>{game.revive(false);finish(false);};
  $('revive-quiz').onclick=()=>menus.quiz('grammar','다시 피어나는 별',correct=>{if(game.revive(correct))continueFlight();else finish(false);});
}
function finish(won) {
  hideAnnouncement();
  const ticket=won?claimDungeon(profile,startingStage,difficulty):null;
  const key=bestKey(),old=Number(saved.best?.[key])||0;
  if(!saved.best||typeof saved.best!=='object')saved.best={};
  saved.best[key]=Math.max(old,Math.round(game.score));save();
  const rank=won?(game.stats.deaths===0?'S':game.stats.deaths<4?'A':'B'):'—';
  const message=won?(ticket?'이번 주 첫 클리어! 아티팩트 뽑기권을 받았어요.':'이 던전의 주간 보상은 이미 받았어요. 다른 던전에도 도전해보세요.'):'도서관에서 오답을 복습하고 유물 조합을 바꿔보세요.';
  setModal(`<span class="small-caps">${won?'DUNGEON LIBERATED':'THE STARS WILL WAIT'}</span><h2>${won?DUNGEONS[startingStage].name+' 클리어':'다음 비행을 기다릴게요'}</h2><img class="result-hero" src="${art.urls.heroes[chosenHero]}" alt="${HEROES[chosenHero].name}"><p class="intro-copy">${message}</p><div class="result-score">${Math.round(game.score).toLocaleString()}</div>${game.scoreBonus?`<p class="score-bonus">마지막 퀴즈 +10% · +${game.scoreBonus.toLocaleString()}점</p>`:''}<span class="small-caps">${game.score>old?'NEW PERSONAL BEST':'RANK '+rank} · ${DIFFICULTIES.find(d=>d.id===difficulty).name}</span><div class="result-grid"><div><small>최고 콤보</small><b>${game.bestCombo}</b></div><div><small>스침 보너스</small><b>${game.graze}</b></div><div><small>도달 스테이지</small><b>${game.room+1}/3</b></div></div><button class="primary" id="again">던전 처음부터 다시 도전</button><button class="secondary" id="sortie-return">출격 준비로</button><p class="save-note">${storageAvailable?'기록과 수집 현황을 이 기기에 저장했어요.':'이 환경에서는 기록을 저장할 수 없어요. 현재 실행 중에는 계속 플레이할 수 있어요.'}</p>`);
  $('again').onclick=()=>startGame(startingStage);$('sortie-return').onclick=showSortie;
}
$('pause').onclick = pauseGame;
$('bomb').onclick = () => { if (!paused) game?.bomb(); };
world.addEventListener('pointerdown', event => {
  if (!game || paused || game.finished || game.phase === 'quiz' || pointer) return;
  event.preventDefault(); world.setPointerCapture(event.pointerId);
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; audio.start();
});
world.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id || !game || paused) return; event.preventDefault();
  const rect = world.getBoundingClientRect();
  game.move(game.player.targetX + (event.clientX - pointer.x) * 450 / rect.width, game.player.targetY + (event.clientY - pointer.y) * game.height / rect.height);
  pointer.x = event.clientX; pointer.y = event.clientY;
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) world.addEventListener(name, e => { if (pointer?.id === e.pointerId) pointer = null; });
document.addEventListener('keydown', event => {
  if (!game) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(event.key)) event.preventDefault();
  if (event.key === 'Escape') { if (paused) resumeGame(); else pauseGame(); return; }
  if (paused || !modal.hidden) return;
  if (event.key === ' ' && !event.repeat) game.bomb(); keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});
document.addEventListener('keyup', event => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseGame(); audio.pause(); } });
window.addEventListener('blur', () => { keys.clear(); pointer = null; });
window.addEventListener('resize', () => {
  if (!renderer || world.style.display === 'none') return;
  const previousHeight = renderer.height; renderer.resize();
  if (game) { const ratio = renderer.height / previousHeight; game.height = renderer.height; game.player.y *= ratio; game.player.targetY = game.player.y; game.move(game.player.x, game.player.y); }
});
// Read-only telemetry for diagnostics, including offline/browser regression checks.
Object.defineProperty(globalThis, 'astralDiagnostics', { get() { return {
  ready: !!art, phase: game?.phase || 'sortie', hero: chosenHero, random: chosenRandom, weapon: chosenWeapon, stage: game?.stageIndex ?? chosenStage,
  paused, score: game?.score || 0, power: game?.power || 0, bombs: game?.bombs ?? 0, lives: game?.player.lives ?? 0, maxLife:game?.maxLife, room:game?.room, difficulty, reviveUsed:game?.reviveUsed, maskUses:game?.maskUses,
  player: game ? { x: game.player.x, y: game.player.y } : null, bullets: game?.bullets.length || 0,
  frames: frameSamples.length, fps: frameSamples.length ? Math.round(frameSamples.length / frameSamples.reduce((a, b) => a + b, 0)) : 0,
  quality: renderer?.quality, stats: game ? { ...game.stats } : null, storageAvailable, audioState: audio.context?.state || 'idle'
}; } });
async function boot() { try {
  art = await loadArt(); renderer = new Renderer(world, art);menus=new CampaignUI({profile,save,setModal,closeModal,toast,art}); $('loading').hidden = true; showSortie();
} catch (error) {
  $('loading').innerHTML = `<div class="loading-sigil">✧</div><h1>별빛을 불러오지 못했어요</h1><p>파일을 다시 열어주세요.</p><span id="load-error"></span>`;
  $('load-error').textContent = error.message;
} }
boot();
