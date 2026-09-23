const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'starward-experience-'));
const url = pathToFileURL(path.resolve(__dirname, '../defense/dist-local/HeroCoreDefense.html')).href;
const state = page => page.evaluate(() => __heroDefenseV2Debug.getState().battle?.snapshot);
const click = (page, action) => page.locator('[data-action="' + action + '"]').click();
async function boardPoint(page, point) {
  return page.evaluate(({x, y}) => {
    const layout = __heroDefenseV2Debug.getState().battle.layout;
    const bounds = document.querySelector('#battle-canvas').getBoundingClientRect();
    const view = layout.landscape ? {x:12-y,y:x} : {x,y};
    return {x:bounds.x+layout.boardRect.x+view.x/12*layout.boardRect.width,
      y:bounds.y+layout.boardRect.y+view.y/12*layout.boardRect.height};
  }, point);
}
async function assertFits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
    document.documentElement.scrollHeight <= innerHeight+1), true, 'document overflows viewport');
}
async function finishWave(page) {
  for(let i=0;i<90;i++){
    const snapshot = await state(page);
    if(!snapshot || snapshot.phase !== 'WAVE_RUNNING') break;
    await page.evaluate(() => __heroDefenseV2Debug.stepTicks(600));
  }
  await page.waitForTimeout(180);
}
async function grow(page) {
  let snapshot = await state(page);
  while(snapshot.crystals > 0 && snapshot.heroes.some(h=>h.level<6)) {
    const hero = [...snapshot.heroes].filter(h=>h.level<6).sort((a,b)=>a.level-b.level)[0];
    await page.locator('[data-grow-hero="' + hero.id + '"]').click();
    if([3,5].includes(hero.level)) {
      await page.locator('[data-level-trait]').first().click();
    }
    const next = await state(page);
    assert.equal(next.heroes.find(h=>h.id===hero.id).level,hero.level+1);
    snapshot = next;
  }
}
async function verifyTacticalUI(browser) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
    const NativeAudio=window.AudioContext;
    window.AudioContext=class extends NativeAudio {
      constructor(...args) { super(...args); window.__audioProbe=this; }
      createGain() {
        const gain=super.createGain();
        if(!this.probe) { this.masterProbe=gain; this.probe=this.createAnalyser(); gain.connect(this.probe); }
        return gain;
      }
    };
  });
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url); await page.waitForFunction(()=>Boolean(globalThis.__heroDefenseV2Debug));
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    let original;
    for(const stage of ['ancient_ruins','crossroads','long_boulevard','fairy_forest','sunken_temple','chaos_rift']) {
      await page.locator('[data-stage="'+stage+'"]').click();
      const bounds=await page.locator('.journey-scene').boundingBox();
      original??=bounds;
      assert.ok(Math.abs(bounds.height-original.height)<1 && Math.abs(bounds.y-original.y)<1,'stage copy moves the main art');
      await assertFits(page);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await click(page,'guide');
  assert.equal(await page.locator('.matchup-table:not([data-element-table]) tbody td').count(),36);
  assert.equal(await page.locator('[data-element-table] tbody td').count(),25);
  assert.equal(await page.locator('.placement-guide').count(),0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-field-guide]').count(),0);
  await click(page,'fullscreen');
  await page.waitForFunction(()=>Boolean(document.fullscreenElement));
  assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),true);
  await click(page,'fullscreen');
  await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)),false);
  await page.waitForTimeout(500);
  const audio=await page.evaluate(()=>{
    const ctx=window.__audioProbe,data=new Float32Array(ctx.probe.fftSize);
    ctx.probe.getFloatTimeDomainData(data);
    return {state:ctx.state,peak:Math.max(...data.map(Math.abs))};
  });
  assert.equal(audio.state,'running'); assert.ok(audio.peak>0 && audio.peak<1,'audio graph is silent or clipping');
  await click(page,'settings'); await page.locator('[data-setting="music"]').uncheck(); await page.locator('[data-setting="sound"]').uncheck();
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(()=>__heroDefenseV2Debug.getState().settings.music),false);
  assert.ok(await page.evaluate(()=>__audioProbe.masterProbe.gain.value<.001));
  await click(page,'close-settings');
  await page.locator('[data-stage="ancient_ruins"]').click();
  await page.screenshot({path:path.join(output,'tactics-menu.png')});
  await click(page,'formation');
  assert.equal(await page.locator('[data-position="normal"]').count(),16);
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-portrait]')].every(c=>c.dataset.portraitSource==='atlas'));
  for(const id of ['red_dragon','flame_sage','mushroom_king','great_detective','siren','phantom','galaxy_whale','silver_rabbit','ancient_dragon','time_ruler']) {
    await page.locator('[data-hero-id="'+id+'"] [data-action="select"]').click();
    assert.equal(await page.locator('[data-replace]').count(),4);
    await page.locator('[data-replace]').first().click();
    assert.equal(await page.locator('[data-position="normal"].selected').count(),4);
    assert.equal(await page.locator('[data-hero-id="'+id+'"] [data-action="select"]').getAttribute('aria-pressed'),'true');
  }
  await page.screenshot({path:path.join(output,'tactics-roster.png')});
  await click(page,'ready'); await click(page,'auto-place');
  assert.equal((await state(page)).heroes.length,5);
  await page.screenshot({path:path.join(output,'tactics-placement.png')});
  await click(page,'start-wave'); await page.evaluate(()=>__heroDefenseV2Debug.stepTicks(400));
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(output,'tactics-battle.png')});
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('Tactical UI: six stable chapters, 36 attack matchups, 25 element matchups, 16 companions, ten swaps, fullscreen, audio/mute and new roster combat passed');
}

