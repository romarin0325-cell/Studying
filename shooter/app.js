import { HEROES, STAGES, UPGRADES, clamp } from './content.js';
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
let chosenHero = clamp(Number(preferences.hero) || 0, 0, 3), chosenWeapon = 0, chosenStage = 0;
let difficulty = preferences.mode === 'relaxed' ? 'relaxed' : 'normal';
audio.enabled = preferences.sound !== false;
let art, renderer, game = null, paused = false, raf = 0, last = 0, accumulator = 0, hudTimer = 0;
let announcementTimer = 0, toastTimer = 0, pointer = null, keys = new Set(), frameSamples = [], startingStage = 0;
let runCount = 0;
function save() {
  saved.settings = { hero: chosenHero, mode: difficulty, sound: audio.enabled };
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
function bestKey() { return `${difficulty}-${chosenStage}`; }
function showSortie() {
  cancelAnimationFrame(raf); game = null; paused = false; keys.clear(); pointer = null; audio.boss = false;
  hideAnnouncement(); closeModal(); hud.hidden = true; world.style.display = 'none'; screen.hidden = false;
  const hero = HEROES[chosenHero], stage = STAGES[chosenStage];
  app.style.setProperty('--accent', hero.color); app.style.setProperty('--scene', `url("${art.urls.worlds[chosenStage]}")`);
  $('ambient').style.backgroundImage = `url("${art.urls.worlds[chosenStage]}")`;
  screen.innerHTML = `<section class="sortie">
    <header class="masthead"><div class="brand"><i>✧</i> ASTRAL BLOOM</div><div class="masthead-actions"><button class="round-button" id="help" aria-label="플레이 방법">?</button><button class="round-button sound-toggle" aria-label="소리 끄기">♪</button></div></header>
    <div class="sortie-top"><div class="hero-heading"><span class="small-caps">${hero.title}</span><h1>${hero.name}</h1><span class="english-name">${hero.en}</span></div><span class="hero-index">0${chosenHero + 1}</span><div class="hero-aura"></div><img class="hero-large" src="${art.urls.heroes[chosenHero]}" alt="${hero.name}의 SD 일러스트"><p class="hero-quote">“${hero.quote}”</p></div>
    <div class="sortie-controls"><nav class="roster" aria-label="캐릭터 선택">${HEROES.map((h, i) => `<button class="${i === chosenHero ? 'active' : ''}" data-hero="${i}" aria-label="${h.name} 선택" aria-pressed="${i === chosenHero}"><img src="${art.urls.heroes[i]}" alt=""><span>${h.name}</span></button>`).join('')}</nav>
    <div class="section-heading"><h2>공격 스타일</h2><small>두 가지 빛, 서로 다른 궤적</small></div>
    <div class="weapons">${hero.weapons.map((w, i) => `<button class="weapon-card ${i === chosenWeapon ? 'selected' : ''}" data-weapon="${i}" aria-pressed="${i === chosenWeapon}"><strong>${w.name}</strong><small>${w.tag}</small></button>`).join('')}</div>
    <p class="weapon-description">${hero.weapons[chosenWeapon].description}</p>
    <nav class="route" aria-label="시작 스테이지"><span class="route-label">${chosenStage === 0 ? 'STORY / 네 개의 하늘' : `PRACTICE / ${stage.name}`}</span>${STAGES.map((s, i) => `<button data-stage="${i}" class="${i === chosenStage ? 'selected' : ''}" aria-label="${i + 1}스테이지 ${s.name}, 보스 ${s.boss}" aria-pressed="${i === chosenStage}">0${i + 1}</button>`).join('')}</nav>
    <button class="launch" id="launch">${chosenStage === 0 ? '별빛을 따라 출격' : `${chosenStage + 1}스테이지 연습 출격`}<span>FLY INTO THE NIGHT</span><b>→</b></button>
    <div class="footer-note"><button class="mode-button" id="mode">난이도 <b>${difficulty === 'relaxed' ? '편안하게' : '오리지널'}</b> ⌄</button><span>BEST ${Number(saved.best?.[bestKey()] || 0).toLocaleString()} · OFFLINE</span></div></div>
  </section>`;
  screen.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { chosenHero = Number(b.dataset.hero); chosenWeapon = 0; save(); showSortie(); });
  screen.querySelectorAll('[data-weapon]').forEach(b => b.onclick = () => { chosenWeapon = Number(b.dataset.weapon); showSortie(); });
  screen.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { chosenStage = Number(b.dataset.stage); showSortie(); });
  $('mode').onclick = () => { difficulty = difficulty === 'normal' ? 'relaxed' : 'normal'; save(); showSortie(); toast(difficulty === 'relaxed' ? '적탄이 느려지고 생명이 늘어나요' : '오리지널 탄속 · 생명 5'); };
  $('help').onclick = () => showHelp(false);
  $('launch').onclick = () => { audio.start(); if (!saved.tutorial) showHelp(true); else startGame(); };
  bindSounds();
}
function showHelp(launchAfter) {
  const hero = HEROES[chosenHero];
  setModal(`<span class="small-caps">YOUR FIRST FLIGHT</span><h2>별의 잔향</h2><p class="intro-copy">네 명의 수호자, 네 개의 하늘.<br>손끝으로 작은 빛을 지켜주세요.</p>
    <div class="help-list"><div><em>↔</em><span><b>손가락을 편하게 드래그</b>누른 위치에서 움직인 만큼 이동해요. 공격은 자동이에요.</span></div><div><em><i class="core-dot"></i></em><span><b>중앙의 작은 코어만 조심</b>머리와 망토에는 맞아도 괜찮아요. 가까이 피하면 점수 보너스!</span></div><div><em>❖</em><span><b>${hero.bomb}</b>${hero.bombInfo}</span></div><div><em>✦</em><span><b>파워업과 보물 수집</b>P 세 개마다 화력 상승. 화면 위쪽으로 가면 보물이 모여요.</span></div></div>
    <p class="tiny-note">키보드: 방향키 / WASD 이동 · Shift 정밀 이동 · Space 봄 · Esc 일시정지<br>4개 스테이지를 이어서 플레이하거나, 출격 화면의 숫자로 연습할 수 있어요.</p>
    <button class="primary" id="help-done">${launchAfter ? '준비됐어요 · 출격' : '알겠어요'}</button>`);
  $('help-done').onclick = () => { saved.tutorial = true; save(); closeModal(); if (launchAfter) startGame(); };
}
function startGame(stage = chosenStage) {
  cancelAnimationFrame(raf); closeModal(); hideAnnouncement(); audio.start();
  screen.hidden = true; hud.hidden = false; world.style.display = 'block'; renderer.resize();
  paused = false; keys.clear(); pointer = null; accumulator = 0; last = 0; frameSamples = []; startingStage = stage;
  game = new Game({ hero: chosenHero, weapon: chosenWeapon, stage, height: renderer.height, mode: difficulty, seed: 1471 + ++runCount, onEvent: handleEvent });
  $('weapon-label').textContent = HEROES[chosenHero].weapons[chosenWeapon].name;
  $('bomb-label').textContent = HEROES[chosenHero].bomb;
  app.style.setProperty('--accent', HEROES[chosenHero].color);
  renderHud(); bindSounds(); raf = requestAnimationFrame(frame);
}
function handleEvent(event) {
  audio.event(event); renderer?.feedback(event.type);
  if (event.type === 'stage') {
    audio.stage = event.stage; audio.boss = false;
    $('stage-label').textContent = `${String(event.stage + 1).padStart(2, '0')} / ${STAGES[event.stage].en}`;
    $('ambient').style.backgroundImage = `url("${art.urls.worlds[event.stage]}")`;
    announce(`CHAPTER 0${event.stage + 1}`, STAGES[event.stage].name, event.stage === 0 ? '작은 별 하나가, 긴 밤을 건너갑니다.' : '다음 하늘에도, 우리의 빛이 닿기를.');
  }
  if (event.type === 'warning') { audio.boss = true; announce('GUARDIAN APPROACHING', STAGES[game.stageIndex].boss, `“${game.stage.intro}”`, 2900); }
  if (event.type === 'pattern') { $('pattern-name').textContent = event.name; if (event.phase > 0) toast(`✧ ${event.name}`); }
  if (event.type === 'bomb') announce('ASTRAL BLOOM', HEROES[event.hero].bomb, '', 1800, true);
  if (event.type === 'powerup') toast(`✦ SHOT POWER ${game.power}`);
  if (event.type === 'heal') toast('♡ 생명 회복');
  if (event.type === 'bossDefeated') { audio.boss = false; announce('SKY LIBERATED', '하늘을 되찾았어요', `“${game.stage.outro}”`, 3000); }
  if (event.type === 'upgrade') showUpgrades();
  if (event.type === 'defeat' || event.type === 'victory') finish(event.type === 'victory');
}
function renderHud() {
  if (!game) return;
  $('score').textContent = String(Math.round(game.score)).padStart(6, '0');
  const lives = String(game.player.lives); if ($('lives').dataset.value !== lives) { $('lives').dataset.value = lives; $('lives').innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="${i < game.player.lives ? '' : 'empty'}"></span>`).join(''); $('lives').setAttribute('aria-label', `생명 ${lives}`); }
  const power = String(game.power); if ($('power').dataset.value !== power) { $('power').dataset.value = power; $('power').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < game.power ? 'on' : ''}"></i>`).join(''); }
  $('bomb-count').textContent = String(game.bombs); $('bomb').disabled = game.bombs <= 0 || !['wave', 'boss', 'warning'].includes(game.phase);
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
  if (keys.size && !game.finished && game.phase !== 'upgrade') {
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
  if (!paused && !game.finished && game.phase !== 'upgrade') raf = requestAnimationFrame(frame);
}
function pauseGame() {
  if (!game || game.finished || game.phase === 'upgrade' || paused) return;
  paused = true; cancelAnimationFrame(raf); audio.pause(); keys.clear(); pointer = null; hideAnnouncement();
  setModal(`<span class="small-caps">A MOMENT BETWEEN STARS</span><h2>잠시, 숨 고르기</h2><p class="intro-copy">${game.stage.name}<br>별들은 여기서 기다리고 있어요.</p><button class="primary" id="resume">계속 날아가기</button><button class="secondary" id="restart">이 스테이지 다시 시작</button><button class="secondary" id="return">출격 화면으로</button><p class="tiny-note">다시 시작하면 현재 스테이지를 생명·화력·점수 초기 상태로 플레이해요.</p>`);
  $('resume').onclick = resumeGame; $('restart').onclick = () => startGame(game.stageIndex); $('return').onclick = showSortie;
}
function resumeGame() { if (!game || !paused) return; paused = false; closeModal(); audio.start(); last = 0; accumulator = 0; raf = requestAnimationFrame(frame); }
function showUpgrades() {
  hideAnnouncement();
  setModal(`<span class="small-caps">CHAPTER 0${game.stageIndex + 1} COMPLETE</span><h2>별이 남긴 선물</h2><p class="intro-copy">다음 하늘로 가져갈 축복을 골라주세요.<br>생명 ${game.player.lives} · 봄 ${game.bombs} · 점수 ${game.score.toLocaleString()}</p>${UPGRADES.map(u => `<button class="upgrade" data-upgrade="${u.id}"><span class="symbol">${u.icon}</span><span><b>${u.name}</b><small>${u.text}</small><em>${u.detail}</em></span></button>`).join('')}`);
  modal.querySelectorAll('[data-upgrade]').forEach(button => button.onclick = () => { closeModal(); audio.start(); game.chooseUpgrade(button.dataset.upgrade); renderHud(); last = 0; accumulator = 0; raf = requestAnimationFrame(frame); });
}
function finish(won) {
  hideAnnouncement();
  const key = `${difficulty}-${startingStage}`, old = Number(saved.best?.[key]) || 0;
  if (!saved.best || typeof saved.best !== 'object') saved.best = {};
  saved.best[key] = Math.max(old, Math.round(game.score)); saved.lastHero = chosenHero; if (won && startingStage === 0) saved.cleared = true; save();
  const rank = won ? game.stats.deaths === 0 ? 'S' : game.stats.deaths < 4 ? 'A' : 'B' : '✧';
  setModal(`<span class="small-caps">${won ? startingStage === 0 ? 'ALL SKIES LIBERATED' : 'PRACTICE COMPLETE' : 'THE STARS WILL WAIT'}</span><h2>${won ? '밤의 끝에서, 다시 피다' : '아직, 끝나지 않은 별'}</h2><img class="result-hero" src="${art.urls.heroes[chosenHero]}" alt="${HEROES[chosenHero].name}"><p class="intro-copy">${won ? '네가 지킨 작은 빛들이 새로운 새벽이 되었어요.' : '괜찮아요. 다음 비행은 조금 더 멀리 갈 거예요.'}</p><div class="result-score">${Math.round(game.score).toLocaleString()}</div><span class="small-caps">${game.score > old ? 'NEW PERSONAL BEST' : `RANK ${rank}`} · ${difficulty === 'relaxed' ? 'RELAXED' : 'ORIGINAL'}</span><div class="result-grid"><div><small>최고 콤보</small><b>${game.bestCombo}</b></div><div><small>스침 보너스</small><b>${game.graze}</b></div><div><small>되찾은 하늘</small><b>${game.stats.bossKills}</b></div></div><button class="primary" id="again">${won ? '다시 날아오르기' : '이 스테이지 다시 도전'}</button><button class="secondary" id="sortie-return">다른 수호자와 출격</button><p class="save-note">${storageAvailable ? '최고 기록을 이 기기에 저장했어요.' : '이 환경에서는 기록을 저장할 수 없어요. 플레이는 계속할 수 있어요.'}</p>`);
  $('again').onclick = () => startGame(won ? startingStage : game.stageIndex); $('sortie-return').onclick = showSortie;
}
$('pause').onclick = pauseGame;
$('bomb').onclick = () => { if (!paused) game?.bomb(); };
world.addEventListener('pointerdown', event => {
  if (!game || paused || game.finished || game.phase === 'upgrade' || pointer) return;
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
  ready: !!art, phase: game?.phase || 'sortie', hero: chosenHero, weapon: chosenWeapon, stage: game?.stageIndex ?? chosenStage,
  paused, score: game?.score || 0, power: game?.power || 0, bombs: game?.bombs ?? 0, lives: game?.player.lives ?? 0,
  player: game ? { x: game.player.x, y: game.player.y } : null, bullets: game?.bullets.length || 0,
  frames: frameSamples.length, fps: frameSamples.length ? Math.round(frameSamples.length / frameSamples.reduce((a, b) => a + b, 0)) : 0,
  quality: renderer?.quality, stats: game ? { ...game.stats } : null, storageAvailable, audioState: audio.context?.state || 'idle'
}; } });
async function boot() { try {
  art = await loadArt(); renderer = new Renderer(world, art); $('loading').hidden = true; showSortie();
} catch (error) {
  $('loading').innerHTML = `<div class="loading-sigil">✧</div><h1>별빛을 불러오지 못했어요</h1><p>파일을 다시 열어주세요.</p><span id="load-error"></span>`;
  $('load-error').textContent = error.message;
} }
boot();
