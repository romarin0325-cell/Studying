import assert from 'node:assert/strict';
import * as Meta from '../../src/engine/meta.js';
import * as Run from '../../src/engine/run.js';
import { DUNGEONS } from '../../src/content/dungeons.js';
import { josa } from '../../src/ui/text.js';
import { checkCoachLines, checkCoachPlacement } from './coach.mjs';

const labels = {
  boss: '보스전 출전', gate: '문지기 출전', battle: '일반전 출전', bench: '대기에서 귀환'
};
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('relaymare.session')).profile.ui.entry);
const coach = page => page.locator('.coach:not([hidden])');
const openingTargets = '#battle.on :is(#intent, #opening-face, .opening-choice)';
const doorTargets = '#map.on :is(.door-entry, .door-info)';
const formationTargets = '#order.on :is([data-slot], #b-go)';
const formationLine = '선봉부터 싸워. 바꾸려면 두 자리를 차례로 눌러.';

async function highlight(page, { text }, id, line, selector) {
  await text(coach(page).locator('.coach-line'), line, { exact: true });
  assert.equal(await coach(page).getAttribute('data-coach-step'), id);
  assert.equal(await coach(page).locator('.coach-next').isVisible(), id.startsWith('tour-'));
  await checkCoachPlacement(page, id, selector);
  if (!id.startsWith('tour-')) await checkCoachLines(page);
}