async function verifyAuraSheets(browser) {
  const {BattleSession}=await import('../defense/js/battle/BattleSession.js');
  const {createCheckpointFromState}=await import('../defense/js/battle/BattleState.js');
  const {auraConnections}=await import('../defense/js/battle/systems/AuraSystem.js');
  const {SAVE_KEYS_V2}=await import('../defense/js/persistence/schemas.js');
  const session=new BattleSession({stageId:'ancient_ruins',seed:'aura-ui',
    formation:{mainId:'queen',heroIds:['flame_sage','siren','time_ruler','silver_rabbit']}});
  session.applyNow('auto_place');
  const expected=['flame_sage','siren'].map(id=>({id,...auraConnections(session.state,session.state.heroes.find(h=>h.id===id))}));
  const checkpoint=createCheckpointFromState(session.state); session.destroy();
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
  await context.addInitScript(({key,checkpoint})=>localStorage.setItem(key,JSON.stringify(checkpoint)),{key:SAVE_KEYS_V2.checkpoint,checkpoint});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(url); await click(page,'continue');
    for(const hero of expected) {
      await page.locator('[data-hero-card="'+hero.id+'"]').click();
      await click(page,'hero-details');
      const text=await page.locator('[data-sheet-body]').innerText();
      for(const aura of hero.provided) {
        assert.ok(aura.recipients.length>0,'fixture must exercise an active innate aura');
        assert.ok(text.includes(aura.displayName) && text.includes(aura.description));
        for(const name of aura.recipientNames) assert.ok(text.includes(name),'missing actual recipient '+name);
      }
      for(const aura of hero.received) for(const name of aura.sourceNames)
        assert.ok(text.includes('제공 · '+aura.sourceNames.join(', ')),'missing actual provider '+name);
      await page.screenshot({path:path.join(output,hero.id+'-aura-sheet.png')});
      await click(page,'close-sheet');
    }
    await page.locator('[data-hero-card="time_ruler"]').click();
    await click(page,'hero-details');
    assert.match(await page.locator('.sheet-skill').innerText(),/범위 2(?:\D|$)/,'skill radius must use current content');
    assert.deepEqual(errors,[]);
    console.log('Aura sheets: innate Flame Sage/Siren effects, actual providers/recipients and Time Ruler radius passed');
  } finally { await context.close(); }
}

