import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultParty } from '../../src/engine/run.js';
import { resolveMotion } from '../../src/ui/battle/motion.js';
import { planBattleAction } from '../../src/ui/battle/view.js';
import { createCoreRoster } from '../support/core.mjs';

const samples = [
  { shot: 'demon-breath', lead: 'mawang', name: '데몬브레스', family: 'breath' },
  { shot: 'fire-breath', lead: 'red_dragon', name: '파이어브레스', family: 'breath', big: true },
  { shot: 'snow-shot', lead: 'snow_rabbit', name: '스노우샷', family: 'shot', variant: 'snowball' },
  { shot: 'energy-ball', lead: 'fairy', name: '에너지볼', family: 'orb' },
  { shot: 'blood-drain', lead: 'vampire', name: '블러드드레인', family: 'orb', variant: 'absorb' },
  { shot: 'holy-ray', lead: 'archangel', name: '홀리레이', family: 'ray' },
  { shot: 'heart-shower', lead: 'rumi_wedding', name: '하트샤워', family: 'fall', variant: 'rain' },
  { shot: 'candy-burst', lead: 'candy_boy', name: '캔디버스트', family: 'blast' },
  { shot: 'bind', lead: 'mummy', name: '바인드', family: 'field', variant: 'bind', bind: true },
  { shot: 'silver-storm', lead: 'snow_rabbit', name: '실버스톰', family: 'drift', variant: 'storm' },
  { shot: 'silence', lead: 'silent_librarian', name: '사일런스', family: 'mark', variant: 'curse' },
  { shot: 'heal', lead: 'snow_rabbit', name: '스노우샷', family: 'mark', variant: 'heal', heal: true }
];