async function checkFixedAction(page, screen, selector, action) {
  const result = await page.locator(`#${screen}.on .screen-split`).evaluate((body, { selector, action }) => {
    const list = body.querySelector('.scroll-list');
    const top = body.querySelector('.fixed-top');
    const button = body.querySelector('.fixed-foot ' + action);
    const row = list.querySelector(selector);
    const original = list.scrollTop;
    const added = [];
    // Stress the real list grid while leaving the saved run untouched.
    for (let i = 0; i < 24; i++) {
      const item = row.cloneNode(true);
      row.parentElement.append(item);
      added.push(item);
    }
    const rect = node => node.getBoundingClientRect().toJSON();
    const before = { top: rect(top), button: rect(button) };
    list.scrollTop = list.scrollHeight;
    const scrolled = getComputedStyle(list).overflowY === 'auto' && list.scrollTop > original;
    const after = { top: rect(top), button: rect(button) };
    const fits = button.checkVisibility() && after.button.top >= 0 && after.button.left >= 0 &&
      after.button.bottom <= innerHeight && after.button.right <= innerWidth;
    for (const item of added) item.remove();
    list.scrollTop = original;
    return { before, after, scrolled, fits };
  }, { selector, action });
  assert.ok(result.scrolled && result.fits, `#${screen} must scroll its list and keep ${action} visible`);
  assert.deepEqual(result.after, result.before, `#${screen} summary and action must stay fixed`);
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
      proof: `Seed 7 ${followup}: model-backed relay and skill, door info, formation swap and fixed actions with long lists`,
      async show(page, tools) {
        const { text, capture } = tools;
        await highlight(page, tools, 'title', '형아, 루미가 하나씩 알려 줄게. 새벽의 숲으로 가 보자!', '#b-start');
        await capture('title');
        await page.keyboard.press('Enter');
        const first = '#acts .opening-choice';
        await page.locator(first).first().waitFor();
        const model = await page.evaluate(() => {
          const { bridge, intent } = window.__game.B;
          const { allies, cur } = bridge.state();
          const fighters = allies.map(ally => [ally.form, ally.name, 'HP ' + ally.hp, true]);
          return { fighters, cur, hp: allies[cur].hp, damage: intent.dmg[0] };
        });
        const [, name] = model.fighters[model.cur];
        const openingLine = `앞에서 한 명씩 싸워. 지금은 ${name} 차례야.\n골렘이 ${model.damage} 피해를 줄 거야. ${name} HP는 ${model.hp}이야.`;
        await highlight(page, tools, 'opening', openingLine, openingTargets);
        const members = page.locator('#opening-face [data-fighter]');
        assert.deepEqual(await members.evaluateAll(nodes => nodes.map(node => [
          node.dataset.fighter, node.querySelector('b').textContent, node.querySelector('.opening-relay-hp').textContent,
          Boolean(node.querySelector('.opening-relay-face img'))
        ])), model.fighters);
        assert.equal(await members.count(), 3);
        assert.deepEqual(await members.locator('.opening-relay-face').evaluateAll(nodes => nodes.map(node =>
          [node.offsetWidth, node.offsetHeight])), [[28, 28], [28, 28], [28, 28]]);
        const current = members.nth(model.cur);
        assert.equal(await current.getAttribute('data-fighter'), 'ash');
        await text(current.locator('.opening-relay-tag'), '지금', { exact: true });
        assert.equal(await current.locator('.opening-relay-hp.danger').count(), 1);
        await text(members.nth(1).locator('.opening-relay-tag'), '다음', { exact: true });
        assert.equal(await page.locator('#opening-face').evaluate(node => node.offsetHeight <= 44), true);
        const originalViewport = page.viewportSize();
        for (const viewport of [{ width: 390, height: 640 }, { width: 360, height: 740 }]) {
          await page.setViewportSize(viewport);
          await checkCoachPlacement(page, 'opening', openingTargets);
          await checkCoachLines(page);
          for (const button of await page.locator(first).all()) {
            const box = await button.boundingBox();
            assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height);
          }
          assert.equal(await page.locator('#panel').evaluate(node => node.scrollHeight <= node.clientHeight), true);
        }
        await page.setViewportSize(originalViewport);
        await checkCoachPlacement(page, 'opening', openingTargets);
        const turn = await page.evaluate(() => window.__game.clock.t);
        const before = await stored(page);
        const settings = await page.locator('#battle .b-set').boundingBox();
        await page.mouse.click(settings.x + settings.width / 2, settings.y + settings.height / 2);
        assert.equal(await page.locator('#sheet.on').count(), 0);
        assert.equal(await coach(page).locator('.coach-ring.nudge').count(), 2);
        await page.locator('#intent').click();
        assert.equal(await page.locator('#sheet.on').count(), 0);
        assert.equal(await page.evaluate(() => window.__game.advance(0.5)), Math.round(turn * 100) / 100);
        assert.deepEqual(await stored(page), before);
        assert.equal(await coach(page).getAttribute('data-coach-step'), 'opening');
        await capture('opening');
        await page.locator(first).filter({ hasText: rescue ? '물러나기' : '애쉬로 마지막 공격' }).click();
        const message = rescue ? '애쉬는 살았어. 대신 맞은 눈토끼로 실버스톰을 써 봐.' : '쓰러진 애쉬가 아마겟돈을 남겼어. 눈토끼로 써 봐.';
        await highlight(page, tools, followup, message, attack);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await highlight(page, tools, followup, message, attack);
        assert.equal(await page.locator('#b-heir.on').count(), rescue ? 0 : 1);
        if (rescue) await text(page.locator(attack + ' b'), '실버스톰', { exact: true });
        else await text(page.locator('#b-heir.on .heirloom-use'), 'MP 0 · 1회', { exact: true });
        await capture(followup);
        await page.locator(attack).click();
        await page.evaluate(() => window.__game.settle(12));
        await acknowledge(page);
        await page.locator('#result.on #b-next').click();
        await highlight(page, tools, 'awakening', '이번 원정에 데려갈 한 명을 골라.', '#wake-choices [data-coach]');
        await text(page.locator('#awaken.on .lead'), `고른 한 명이 합류하고, 무작위로 ${Run.START.draws}명이 더 합류해.`, { exact: true });
        await text(page.locator('#awaken.on .gems'), '결정 ◆0');
        await text(page.locator('#wake-choices .st').first(), /물방 \d+ · 마방 \d+/);
        const toolsInHeader = page.locator('#awaken.on header.top :is(.b-set, .b-full, .log-button):visible');
        assert.equal(await toolsInHeader.count(), await page.locator(':root.nofs').count() ? 2 : 3);
        for (const button of await toolsInHeader.all()) {
          const box = await button.boundingBox();
          assert.ok(box && box.x >= 0 && box.x + box.width <= page.viewportSize().width);
        }
        assert(!(await stored(page)).done.includes('awakening'));
        await capture('awakening');
        const choices = page.locator('#wake-choices .cardrow');
        if (rescue && page.viewportSize().width === 360) {
          const scroll = page.locator('#awaken .scroll-list');
          const beforeScroll = await scroll.evaluate(node => node.scrollTop);
          // The step lights the fixed summary and the candidates; wheel over the ring that sits on the list.
          const list = await scroll.boundingBox();
          let box;
          for (const ring of await coach(page).locator('.coach-ring').all()) {
            const rect = await ring.boundingBox(), middle = rect && rect.y + rect.height / 2;
            if (rect && middle > list.y && middle < list.y + list.height) { box = rect; break; }
          }
          assert.ok(box, 'A coach ring sits over the candidate list');
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(0, 350);
          await page.waitForFunction(before => {
            const pane = document.querySelector('#awaken .scroll-list');
            return pane.scrollTop > before || pane.scrollHeight <= pane.clientHeight + before;
          }, beforeScroll);
          await checkCoachPlacement(page, 'awakening', '#wake-choices .cardrow');
        }
        await checkFixedAction(page, 'awaken', '.cardrow', '#b-wake');
        const picked = await choices.first().getAttribute('data-id');
        const pickedName = roster.card(picked).name;
        await choices.first().click();
        await text(page.locator('#b-wake'), pickedName + ' 합류', { exact: true });
        await highlight(page, tools, 'awakening-confirm', josa(pickedName, '과/와') + ' 함께 가자.', '#b-wake');
        assert(!(await stored(page)).done.includes('awakening'));
        await page.locator('#b-wake').click();
        assert((await stored(page)).done.includes('awakening'));
        await text(page.locator(`#awaken .wake-face[data-sheet="${picked}"] .companion-tag`), '직접 고름', { exact: true });
        assert.equal(await page.locator('#wake-draws .companion-tag').count(), Run.START.draws);
        await text(page.locator('#wake-draws .companion-tag').first(), '무작위 합류', { exact: true });
        await text(page.locator('#awaken.on .wake-lead'), rescue ? '애쉬' : '눈토끼');
        await text(page.locator('#awaken.on .wake-lead'), '대여 전투에서 함께 온 동료');
        await page.locator('#b-depart').click();
        const doorLine = '두 문은 만날 적이 달라. 싸울 적을 골라.';
        await highlight(page, tools, 'door', doorLine, doorTargets);
        await page.locator('#map.on .door-info').first().click();
        await page.locator('#sheet.on .run-foe-detail').first().waitFor();
        assert(!(await stored(page)).done.includes('door'));
        await page.locator('#b-sheetclose').click();
        await highlight(page, tools, 'door', doorLine, doorTargets);
        await capture('doors');
        await page.locator('#map.on .door-entry').first().click();
        await highlight(page, tools, 'formation', formationLine, formationTargets);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await highlight(page, tools, 'formation', formationLine, formationTargets);
        await checkFixedAction(page, 'order', '[data-bench]', '#b-go');
        await capture('formation');
        const seats = page.locator('#order.on [data-slot]');
        const [front, middle, rear] = await seats.locator('b').allTextContents();
        await seats.nth(1).click();
        assert.equal(await seats.nth(1).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#order.on [data-slot].sel[aria-pressed="false"]').count(), 2);
        await seats.nth(2).click();
        assert.deepEqual(await seats.locator('b').allTextContents(), [front, rear, middle]);
        assert(!(await stored(page)).done.includes('formation'));
        await page.locator('#b-go').click();
        assert((await stored(page)).done.includes('formation'));
        assert.deepEqual(await page.evaluate(() => window.__game.run.room.party.map(id => window.__game.roster.card(id).name)), [front, rear, middle]);
        await completeIntro(page);
        const candidate = page.locator('#recruit.on [data-candidate]').first();
        const candidateId = await candidate.getAttribute('data-candidate');
        const candidateName = roster.card(candidateId).name;
        await text(candidate.locator('.companion-tag'), '생환', { exact: true });
        await checkFixedAction(page, 'recruit', '[data-candidate]', '#meta-recruit-confirm');
        if (await candidate.getAttribute('aria-pressed') !== 'true') {
          await highlight(page, tools, 'recruit', '관측소에 영입할 한 명을 골라. 다음 원정에도 쓸 수 있어.', '#recruit.on [data-candidate]');
          await candidate.click();
        }
        await highlight(page, tools, 'recruit-confirm', josa(candidateName, '을/를') + ' 관측소에 영입하자.', '#meta-recruit-confirm');
        await capture('recruit');
        await page.locator('#meta-recruit-confirm').click();
        await text(page.locator(`#hub.on [data-recruited="${candidateId}"] .companion-tag`), '영입', { exact: true });
        await highlight(page, tools, 'departure', josa(candidateName, '과/와') + ' 홍련 화산으로 떠나자.', '#meta-depart, #meta-other-region');
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
      proof: `Three columns at 125%; start, invite, exclude and release ${invited} at constant height`,
      async show(page, { text, capture }) {
        await enterObservatory(page);
        await page.locator('#meta-telescope').click();
        await page.locator(`#dungeons.on [data-dungeon="${dungeon}"]`).click();
        const summary = page.locator('#meta-prep-summary');
        const cell = page.locator(`[data-prep-id="${invited}"]`);
        const height = (await cell.boundingBox()).height;
        const menu = page.locator('#meta-prep-menu:popover-open');
        const columns = page.locator('.meta-prep-pool');
        assert.equal(await columns.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 3);
        assert.equal(await cell.locator('small').evaluate(node => getComputedStyle(node).fontSize), '12px');
        assert.equal(await cell.locator('b').evaluate(node => getComputedStyle(node).webkitLineClamp), '2');
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
      session: storedSession({ profile, run }), proof: 'Four participation labels and preparation tour deferred with no eligible invite',
      async show(page, tools) {
        const { text, capture } = tools;
        await text(page.locator('#recruit.on .meta-recruit-body > p').filter({ hasText: '돌아온 동료' }), '돌아온 동료 중 한 명을 영입하세요.');
        for (const id of ids) await text(page.locator(`[data-candidate="${id}"] small`), labels[rewards.recruitTags[id]], { exact: true });
        await page.locator('#meta-run-record').click();
        assert.equal(await page.locator('#sheet.on').getByText('축복 대성공').count(), 0);
        await page.locator('#b-sheetclose').click();
        await capture('recruit-tags');
        await page.locator('#meta-recruit-confirm').click();
        await text(page.locator('#hub.on .meta-first-unlock'), '이제 여정·지역 규칙·샘 초대를 쓸 수 있어', { exact: true });
        assert.equal(await page.locator('#hub.on .meta-unlocks').count(), 0);
        await capture();
        await page.locator('#meta-telescope').click();
        const destination = page.locator('#dungeons.on [data-dungeon="ember_volcano"]');
        await destination.click();
        await text(coach(page).locator('.coach-line'), '여정은 보통 난이도야.');
        assert.equal(await page.locator('#sheet.on :is([data-can-invite], #meta-find-invites)').count(), 0);
        await acknowledge(page);
        assert.equal(await coach(page).count(), 0);
        assert(!(await stored(page)).tours.includes('preparation'));
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