async function verifySixRealmBosses(browser) {
  const {BattleSession}=await import('../defense/js/battle/BattleSession.js');
  const {createCheckpointFromState}=await import('../defense/js/battle/BattleState.js');
  const {STAGES}=await import('../defense/js/content/stages.js');
  const {SAVE_KEYS_V2,validateCheckpoint}=await import('../defense/js/persistence/schemas.js');
  for(const stage of STAGES) {
    const session=new BattleSession({stageId:stage.id,seed:'browser-boss-'+stage.id,
      formation:{mainId:'queen',heroIds:['galaxy_whale','silver_rabbit','ancient_dragon','time_ruler']}});
    session.applyNow('auto_place'); session.state.nextWave=10;
    const checkpoint=createCheckpointFromState(session.state); validateCheckpoint(checkpoint); session.destroy();
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true});
    await context.addInitScript(({key,checkpoint})=>{
      localStorage.setItem(key,JSON.stringify(checkpoint));
      // Advance the real fixed-tick engine explicitly so screenshots capture a
      // reproducible warning; no synthetic boss snapshots or wall-clock races.
      window.requestAnimationFrame=()=>1; window.cancelAnimationFrame=()=>{};
    },{key:SAVE_KEYS_V2.checkpoint,checkpoint});
    const page=await context.newPage(),errors=[],network=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',request=>{if(/^https?:/.test(request.url())) network.push(request.url());});
    await page.goto(url); await click(page,'continue');
    await page.waitForTimeout(400);
    await page.evaluate(()=>__heroDefenseV2Debug.startWave());
    let boss;
    for(let i=0;i<24;i++) {
      await page.evaluate(()=>__heroDefenseV2Debug.stepTicks(30));
      boss=(await state(page)).enemies.find(enemy=>enemy.isBoss);
      if(boss?.bossState?.phase==='windup') break;
    }
    assert.equal(boss?.enemyId,stage.finalBossId);
    assert.equal(boss.bossState.phase,'windup',stage.id+': warning was not observed');
    assert.equal(await page.locator('[data-boss-hud]').isVisible(),true);
    assert.match(await page.locator('[data-boss-action]').innerText(),/기절/);
    assert.deepEqual(await page.evaluate(()=>__heroDefenseV2Debug.getState().mediaFailures),[]);
    await page.waitForTimeout(1700);
    assert.equal(await page.locator('[data-announcement]').isVisible(),false);
    const board=await page.locator('[data-board-shell]').boundingBox();
    const hud=await page.locator('[data-boss-hud]').boundingBox();
    assert.ok(hud.y>=board.y+board.height,'boss HUD must not cover the combat plane');
    await assertFits(page);
    await page.screenshot({path:path.join(output,stage.id+'-boss-warning.png')});
    await click(page,'starfall');
    const aim=await boardPoint(page,boss); await page.mouse.click(aim.x,aim.y);
    await page.evaluate(()=>__heroDefenseV2Debug.stepTicks(1));
    const interrupted=(await state(page)).enemies.find(enemy=>enemy.isBoss);
    assert.equal(interrupted.bossState.interrupted,true,stage.id+': aimed interrupt');
    assert.equal(interrupted.bossState.damageTaken,1.25);
    assert.equal((await state(page)).starfallReady,false);
    await page.setViewportSize({width:844,height:390}); await page.waitForTimeout(150);
    await page.evaluate(()=>__heroDefenseV2Debug.stepTicks(0));
    await assertFits(page);
    const layout=await page.evaluate(()=>__heroDefenseV2Debug.getState().battle.layout);
    assert.equal(layout.landscape,true); assert.equal(layout.boardRect.width,layout.boardRect.height);
    await page.screenshot({path:path.join(output,stage.id+'-boss-landscape.png')});
    await page.setViewportSize({width:320,height:568}); await page.waitForTimeout(120);
    await page.evaluate(()=>__heroDefenseV2Debug.stepTicks(0));
    for(const action of ['starfall','start-wave','pause','speed']) {
      const bounds=await page.locator('[data-action="'+action+'"]').boundingBox();
      assert.ok(bounds && bounds.height>=44 && bounds.y+bounds.height<=569,
        stage.id+': compact-phone action is clipped or too small: '+action);
    }
    await page.screenshot({path:path.join(output,stage.id+'-boss-small-phone.png')});
    assert.deepEqual(errors,[]); assert.deepEqual(network,[]);
    await context.close();
  }
  console.log('Six offline realms: real boss warnings, aimed interrupts, new party, DPR 3 and square rotation passed');
}
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    await verifyTacticalUI(browser);
    await verifyAuraSheets(browser);
    await verifySixRealmBosses(browser);
    for(const difficulty of ['easy','normal']) {
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
      const page=await context.newPage(), errors=[], network=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
      await page.goto(url);
      await page.waitForFunction(()=>Boolean(globalThis.__heroDefenseV2Debug));
      await page.locator('[data-difficulty="'+difficulty+'"]').click();
      await click(page,'formation');
      await page.locator('[data-hero-id="cinderella"] [data-action="select"]').click();
      await click(page,'ready');
      await page.waitForTimeout(500);
      await assertFits(page);
      const before=await state(page);
      assert.equal(before.difficultyId,difficulty);
      const cell=before.stage.placementCells[0];
      const dest=await boardPoint(page,{x:cell.x+.5,y:cell.y+.5});
      const card=await page.locator('[data-hero-card="cinderella"]').boundingBox();
      await page.mouse.move(card.x+card.width/2,card.y+card.height/2);
      await page.mouse.down();
      await page.mouse.move(dest.x,dest.y,{steps:12});
      await page.mouse.up();
      const placed=(await state(page)).heroes.find(h=>h.id==='cinderella');
      assert.equal(placed.placed,true,'drag did not place hero');
      assert.deepEqual({x:placed.x,y:placed.y},{x:cell.x,y:cell.y});
      await click(page,'auto-place');
      await click(page,'start-wave');
      await click(page,'settings');
      assert.equal((await state(page)).paused,true);
      await click(page,'close-settings');
      assert.equal((await state(page)).paused,false);
      await click(page,'pause');
      const paused=await state(page);
      await page.waitForTimeout(250);
      assert.deepEqual((await state(page)).enemies,paused.enemies);
      await click(page,'resume');
      await page.waitForFunction(()=>__heroDefenseV2Debug.getState().battle.snapshot.enemies.length>2);
      await click(page,'starfall');
      const enemy=(await state(page)).enemies[0];
      const aim=await boardPoint(page,{x:enemy.x,y:enemy.y});
      await page.mouse.click(aim.x,aim.y);
      assert.equal((await state(page)).starfallReady,false,'targeted spell not consumed');
      for(let wave=1;wave<=10;wave++) {
        await finishWave(page);
        if(wave===10)break;
        assert.equal((await state(page)).phase,'INTERMISSION');
        await page.locator('[data-growth]:not([hidden])').waitFor();
        await grow(page);
        if(wave===3){
          await page.screenshot({path:path.join(output,difficulty+'-growth.png')});
          const saved=await state(page);
          await page.reload();
          await page.locator('[data-action="continue"]').waitFor();
          await click(page,'continue');
          const restored=await state(page);
          assert.equal(restored.nextWave,saved.nextWave);
          assert.equal(restored.difficultyId,difficulty);
          assert.deepEqual(restored.heroes.map(h=>[h.id,h.level,h.selectedTraits,h.stats]),
            saved.heroes.map(h=>[h.id,h.level,h.selectedTraits,h.stats]));
        }
        await click(page,'growth-next');
      }
      await page.locator('[data-screen="result"]').waitFor();
      assert.match(await page.locator('[data-screen="result"]').innerText(),/수호 성공/);
      await page.waitForTimeout(900);
      assert.ok(await page.locator('.result-stars .earned').count()>0);
      await page.screenshot({path:path.join(output,difficulty+'-result.png')});
      for (const viewport of [{width:320,height:568},{width:844,height:390}]) {
        await page.setViewportSize(viewport);
        await assertFits(page);
        await page.locator('[data-action="stages"]').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,`${difficulty}-result-${viewport.width}.png`)});
      }
      await page.setViewportSize({width:390,height:844});
      await click(page,'stages');
      assert.match(await page.locator('.journey-title').innerText(),/수호 완료/);
      await page.reload();
      if(difficulty==='normal') await page.locator('[data-difficulty="normal"]').click();
      assert.match(await page.locator('.journey-title').innerText(),/수호 완료/);
      assert.deepEqual(errors,[]);
      assert.deepEqual(network,[]);
      console.log('Offline 10-wave '+difficulty+': drag, spell, pause, growth, traits, resume, victory and medals passed');
      await context.close();
    }
    const page=await browser.newPage({viewport:{width:320,height:568}});
    await page.goto(url);
    await page.waitForFunction(()=>Boolean(globalThis.__heroDefenseV2Debug));
    await assertFits(page);
    await click(page,'formation');
    await assertFits(page);
    await click(page,'ready');
    await assertFits(page);
    await page.screenshot({path:path.join(output,'small-phone.png')});
    await page.close();
    console.log('Experience evidence: '+output);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