export function createMotionCases({ makeRun, startBattle, storedSession, act, openBattle, battleIdle, skillTile, shots }) {
  function fixture() {
    const cases = samples.map(sample => {
      const { lead, name, heal, bind } = sample;
      const run = makeRun({ seed: 21, floor: 2, tempoVersion: 2, profileView: { lead } });
      run.lastParty = [lead, null, null];
      run.nextBattle = { start: { allyStart: [{ mp: 60 }] } };
      if (heal) {
        // The playable roster has no direct HP spell. A real leech roll exercises the same heal event.
        const enemy = run.doors[0].enemies[0];
        enemy.affixes = [...new Set([...(enemy.affixes ?? []), 'leech'])];
      }
      const session = storedSession({ run });
      const battle = startBattle(run, { party: defaultParty(run) });
      const events = act(battle, name);
      const cast = events.find(event => event.t === 'act');
      assert.equal(cast?.skill.name, name);
      assert.ok(cast.sourceKey?.startsWith('ally/' + lead + '/'), name);
      assert.equal(cast.s.turn, 1, name);
      const damage = events.filter(event => event.t === 'hp' && event.who.side === 'enemy' &&
        event.delta < 0 && event.cause?.skill === name);
      const healed = events.filter(event => event.t === 'hp' && event.who.side === 'enemy' &&
        event.delta > 0 && event.cause?.rule === 'leech');
      if (bind) assert.ok(events.some(event => event.t === 'buff' && event.who.side === 'enemy' && event.id === 'curse'), name);
      else {
        assert.equal(damage.length, 1, name);
        assert.ok(damage[0].s.enemy.hp > 0, name + ' needs a non-finishing target');
      }
      if (heal) assert.equal(healed.length, 1, name);
      return { ...sample, session, amount: (heal ? healed : damage)[0]?.amount };
    });

    return {
      session: cases[0].session, motion: 'no-preference', mute: true,
      proof: 'Nine ranged effect families, including reverse absorption, floor bind and a real HP restore',
      async show(page, { text, capture, revisit }) {
        async function showRanged(source, sample, main) {
          await source.emulateMedia({ reducedMotion: 'no-preference' });
          await openBattle(source);
          await source.evaluate(() => { window.__game.clock.paused = true; });
          await skillTile(source, sample.name).click();
          const hit = await source.evaluate(async ({ name, heal }) => {
            const game = window.__game;
            game.clock.paused = false;
            try {
              // A support cast (e.g. 바인드) clears B.pending as soon as it lands while its mark stays on stage,
              // so keep the last move that reached its hit time.
              let seen = null;
              for (let i = 0; i < 240; i++) {
                await game.advance(0.015);
                const current = game.B.pending;
                if (current && (heal ? current.healAt : current.hitAt) != null) seen = current;
                const move = current ?? seen;
                const at = heal ? move?.healAt : move?.hitAt;
                if ((!heal && move?.e.skill.name !== name) || at == null || game.clock.t - at < 0.012) continue;
                return { family: move.motion.family, variant: move.motion.variant, size: move.motion.size,
                  targetPose: move.target?.pose, targetsFoe: move.target === game.B.foe, healing: move.healAt != null };
              }
              throw new Error('Ranged hit frame did not play: ' + name);
            } finally {
              game.clock.paused = true;
            }
          }, sample);
          if (sample.heal) assert.ok(hit.healing);
          else {
            assert.equal(hit.family, sample.family);
            if (sample.variant) assert.equal(hit.variant, sample.variant);
            if (sample.big) assert.equal(hit.size, 'big');
            assert.equal(hit.targetsFoe, true);
            if (!sample.bind) assert.equal(hit.targetPose, 'hurt');
          }
          if (sample.amount != null) {
            const number = sample.heal ? '#fx .num.heal' : '#fx .num:not(.tag):not(.call):not(.heal)';
            await text(source.locator(number), sample.amount.toLocaleString('en-US'));
          }
          await capture(main ? undefined : sample.shot, source, { duringBattle: true });
          for (let frame = 1; frame <= 4; frame++) {
            await source.locator('#stage').screenshot({ path: path.join(shots, 'motion-ranged-' + sample.shot + '-f' + frame + '.png') });
            if (frame < 4) await source.evaluate(async () => {
              const game = window.__game;
              game.clock.paused = false;
              try { await game.advance(0.03, 0.01); } finally { game.clock.paused = true; }
            });
          }
          await source.evaluate(() => { window.__game.clock.paused = false; });
          await battleIdle(source);
        }
        await showRanged(page, cases[0], true);
        for (const sample of cases.slice(1)) await revisit(sample.session, page => showRanged(page, sample, false));
      }
    };
  }
  function phaseThreeFixture() {
    const { core, roster } = createCoreRoster();
    const guillotine = { name: '섀도우길로틴', owner: 'executor', family: 'blade', variant: 'guillotine', turn: 1 };
    const cases = [
      { ...guillotine, shot: 'direct', lead: 'executor' },
      { ...guillotine, shot: 'heirloom', lead: 'snow_rabbit', heirloom: true },
      { shot: 'aurora-wing', lead: 'miracle_larva', name: '미라클파우더', family: 'drift', variant: 'powder',
        turn: 3, form: 'aurora_wing', before: ['기적의우화', '기적의우화 → 오로라윙'] },
      { shot: 'reserve', lead: 'fireworks_girl', name: '페스티벌나이트', family: 'mark', variant: 'reserve', turn: 1 },
      { shot: 'soul-drain', lead: 'guardian', name: '소울드레인', family: 'orb', variant: 'absorb', turn: 7,
        before: Array(6).fill('일반 공격'), command: '일반 공격' }
    ].map(sample => {
      const { lead, name, heirloom, owner, form } = sample;
      const run = makeRun({ seed: 21, floor: 2, tempoVersion: 2, profileView: { lead } });
      run.lastParty = [lead, null, null];
      run.nextBattle = { start: { allyStart: [{ mp: 100 }] } };
      if (heirloom) run.heirlooms[lead] = { from: owner, name };
      const door = run.doors[0];
      if (sample.shot === 'soul-drain') {
        door.enemies = [roster.bossOf('iris_love')];
        door.tempo = { ...door.tempo, pattern: 'bossScript', lesson: null };
      }
      Object.assign(door.enemies[0].stats, { hp: 20000, atk: 5, matk: 5 });
      const session = storedSession({ run });
      const battle = startBattle(run, { party: defaultParty(run) });
      for (const prep of sample.before ?? []) act(battle, prep);
      const events = act(battle, sample.command ?? name);
      const index = events.findIndex(event => event.t === 'act' && event.skill.name === name);
      const cast = events[index];
      assert.equal(cast?.s.turn, sample.turn, name);
      const motionFor = event => resolveMotion({ ...event, side: event.who.side, casterSprite: owner ?? lead, casterForm: form });
      const plan = planBattleAction(events, index, { core, artifacts: run.relics });
      const motion = motionFor(cast);
      if (sample.variant !== 'reserve') assert.deepEqual([motion.family, motion.variant], [sample.family, sample.variant]);
      const strikes = [...plan.hp.values()].filter(step => step.strike);
      if (owner) {
        assert.equal(cast.sourceKey, 'ally/executor/3');
        assert.equal(cast.heirloom, !!heirloom);
      }
      if (form) {
        assert.equal(cast.s.allies[0].form, form);
        assert.equal(cast.sourceKey, 'ally/aurora_wing/2');
      }
      if (sample.shot === 'reserve') {
        assert.deepEqual(plan.effects.find(effect => effect.kind === 'delay')?.turns, [2, 3, 4]);
        assert.equal(strikes.length, 0);
        const landing = events.findIndex(event => event.t === 'act' && event.skill.name === name && event.trigger === 'reserved');
        assert.equal(events[landing]?.s.turn, 2);
        const resolved = motionFor(events[landing]);
        assert.deepEqual([resolved.family, resolved.variant, resolved.socket], ['blast', 'eruption', 'top']);
        const hit = [...planBattleAction(events, landing, { core, artifacts: run.relics }).hp.values()];
        assert.equal(hit.filter(step => step.strike).length, 1);
        return { ...sample, session, amount: hit.find(step => step.strike).event.amount };
      }
      if (sample.shot === 'soul-drain') {
        assert.equal(cast.sourceKey, 'boss/iris_love/3');
        assert.equal(strikes.length, 0);
        assert.equal(plan.drains.size, 1);
        return { ...sample, session, mp: [...plan.drains][0].delta };
      }
      assert.equal(strikes.length, 1);
      return { ...sample, session, amount: strikes[0].event.amount };
    });

    return {
      session: cases[0].session, motion: 'no-preference', mute: true,
      proof: 'Direct and heirloom guillotine, Aurora Wing, Festival Night clock and landing, and Soul Drain',
      async show(page, { capture, revisit, text }) {
        async function seek(source, sample, traveling = false) {
          const frame = await source.evaluate(async ({ name, family, variant, turn, traveling }) => {
            const game = window.__game;
            game.clock.paused = false;
            try {
              const seen = new Set();   // what played instead, for the failure message
              for (let i = 0; i < 400; i++) {
                await game.advance(0.02);
                const move = game.B.pending, fx = move?.fx;
                if (move) seen.add(`${move.e.skill.name}/t${move.e.s?.turn}/${fx?.family ?? '-'}/${fx?.variant ?? '-'}/${fx?.arrived != null ? 'arrived' : 'travel'}`);
                if (move?.e.skill.name !== name || move.e.s.turn !== turn || !fx) continue;
                if (fx.family !== family || fx.variant !== variant) continue;
                if (traveling ? fx.arrived != null : move.hitAt == null || game.clock.t - move.hitAt < 0.015) continue;
                return { sprite: move.actor.sprite, form: move.actor.form, size: move.motion.size,
                  socket: move.motion.socket, trigger: move.e.trigger, mp: game.B.D.allies[0]?.mp,
                  from: fx.from?.x, to: fx.to?.x, targetsCaster: fx.target === game.B.allies[0] && fx.caster === fx.target,
                  casterX: move.actor.x, targetX: move.target?.x };
              }
              throw new Error('Phase three frame did not play: ' + name + '/' + variant + '/' + turn + ' · seen ' + [...seen].slice(-6).join(', '));
            } finally { game.clock.paused = true; }
          }, { ...sample, traveling });
          return frame;
        }

        async function showSample(source, sample, main) {
          await openBattle(source);
          for (const name of sample.before ?? []) {
            if (name.includes(' → ')) {
              const [skill, form] = name.split(' → ');
              await skillTile(source, skill).click();
              await source.locator('#sheet.on [data-form]').filter({ hasText: form }).click();
            } else await skillTile(source, name).click();
            await battleIdle(source);
          }
          await source.evaluate(() => { window.__game.clock.paused = true; });
          await (sample.heirloom ? source.locator('#b-heir') : skillTile(source, sample.command ?? sample.name)).click();
          // The heirloom name plate for this skill is asserted in motion-contact; here the donor art, size and socket are checked.
          // The MP drain is shown on arrival (the absorb appears already landing), so seek the arrival frame for it too.
          const frame = await seek(source, sample, false);
          if (sample.owner) {
            assert.deepEqual([frame.sprite, frame.size, frame.socket], [sample.owner, 'big', 'hand']);
          }
          if (sample.form) assert.deepEqual([frame.sprite, frame.form], ['miracle_larva', sample.form]);
          if (sample.variant === 'reserve') assert.equal(frame.targetsCaster, true);
          if (sample.mp != null) {
            assert.equal(frame.from, frame.targetX);
            // At the arrival frame the absorb has landed; it starts at the target and spans to a different point.
            assert.notEqual(frame.to, frame.from);
            // The exact MP change is asserted on the event plan in Node; here the drain must be a real loss.
            assert.ok(sample.mp < 0, 'The boss drained MP');
          }
          await capture(main ? undefined : sample.shot, source, { duringBattle: true });
          if (sample.variant === 'reserve') {
            const landing = await seek(source, { ...sample, family: 'blast', variant: 'eruption', turn: 2 });
            assert.equal(landing.trigger, 'reserved');
            assert.equal(landing.socket, 'top');
            await text(source.locator('#fx .num:not(.tag):not(.call):not(.foe)'), sample.amount.toLocaleString('en-US'));
            await capture('reserve-landing', source, { duringBattle: true });
          } else if (sample.mp != null) {
            assert.equal((await seek(source, sample)).mp, 0);
            await text(source.locator('#fx .num.tag.bad'), 'MP ' + sample.mp.toLocaleString('en-US'));
            await capture('soul-drain-mp', source, { duringBattle: true });
          }
          await source.evaluate(() => { window.__game.clock.paused = false; });
          await battleIdle(source);
        }
        await showSample(page, cases[0], true);
        for (const sample of cases.slice(1)) await revisit(sample.session, source => showSample(source, sample, false));
      }
    };
  }
  return { 'motion-ranged': fixture, 'motion-phase-three': phaseThreeFixture };
}
