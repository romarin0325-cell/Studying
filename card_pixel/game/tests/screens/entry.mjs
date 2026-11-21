import assert from 'node:assert/strict';
import * as Meta from '../../src/engine/meta.js';
import * as Run from '../../src/engine/run.js';
import { DUNGEONS } from '../../src/content/dungeons.js';

const labels = {
  boss: '보스전 출전', gate: '문지기 출전', battle: '일반전 출전', bench: '대기에서 귀환'
};
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('relaymare.session')).profile.ui.entry);
const coach = page => page.locator('.coach:not([hidden])');

async function highlight(page, { text }, id, line, selector) {
  await text(coach(page).locator('.coach-line'), line, { exact: true });
  assert.equal(await coach(page).getAttribute('data-coach-step'), id);
  assert.equal(await coach(page).locator('.coach-next').isVisible(), id.startsWith('tour-'));
  await page.waitForFunction(({ selector, id }) => {
    const layer = document.querySelector('.coach:not([hidden])');
    if (layer?.dataset.coachStep !== id) return false;
    const hole = layer.querySelector('.coach-ring').getBoundingClientRect();
    const bubble = layer.querySelector('.coach-say').getBoundingClientRect();
    const targets = [...document.querySelectorAll(selector)].filter(button => button.getClientRects().length);
    return targets.length > 0 && targets.every(button => {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return button.contains(hit) && hole.left <= r.left + 1 && hole.right >= r.right - 1 &&
        hole.top <= r.top + 1 && hole.bottom >= r.bottom - 1 &&
        (r.bottom <= bubble.top || r.top >= bubble.bottom);
    });
  }, { selector, id });
}

async function acknowledge(page) {
  const next = coach(page).locator('.coach-next:not([hidden])');
  if (await next.isVisible()) await next.click();
}

async function completeIntro(page) {
  for (let i = 0; i < 70; i++) {
    const screen = await page.locator('.screen.on').getAttribute('id');
    if (screen === 'recruit') return;
    await acknowledge(page);
    if (screen === 'battle') {
      await page.evaluate(() => window.__game.settle(12));
      await acknowledge(page);
      const next = page.locator('#result.on #b-next');
      if (await next.isVisible()) {
        await next.click();
      } else {
        const action = await page.evaluate(() => {
          const options = window.__game.B.bridge.options().filter(skill => skill.usable);
          const attack = options.find(skill => skill.preview?.kill) ??
            options.sort((a, b) => (b.preview?.dmg ?? 0) - (a.preview?.dmg ?? 0))[0];
          return attack?.heirloom ? '#b-heir' : `#acts [data-i="${attack?.index}"]`;
        });
        await page.locator(action).click();
      }
    } else if (screen === 'map') {
      const doors = page.locator('#map.on .door-entry');
      const treasure = page.locator('#map.on [data-kind="treasure"] .door-entry');
      await (await treasure.count() ? treasure : doors.first()).click();
      await page.locator('#map.on').waitFor({ state: 'hidden' });
    } else if (screen === 'order') {
      await page.locator('#b-go').click();
    } else if (screen === 'treasure') {
      await page.locator('#b-equip').click();
      await page.locator('#treasure.on').waitFor({ state: 'hidden' });
    } else {
      assert.fail(`Unexpected intro screen: ${screen}`);
    }
  }
  assert.fail('Did not finish the intro');
}

