import assert from 'node:assert/strict';
import path from 'node:path';
import { defaultParty } from '../../src/engine/run.js';

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
  return { 'motion-ranged': fixture };
}
