import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser = await chromium.launch({headless:true});
const errors = [];
const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
page.on('pageerror',error => errors.push(error.message));
const boot = async () => {
  await page.goto(pathToFileURL(path.join(root,'dist/CardRPG-Astra.html')).href);
  await page.waitForFunction(() => Astra.ready);
  await page.evaluate(() => { localStorage.clear(); RPG.loadGlobalData(); });
};
const dismiss = () => page.evaluate(() => document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active')));
const shot = name => page.screenshot({path:path.join(root,`test-results/${name}.png`)});
try {
  await boot();
  await page.locator('#btn-title-mission').click();
  await page.locator('#mission-hub-list button').filter({hasText:'주간'}).click();
  assert.ok(await page.locator('#monthly-mission-list').innerText());
  await shot('missions-390');
  await dismiss();

  // Check every mode's actual initialization path using the unchanged game API.
  const modes = ['origin','restriction','balance','suffering','puzzle','archive','curse','flood','chaos','artifact_chaos','draft','factory','artifact','artifact_reserve','perfect_plan','dream_corridor'];
  for (const mode of modes) {
    await dismiss();
    const result = await page.evaluate(mode => {
      RPG.tempGameType = ['origin','perfect_plan','dream_corridor'].includes(mode) ? 'endless' : 'challenge';
      RPG.global.unlocked_modes = [mode];
      RPG.initNewGame(mode);
      if (!['factory','artifact_reserve','perfect_plan'].includes(mode)) RPG.toMenu();
      return {mode:RPG.state.mode,screen:document.querySelector('.screen.active')?.id};
    },mode);
    assert.equal(result.mode,mode);
    assert.ok(result.screen,`${mode} has a reachable view`);
    await dismiss();
    if (mode === 'draft') {
      await page.locator('#menu-draft-area button').click();
      assert.ok(await page.locator('#draft-grid .card-item').count() > 0);
      await shot('draft-390');
    }
    if (mode === 'artifact_chaos') {
      assert.equal(await page.locator('#btn-menu-artifact-check').isVisible(),true);
      await page.locator('#btn-menu-artifact-check').click();
      assert.equal(await page.locator('#modal-artifact-check').isVisible(),true);
    }
    if (mode === 'factory') {
      assert.equal(result.screen,'screen-factory-draft');
      await page.locator('#factory-bundle-0').click();
      assert.equal(await page.evaluate(() => RPG.state.factoryDraft.round),2);
    }
    if (mode === 'artifact_reserve') {
      assert.equal(result.screen,'screen-artifact-reserve-draft');
      await page.locator('#artifact-reserve-bundle-0').click();
      assert.equal(await page.evaluate(() => RPG.state.artifactReserveDraft.round),2);
    }
    if (mode === 'perfect_plan') assert.equal(result.screen,'screen-perfect-plan-draft');
  }
  console.log('PASS 16 mode initialization paths, draft cards, factory and artifact reserve selections');

  await boot();
  for (const part of ['part5','part6','part7']) {
    await dismiss();
    const count = await page.evaluate(part => {
      const set = TOEIC_DATA.find(set => set.type === part && set.questions.length);
      RPG.state.completedToeicSets = TOEIC_DATA.filter(item => item.id !== set.id).map(item => item.id);
      window.testToeicComplete = null;
      RPG.startToeicPractice({ignoreSessionLimit:true,suppressDate:true,countHiddenUnlock:false,
        onComplete:result => window.testToeicComplete=result});
      return set.questions.length;
    },part);
    if (part !== 'part5') {
      await page.locator('[onclick="RPG.showToeicPassage()"]').click();
      assert.ok((await page.locator('#toeic-passage-scroll').innerText()).length > 20);
      await shot(`${part}-passage-390`);
      await page.locator('#toeic-passage-view .toeic-back-btn').click();
    }
    for (let index=0; index<count; index++) {
      if (part !== 'part5') await page.locator('[onclick="RPG.showToeicQuestions()"]').click();
      const answer = await page.evaluate(() => RPG.state.currentToeicSession.expandedQuestions[RPG.state.currentToeicSession.qIndex].answer);
      if (index === 0) await shot(`${part}-question-390`);
      await page.locator('#toeic-options').getByRole('button',{name:answer,exact:true}).click();
      await page.waitForFunction(index => window.testToeicComplete || RPG.state.currentToeicSession.qIndex > index,index);
    }
    assert.deepEqual(await page.evaluate(() => ({correct:window.testToeicComplete.correctCount,total:window.testToeicComplete.total})),{correct:count,total:count});
  }
  console.log('PASS TOEIC Parts 5/6/7, passage navigation, answer progression, completion and rewards');

  // Local generated WAV exercises browser decoding/playback; it is test data,
  // not a substitute for the user's private music or listening files.
  const samples = 44100;
  const wav = Buffer.alloc(44 + samples*2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(44100,24); wav.writeUInt32LE(88200,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write('data',36); wav.writeUInt32LE(samples*2,40);
  const mediaPath=path.join(root,'test-results/test-tone.wav');
  await fs.writeFile(mediaPath,wav);
  const mediaURL=pathToFileURL(mediaPath).href;
  await dismiss();
  await page.evaluate(url => {
    MusicPlayer.tracks=[{id:'fixture-a',title:'재생 검증 A',artist:'ASTRA',src:url},{id:'fixture-b',title:'재생 검증 B',artist:'ASTRA',src:url}];
    MusicPlayer.currentIndex=0;
    MusicPlayer.loadTrack(0);
    MusicPlayer.open();
  },mediaURL);
  await page.locator('#music-rate-125').click();
  await page.evaluate(() => MusicPlayer.play());
  await page.waitForFunction(() => MusicPlayer.audio.currentTime > 0);
  await shot('music-390');
  await page.evaluate(() => { MusicPlayer.close(); MusicPlayer.next(); });
  assert.equal(await page.evaluate(() => MusicPlayer.audio.playbackRate),1.25);
  assert.equal(await page.evaluate(() => MusicPlayer.audio.defaultPlaybackRate),1.25);
  await page.evaluate(url => {
    MusicPlayer.pause();
    FortuneCookie.currentSet={part:2,setTitle:'로컬 리스닝 검증',audioFile:url,questions:[{answer:0}]};
    FortuneCookie.showListeningPhase();
  },mediaURL);
  await page.locator('#fortune-listening-phase [onclick="FortuneCookie.playAudio()"]').click();
  await page.waitForFunction(() => FortuneCookie.audio.currentTime > 0);
  await page.locator('#fortune-options-container button').first().click();
  await shot('fortune-390');
  await page.evaluate(() => FortuneCookie.close());
  console.log('PASS real local audio decode/play, speed retention across tracks, listening playback and answer');

  // A modal must contain keyboard focus and return it through nested dialogs.
  await dismiss();
  await page.evaluate(() => Astra.learn());
  const lectureButton = page.locator('#screen-study [onclick="RPG.openMagicClass()"]');
  await lectureButton.click();
  await page.locator('#lecture-list button').first().click();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.closest('.modal')?.id),'modal-magic-class');
  await page.keyboard.press('Escape');
  assert.equal(await lectureButton.evaluate(el => el === document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log('PASS nested modal keyboard focus restoration; no uncaught browser errors');
} finally { await browser.close(); }