export function createEntryCases({ roster, storedSession, snowRabbitProfile, nightmareProfile, mainReturn, enterObservatory }) {
  function opening(rescue) {
    const followup = rescue ? 'rescue' : 'inherit';
    const attack = rescue ? '#acts .act[data-i="3"]' : '#b-heir.on';
    return {
      session: null, seed: 7, settings: { textScale: rescue ? 1.25 : 1 },
      proof: `Seed 7 ${followup}: real button holes, blocked outside input, command completion and battle/formation reload`,
      async show(page, tools) {
        const { text, capture } = tools;
        await highlight(page, tools, 'title', '형아, 루미가 하나씩 알려 줄게. 새벽의 숲으로 가 보자!', '#b-start');
        await capture('title');
        await page.keyboard.press('Enter');
        const first = '#acts .opening-choice';
        await highlight(page, tools, 'opening', '골렘이 공격해. 애쉬로 맞설지, 뒤로 물릴지 골라.', first);
        const turn = await page.evaluate(() => window.__game.clock.t);
        const before = await stored(page);
        const settings = await page.locator('#battle .b-set').boundingBox();
        await page.mouse.click(settings.x + settings.width / 2, settings.y + settings.height / 2);
        assert.equal(await page.locator('#sheet.on').count(), 0);
        assert.equal(await coach(page).locator('.coach-ring.nudge').count(), 1);
        assert.equal(await page.evaluate(() => window.__game.advance(0.5)), Math.round(turn * 100) / 100);
        assert.deepEqual(await stored(page), before);
        assert.equal(await coach(page).getAttribute('data-coach-step'), 'opening');
        await capture('opening');
        await page.locator(first).filter({ hasText: rescue ? '물러나기' : '애쉬로 마지막 공격' }).click();
        const message = rescue ? '애쉬는 살아 있어. 이제 앞에 선 동료로 공격해.' : '눈토끼가 애쉬의 아마겟돈을 받았어. 써 봐.';
        await highlight(page, tools, followup, message, attack);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await highlight(page, tools, followup, message, attack);
        assert.equal(await page.locator('#b-heir.on').count(), rescue ? 0 : 1);
        await capture(followup);
        await page.locator(attack).click();
        await page.evaluate(() => window.__game.settle(12));
        await acknowledge(page);
        await page.locator('#result.on #b-next').click();
        await highlight(page, tools, 'awakening', '이번 원정에 함께할 동료 한 명을 골라.', '#wake-choices [data-coach]');
        assert(!(await stored(page)).done.includes('awakening'));
        await capture('awakening');
        await page.locator('#wake-choices .cardrow').first().click();
        await highlight(page, tools, 'awakening-confirm', '고른 동료와 함께 가자.', '#b-wake');
        assert(!(await stored(page)).done.includes('awakening'));
        await page.locator('#b-wake').click();
        assert((await stored(page)).done.includes('awakening'));
        await text(page.locator('#awaken.on .wake-lead'), rescue ? '애쉬' : '눈토끼');
        await page.locator('#b-depart').click();
        await highlight(page, tools, 'door', '문에 적의 공격이 보여. 가고 싶은 문을 눌러.', '#map.on .door-entry');
        await capture('doors');
        await page.locator('#map.on .door-entry').first().click();
        await highlight(page, tools, 'formation', '선봉부터 싸워. 준비됐으면 시작해.', '#b-go');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await highlight(page, tools, 'formation', '선봉부터 싸워. 준비됐으면 시작해.', '#b-go');
        await capture('formation');
        await page.locator('#b-go').click();
        assert((await stored(page)).done.includes('formation'));
        await completeIntro(page);
        const candidate = page.locator('#recruit.on [data-candidate]').first();
        if (await candidate.getAttribute('aria-pressed') !== 'true') {
          await highlight(page, tools, 'recruit', '돌아온 동료 한 명을 다음에도 만날 수 있어.', '#recruit.on [data-candidate]');
          await candidate.click();
        }
        await highlight(page, tools, 'recruit-confirm', '이 동료를 관측소에 영입하자.', '#meta-recruit-confirm');
        await capture('recruit');
        await page.locator('#meta-recruit-confirm').click();
        await highlight(page, tools, 'departure', '이 동료와 첫 던전으로 떠나자.', '#meta-depart, #meta-other-region');
        await text(page.locator('#meta-depart'), '홍련 화산으로');
        assert.equal(await page.locator('#meta-daily-rift').count(), 0);
        await capture('departure');
        await page.locator('#meta-other-region').click();
        await text(page.locator('#dungeons.on [data-dungeon="twilight_cathedral"]'), '황혼 성당');
        assert.equal(await page.locator('#dungeons.on .meta-clear-marks').filter({ hasText: '악몽' }).count(), 0);
        await page.locator('#dungeons.on .meta-back').click();
        await page.locator('#meta-depart').click();
        const live = await page.evaluate(() => ({
          difficulty: window.__game.run.difficulty, dungeonId: window.__game.run.dungeonId,
          prep: window.__game.run.features.prepEditing
        }));
        assert.deepEqual(live, { difficulty: 'easy', dungeonId: 'ember_volcano', prep: false });
        assert.equal(await page.locator('#sheet.on').count(), 0);
        assert((await stored(page)).done.includes('departure'));
      }
    };
  }

  function legacy() {
    const profile = snowRabbitProfile();
    assert(profile.ui.entry.legacy);
    return {
      session: storedSession({ profile }), proof: 'Legacy boot has no coach; an explicit replay starts a new intro with existing recruits',
      async show(page, tools) {
        await enterObservatory(page);
        assert.equal(await coach(page).count(), 0);
        await page.locator('#hub.on .b-set').click();
        await tools.text(page.locator('#meta-replay-tutorial'), '튜토리얼 다시 보기', { exact: true });
        await page.locator('#meta-replay-tutorial').click();
        await highlight(page, tools, 'title', '형아, 루미가 하나씩 알려 줄게. 새벽의 숲으로 가 보자!', '#b-start');
        assert((await stored(page)).legacy);
        await page.locator('.coach-skip').click();
        assert((await stored(page)).skipped);
        assert.equal(await coach(page).count(), 0);
        await page.locator('#b-start').click();
        assert.equal(await page.evaluate(() => window.__game.run.dungeonId), 'dawn_forest');
      }
    };
  }

  function preparation() {
    const profile = nightmareProfile();
    const dungeon = 'ember_volcano';
    const base = Meta.prepView(profile, dungeon, roster).pool;
    const invited = base.find(row => !row.start && row.canExclude).id;
    profile.recruits[invited] = { bond: 0, since: profile.records.runs };
    const name = roster.card(invited).name;
    return {
      session: storedSession({ profile }), settings: { textScale: 1.25 },
      proof: `Four-column grid; start, invite, exclude and release ${invited} at constant height`,
      async show(page, { text, capture }) {
        await enterObservatory(page);
        await page.locator('#meta-telescope').click();
        await page.locator(`#dungeons.on [data-dungeon="${dungeon}"]`).click();
        const summary = page.locator('#meta-prep-summary');
        const cell = page.locator(`[data-prep-id="${invited}"]`);
        const height = (await cell.boundingBox()).height;
        const menu = page.locator('#meta-prep-menu:popover-open');
        const columns = page.locator('.meta-prep-pool');
        assert.equal(await columns.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 4);
        const change = async (verb, status) => {
          await cell.click();
          await menu.getByRole('button', { name: verb, exact: true }).click();
          assert.equal(await cell.getAttribute('data-status'), status);
          assert.equal((await cell.boundingBox()).height, height);
        };
        await text(cell.locator('small'), '기본');
        await text(page.locator('.meta-prep-cell[data-status="start"] small'), '시작');
        await change('샘 초대', 'invited');
        await text(summary, '샘 초대 1/');
        await text(cell.locator('small'), '샘 초대');
        await change('해제', 'base');
        await text(summary, '샘 초대 0/');
        await change('출현 제외', 'excluded');
        await text(summary, '출현 제외 1/1');
        await cell.click();
        assert.equal(await menu.getByRole('button', { name: '시작 동료로' }).count(), 0);
        await capture('action-menu');
        await menu.getByRole('button', { name: '해제', exact: true }).click();
        await change('시작 동료로', 'start');
        await text(summary, `시작 ${name}`);
        await capture();
      }
    };
  }

  function recruitAndUnlock() {
    let profile = snowRabbitProfile(7, Meta.createProfile());
    profile = Meta.markEntryStep(profile, 'departure');
    const run = mainReturn(profile, 'ember_volcano', 'easy');
    assert.equal(run.features.prepEditing, false);
    const ids = roster.pool(DUNGEONS.ember_volcano.pool).slice(0, 4);
    run.bench = [...run.bench, ...ids.filter(id => !run.bench.includes(id))];
    run.joinOrder = [...new Set([...run.joinOrder, ...ids])];
    run.pending = null;
    run.participationTags = { ...run.participationTags, ...Object.fromEntries(ids.map((id, i) => [id, Object.keys(labels)[i]])) };
    const rewards = Run.finishRun(run);
    assert(ids.every(id => rewards.recruitable.includes(id)));
    return {
      session: storedSession({ profile, run }), proof: 'Four participation labels, first-main unlock notice and one preparation tour per visit',
      async show(page, tools) {
        const { text, capture } = tools;
        await text(page.locator('#recruit.on .meta-recruit-body > p').filter({ hasText: '돌아온 동료' }), '돌아온 동료 중 한 명을 영입하세요.');
        for (const id of ids) await text(page.locator(`[data-candidate="${id}"] small`), labels[rewards.recruitTags[id]], { exact: true });
        await capture('recruit-tags');
        await page.locator('#meta-recruit-confirm').click();
        await text(page.locator('#hub.on .meta-first-unlock'), '이제 여정·지역 규칙·샘 초대를 쓸 수 있어', { exact: true });
        assert.equal(await page.locator('#hub.on .meta-unlocks').count(), 0);
        await capture();
        await page.locator('#meta-telescope').click();
        const destination = page.locator('#dungeons.on [data-dungeon="ember_volcano"]');
        await destination.click();
        await text(coach(page).locator('.coach-line'), '샘 초대: 이번 원정에서 처음 후보 3칸을 열면, 초대한 동료 중 한 명이 보여요.');
        await acknowledge(page);
        assert.equal(await coach(page).count(), 0);
        assert((await stored(page)).tours.includes('preparation'));
        await page.locator('#b-sheetclose').click();
        await destination.click();
        await text(coach(page).locator('.coach-line'), '여정은 보통 난이도야.');
        await acknowledge(page);
        assert((await stored(page)).tours.includes('difficulty'));
      }
    };
  }

  function appearance() {
    const profile = snowRabbitProfile();
    const id = roster.pool(DUNGEONS.ember_volcano.pool).find(id => !profile.recruits[id] &&
      Meta.appearanceRegions(roster, id).includes('starlit_garden'));
    assert(id);
    const regions = Meta.appearanceRegions(roster, id).map(region => DUNGEONS[region].name);
    return {
      session: storedSession({ profile }), proof: `Unrecruited ${id}: ${regions.join(' · ')}`,
      async show(page, { text, capture }) {
        await enterObservatory(page);
        await page.locator('[data-meta-page="collection"]').click();
        await page.locator('#meta-pool').selectOption('ember_volcano');
        await page.locator(`#collection.on [data-companion="${id}"]`).click();
        await text(page.locator('.meta-companion > p').first(), `나오는 지역: ${regions.join(' · ')}`, { exact: true });
        assert.equal(await page.getByText('만나고 싶은 동료', { exact: true }).count(), 0);
        await capture();
      }
    };
  }

  return {
    'entry-stand': () => opening(false),
    'entry-rescue': () => opening(true),
    'entry-legacy': legacy,
    'entry-preparation': preparation,
    'entry-recruit-unlock': recruitAndUnlock,
    'entry-appearance': appearance
  };
}
