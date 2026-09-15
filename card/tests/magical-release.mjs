import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const browser = await chromium.launch();
const url = new URL('../dist/DREAMWEAVER.html',import.meta.url).href;
const errors = [];
const shot = name => fileURLToPath(new URL(`../test-results/release-${name}.png`,import.meta.url));
const closeDialogs = page => page.evaluate(() => document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active')));
async function contrast(page,textSelector,surfaceSelector) {
  const {ink,paints} = await page.locator(textSelector).first().evaluate((el,selector) => {
    const css = getComputedStyle(document.querySelector(selector));
    return {ink:getComputedStyle(el).color,paints:css.backgroundImage.includes('gradient') ? css.backgroundImage.match(/rgba?\([^)]+\)/g) : [css.backgroundColor]};
  },surfaceSelector);
  const lum = text => text.match(/[\d.]+/g).slice(0,3).map(Number).map(v => v/255).map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
  for (const paint of paints) assert.ok((Math.max(lum(ink),lum(paint))+.05)/(Math.min(lum(ink),lum(paint))+.05)>=4.5,`${textSelector}: ${ink} on ${paint}`);
}
try {
  for (const size of [{width:360,height:640},{width:390,height:844},{width:412,height:915}]) {
    const page = await browser.newPage({viewport:size,reducedMotion:'reduce'});
    page.on('pageerror',e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => Astra.ready);
    const music = await page.evaluate(() => CARD_MUSIC_TRACKS.map(({title,artist,album,src}) => ({title,artist,album,src})));
    assert.ok(music.some(t => t.src === 'レモネード、自分で絞った.mp3'));
    assert.ok(music.every(t => t.artist === 'DREAMWEAVER' && t.album === 'Dream Sessions'));
    for (const theme of ['astra','strawberry','dreamsky']) {
      await closeDialogs(page);
      await page.evaluate(theme => {
        Astra.setTheme(theme); RPG.loadGlobalData();
        Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:20,enemyScale:0,deck:['marshmallow','kobold','golem'],inventory:['marshmallow','kobold','golem'],artifacts:[]});
        RPG.toMenu();
      },theme);
      await page.evaluate(() => document.fonts.ready);
      const draw = await page.locator('#btn-challenge-gacha').boundingBox();
      const nav = await page.locator('.astra-nav').boundingBox();
      assert.ok(draw.y+draw.height<=nav.y,`Draw visible without scrolling at ${theme}/${size.width}: ${JSON.stringify({draw,nav})}`);
      await page.evaluate(() => { RPG.state.deck=GameUtils.getAllCards().toSorted((a,b) => b.name.length-a.name.length).slice(0,3).map(card => card.id); Astra.renderParty(); });
      const longNameDraw = await page.locator('#btn-challenge-gacha').boundingBox();
      assert.ok(longNameDraw.y+longNameDraw.height<=nav.y,'Long card names do not push draws off screen');
      assert.equal(await page.locator('.party-showcase .text-button').count(),0);
      assert.equal(await page.locator('#screen-menu').evaluate(el => getComputedStyle(el).scrollbarWidth),'thin');
      if (theme === 'strawberry') {
        await page.waitForFunction(() => document.querySelector('.party-card img')?.src.startsWith('data:image/png') && document.querySelector('.party-card img').naturalHeight>0);
        assert.ok(await page.evaluate(() => document.fonts.check('16px DreamJua')));
      }
      await page.screenshot({path:shot(`${theme}-lobby-${size.width}`)});
      await page.evaluate(() => RPG.openCardPoolViewer());
      assert.ok(await page.locator('#card-pool-grid button[data-grade]').count()>0);
      assert.equal(await page.locator('#card-pool-grid .card-meta').first().textContent().then(t => t.includes('풀 카드')),true);
      const pool = await page.locator('#card-pool-grid .portrait').first().boundingBox();
      assert.ok(Math.abs(pool.width/pool.height-.6)<.01);
      assert.equal(await page.locator('#card-pool-grid .card-grade').count(),0);
      await page.locator('#card-pool-grid .card-item').first().click();
      assert.ok(await page.locator('#modal-card').isVisible());
      await closeDialogs(page);
      await page.evaluate(() => RPG.openMissionHub());
      await contrast(page,'#mission-hub-list button','#mission-hub-list button');
      await contrast(page,'#mission-hub-list button span','#mission-hub-list button');
      await page.locator('#mission-hub-list button').first().click();
      assert.ok(await page.locator('.mission-reward-showcase:visible .reward-card-preview').isVisible());
      assert.ok(await page.locator('.reward-progress:visible progress').count()===1);
      const close = await page.locator('#modal-monthly-mission .modal-content>button').boundingBox();
      assert.ok(close.y+close.height<=size.height,'Mission close button stays visible');
      await page.screenshot({path:shot(`${theme}-mission-${size.width}`)});
      await page.locator('.reward-card-preview:visible').click();
      assert.ok(await page.locator('#md-name').textContent());
      await closeDialogs(page);
      await page.evaluate(() => { RPG.global.unlocked_special_cards=SPECIAL_CARDS.map(card => card.id); RPG.openSpecialCardEditor(); });
      await contrast(page,'.special-card-option>div:first-child','.special-card-option');
      await page.screenshot({path:shot(`${theme}-special-${size.width}`)});
      await closeDialogs(page);
      await page.evaluate(() => {
        // Deterministic listening fixture, no API/audio request needed for panel paint.
        document.getElementById('modal-fortune-cookie').classList.add('active');
        document.querySelectorAll('#modal-fortune-cookie [id$="-phase"]').forEach(el => el.style.display='none');
        document.getElementById('fortune-listening-phase').style.display='flex';
        document.getElementById('fortune-part-tip').textContent='질문을 듣고 가장 적절한 응답을 고르세요.';
      });
      await contrast(page,'#fortune-part-tip','.fortune-audio-panel');
      await page.screenshot({path:shot(`${theme}-fortune-${size.width}`)});
      await page.evaluate(() => {
        document.getElementById('fortune-listening-phase').style.display='none';
        document.getElementById('fortune-multi-hub-phase').style.display='flex';
      });
      await contrast(page,'#fortune-multi-hub-phase>div:not([id]):not(.fortune-audio-panel)','#modal-fortune-cookie .modal-content');
      await page.evaluate(() => {
        document.getElementById('fortune-multi-hub-phase').style.display='none';
        FortuneCookie.currentSet={passage:'Read the notice.',passageKo:'공지를 읽으세요.',questions:[{questionText:'When?',questionTextKo:'언제?',options:['Today','Tomorrow','Friday'],optionsKo:['오늘','내일','금요일'],answer:0}]};
        FortuneCookie.currentMultiSession={results:[{isCorrect:false,userAnswer:1}]};
        FortuneCookie.showExplanation();
      });
      for (const selector of ['#fortune-explanation-scroll>div:first-child>div:first-child','#fortune-explanation-scroll>div:first-child>div:last-child','#fortune-explanation-scroll>div:last-child span']) await contrast(page,selector,'#fortune-explanation-scroll');
      await page.screenshot({path:shot(`${theme}-fortune-explanation-${size.width}`)});
      await page.evaluate(() => FortuneCookie.showFortunePhase({grade:'길',dateStr:'2026-09-16',message:'오늘의 작은 행운을 발견해 보세요.'}));
      await contrast(page,'#fortune-result-message','#fortune-result-message');
      await page.screenshot({path:shot(`${theme}-fortune-result-${size.width}`)});
      await closeDialogs(page);
      for (const type of ['endless','challenge']) {
        await page.evaluate(type => {
          RPG.tempGameType=type;
          RPG.global.hardChallengeCleared={restriction:true};
          RPG.openModeSelect();
        },type);
        const title = await page.locator('.mode-select-heading h3').boundingBox();
        const action = await page.locator(type==='endless' ? '#btn-chaos-roulette' : '#btn-hard-mode').boundingBox();
        assert.ok(title.x+title.width<=action.x || title.y+title.height<=action.y,'Mode header never overlaps');
        if (type==='challenge') {
          assert.equal(await page.locator('#mode-btn-restriction .hard-clear-badge').textContent(),'✦ HARD CLEAR');
          assert.equal(await page.locator('#mode-btn-balance .hard-clear-badge').count(),0);
          await contrast(page,'#mode-btn-restriction','#mode-btn-restriction');
          await page.locator('#btn-hard-mode').click();
          assert.equal(await page.locator('#btn-hard-mode').getAttribute('aria-pressed'),'true');
        }
        await page.locator('#mode-btn-chaos').click();
        assert.ok((await page.locator('#mode-desc').textContent()).includes('런 실패'));
        await page.screenshot({path:shot(`${theme}-${type}-${size.width}`)});
        await closeDialogs(page);
      }
    }
    // Fallback art can be switched repeatedly; a loaded local portrait remains untouched.
    await page.evaluate(() => { RPG.toMenu(); Astra.setTheme('strawberry'); });
    await page.waitForFunction(() => document.querySelector('.party-card img').naturalWidth>0);
    for (const theme of ['dreamsky','astra','strawberry']) {
      await page.evaluate(theme => Astra.setTheme(theme),theme);
      await page.waitForFunction(theme => document.querySelector('.party-card img').src.startsWith(theme==='strawberry' ? 'data:image/png' : 'data:image/svg+xml'),theme);
    }
    await page.evaluate(() => {
      const card=RPG.getCardData(RPG.state.deck[0]);
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#b3cddd"/></svg>';
      Astra.localPortraits.set(ImageAssets.getEntitySource(card).normalize('NFC'),URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})));
      Astra.renderParty();
    });
    await page.waitForFunction(() => document.querySelector('.party-card img').naturalHeight===500);
    const portraitSrc=await page.locator('.party-card img').first().getAttribute('src');
    await page.evaluate(() => Astra.setTheme('dreamsky'));
    assert.equal(await page.locator('.party-card img').first().getAttribute('src'),portraitSrc,'Theme keeps a loaded local portrait');
    const traitLogs=await page.evaluate(() => {
      Object.assign(RPG.state,{mode:'origin',deck:['sakura','golem','kobold'],inventory:['sakura','golem','kobold'],artifacts:[]});
      RPG.startBattleInit();
      return ['nature','dark','water'].map(element => {
        RPG.battle.enemy.element=element;
        const logs=[];
        Logic.calculateDamage(RPG.battle.players[0],RPG.battle.enemy,RPG.NORMAL_ATTACK,[],[],msg => logs.push(msg),'origin',RPG.battle.players,1,[]);
        return logs.filter(log => log.includes('사쿠라'));
      });
    });
    assert.ok(traitLogs[0].some(log => log.includes('자연 속성')));
    assert.ok(traitLogs[1].some(log => log.includes('어둠 속성')));
    assert.equal(traitLogs[2].length,0);
    await page.evaluate(() => {
      RPG.global.hardChallengeCleared={};
      Object.assign(RPG.state,{mode:'restriction',gameType:'challenge',hardMode:true});
      RPG.finishWinBattle('',true,null);
      Object.assign(RPG.state,{mode:'balance',hardMode:false});
      RPG.finishWinBattle('',true,null);
    });
    await page.reload(); await page.waitForFunction(() => Astra.ready);
    await page.evaluate(() => { RPG.loadGlobalData(); RPG.tempGameType='challenge'; RPG.openModeSelect(); });
    assert.equal(await page.locator('#mode-btn-restriction .hard-clear-badge').count(),1,'Real hard clear survives reload');
    assert.equal(await page.locator('#mode-btn-balance .hard-clear-badge').count(),0,'Normal clear does not earn a hard badge');
    await page.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS compact lobby, pool frames, theme assets/font switching, music tags, mission/special/fortune contrast and mode achievement headers at 360/390/412px');
} finally { await browser.close(); }
