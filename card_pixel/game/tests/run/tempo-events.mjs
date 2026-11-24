import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../../src/content/events.js';
import * as Bridge from '../../src/engine/bridge.js';
import { mulberry32 } from '../../src/engine/rng.js';
import * as Run from '../../src/engine/run.js';
import * as Save from '../../src/engine/save.js';
import { WILD_PATTERNS } from '../../src/engine/roster.js';
import { wildBeatPattern } from '../../src/content/tempo.js';

export function registerTempoEventTests({ core, roster, makeTempo, reach, advance, enter, settle, ok }) {
  function testTempoEvent(id, choices) {
    test(`tempo 2 event ${id}`, async t => {
      const event = EVENTS.find(entry => entry.id === id);
      assert.deepEqual(Object.keys(choices), event.choices.map(choice => choice.id));
      const pass = run => {
        const { bench, crystals, blessings, nextBattle } = structuredClone(run);
        advance(run);
        assert.deepEqual({ bench: run.bench, crystals: run.crystals, blessings: run.blessings, nextBattle: run.nextBattle },
          { bench, crystals, blessings, nextBattle });
        assert.equal(run.pending, null);
      };
      const cases = [...Object.entries(choices), ['pass', pass]];
      for (const difficulty of ['normal', 'nightmare']) {
        for (const floor of [3, 5]) {
          for (const [choiceId, check] of cases) {
            await t.test(`${difficulty}/B${floor}/${choiceId}`, () => {
              const run = reach(makeTempo({ dungeonId: event.dungeons?.[0] || 'ember_volcano', difficulty }), floor);
              // Keep named recruits available and start at the cap to exercise the replacement prompt.
              run.reserved = null;
              run.bench = run.pool.filter(id => !event.requires.present.includes(id) && roster.card(id).trait.type !== 'looter').slice(0, 6);
              run.joinOrder = run.bench.slice();
              run.crystals = 10;
              const door = run.doors.find(entry => entry.type === 'event');
              door.event = event;
              enter(run, door.index);
              const choose = ({ cost = 0, delta = 0 - cost, target, replace = [] } = {}) => {
                const crystals = run.crystals;
                if (cost) {
                  run.crystals = cost - 1;
                  const before = Save.serializeRun(run);
                  assert.equal(Run.chooseEvent(run, choiceId, target, replace).reason, 'invalid_event_choice');
                  assert.equal(Save.serializeRun(run), before);
                  run.crystals = crystals;
                }
                if (replace.length) {
                  const before = Save.serializeRun(run);
                  assert.equal(Run.chooseEvent(run, choiceId, target, replace.slice(1)).reason, 'roster_full');
                  assert.equal(Save.serializeRun(run), before);
                }
                const result = ok(Run.chooseEvent(run, choiceId, target, replace));
                assert.equal(result.crystals, delta);
                assert.equal(run.crystals, crystals + delta);
                assert.ok(run.bench.length <= 6);
                return result;
              };
              check(run, choose);
            });
          }
        }
      }
    });
  }

  function eventBattle(run, party, safe = false) {
    advance(run);
    enter(run, 0, party);
    const options = Run.battleOptions(run);
    assert.equal(options.tempo.startMp, 65);
    assert.equal(options.tempo.pattern, run.dungeonId === 'midnight_trench' ? 'tide' : 'threeBeat');
    assert.ok(run.bench.includes(options.tempo.blessing.id));
    if (safe) {
      for (const enemy of options.enemies) Object.assign(enemy.stats, { hp: 99999, atk: 0, matk: 0 });
    }
    const battle = Bridge.create(core, options);
    const events = battle.start();
    const start = events.find(entry => entry.t === 'begin').s;
    assert.equal(start.allies[0].mp, Math.min(65, start.allies[0].maxMp));
    const intent = events.find(entry => entry.t === 'await').intent;
    return { battle, options, start, intent };
  }

  function verifyRecruit(run, choose, ids, cost) {
    const count = Math.max(0, run.bench.length + ids.length - 6);
    const replace = count ? run.bench.slice(-count) : [];
    const result = choose({ cost, replace });
    assert.deepEqual(result.effects, [...replace.map(id => ({ type: 'release', id })), { type: 'join', ids }]);
    assert.deepEqual(run.released, replace);
    assert.deepEqual(run.bench.slice(-ids.length), ids);
  }

  function eventHeirloom(run, choose, from, name, cost) {
    const target = run.bench[0];
    choose({ cost, target });
    const combat = eventBattle(run, undefined, true);
    const skill = combat.battle.options().find(option => option.heirloom);
    assert.ok(skill, name);
    assert.equal(skill.name, name);
    assert.equal(skill.heirFrom, from);
    assert.equal(skill.cost, 0);
    return { ...combat, skill };
  }

  testTempoEvent('kobold_boot_exchange', {
    mend(run, choose) {
      const [target, other] = run.bench;
      run.blessings = { [target]: 0.8, [other]: 0.4 };
      choose({ target });
      assert.deepEqual(run.blessings, { [target]: 0.2, [other]: 0.4 });
      const { options } = eventBattle(run);
      const { id, multiplier } = options.tempo.blessing;
      const bonus = id === target ? Math.round((multiplier - 1) * 100) / 100 : 0;
      assert.equal(options.blessings.find(entry => entry.id === target).multiplier, Math.max(0.2, bonus));
    },
    exchange(run, choose) {
      // Set a known sale grade and distinct lead to exercise the existing event target rules.
      const target = 'kobold';
      run.bench[5] = target;
      run.lead = run.bench[0];
      run.blessings[target] = 0.4;
      run.heirlooms[target] = { from: 'ash', name: '아마겟돈' };
      const before = Save.serializeRun(run);
      assert.equal(Run.chooseEvent(run, 'exchange').reason, 'invalid_event_choice');
      assert.equal(Run.chooseEvent(run, 'exchange', run.lead).reason, 'invalid_event_choice');
      assert.equal(Run.chooseEvent(run, 'exchange', target, [run.bench[1]]).reason, 'invalid_replacement');
      assert.equal(Save.serializeRun(run), before);
      const candidates = run.pool.filter(id => !run.bench.includes(id));
      const result = choose({ cost: 1, delta: 0, target });
      const replacement = run.bench.at(-1);
      assert.equal(run.bench.length, 6);
      assert.ok(candidates.includes(replacement));
      assert.deepEqual(result.effects, [{ type: 'release', id: target }, { type: 'join', ids: [replacement] }]);
      assert.deepEqual(run.released, [target]);
      assert.equal(run.blessings[target], undefined);
      assert.equal(run.heirlooms[target], undefined);
      eventBattle(run, [replacement, ...run.bench.slice(0, 2)]);
    }
  });

  testTempoEvent('mimic_paybox', {
    cash(run, choose) {
      choose({ delta: 2 });
      assert.ok(!run.bench.includes('mimic'));
      eventBattle(run);
    },
    porter(run, choose) {
      verifyRecruit(run, choose, ['mimic'], 0);
      const bench = run.difficulty === 'nightmare' && run.floor === 5;
      const retreat = run.difficulty === 'nightmare' && run.floor === 3;
      const fallen = run.difficulty === 'normal' && run.floor === 5;
      eventBattle(run, bench ? undefined : ['mimic', ...run.bench.slice(0, 2)]);
      const { crystals } = settle(run, { survivors: [!fallen && !retreat, true, true], retreated: [retreat, false, false] });
      assert.equal(crystals, run.room.reward + Number(!bench && !fallen));
    }
  });

  testTempoEvent('ash_split_wick', {
    veil(run, choose) {
      const { skill, battle } = eventHeirloom(run, choose, 'ash', '드림파이어', 0);
      assert.equal(skill.val, 2.25);
      assert.ok(battle.act(skill.index).some(entry => entry.t === 'buff' && entry.id === 'evasion' && entry.to === 1));
    },
    flare(run, choose) {
      const { skill, battle } = eventHeirloom(run, choose, 'ash', '아마겟돈', 2);
      assert.equal(skill.val, 10.5);
      const hp = battle.state().allies[0].hp;
      const events = battle.act(skill.index);
      assert.ok(events.some(entry => entry.t === 'hp' && entry.who.side === 'ally' && Math.abs(entry.delta + hp / 2) <= 1));
      assert.ok(events.some(entry => entry.t === 'buff' && entry.who.side === 'ally' && entry.id === 'stun' && entry.to === 1));
    }
  });

  function keepEventAltar(run, expected) {
    assert.equal(run.pending.kind, 'altar');
    // Roll a value in the last seat's interval to check the altar uses the current roster.
    run.rng.state = Array.from({ length: 100 }, (_, seed) => seed).find(seed => mulberry32(seed)() >= 5 / 6);
    const roll = ok(Run.altarRoll(run));
    assert.equal(roll.id, expected);
    ok(Run.altarKeep(run));
    assert.equal(run.blessings[expected], roll.multiplier);
    eventBattle(run);
  }

  testTempoEvent('miko_lottery_cups', {
    old_circle(run, choose) {
      const original = run.bench.slice();
      choose();
      assert.deepEqual(run.bench, original);
      keepEventAltar(run, original.at(-1));
    },
    one_more(run, choose) {
      if (run.difficulty === 'normal' && run.floor === 3) run.bench.pop();
      verifyRecruit(run, choose, ['dragon_miko'], 1);
      keepEventAltar(run, 'dragon_miko');
    }
  });

  testTempoEvent('holy_bomb_last_verse', {
    singer(run, choose) {
      verifyRecruit(run, choose, ['holy_bomb'], 1);
      const { battle } = eventBattle(run, ['holy_bomb', ...run.bench.slice(0, 2)], true);
      const skill = battle.options().find(option => option.name === '라스트캐럴');
      assert.equal(skill.heirloom, false);
      assert.equal(skill.cost, 30);
      battle.act(skill.index);
      assert.equal(battle.state().allies[0].dead, true);
    },
    sign(run, choose) {
      const { skill, battle } = eventHeirloom(run, choose, 'holy_bomb', '라스트캐럴', 0);
      battle.act(skill.index);
      assert.equal(battle.state().allies[0].dead, true);
      assert.equal(battle.heirloomsGained()[0].from, run.bench[0]);
    }
  });

  testTempoEvent('whale_third_peal', {
    peal(run, choose) {
      choose();
      const won = run.difficulty === 'normal';
      const { battle, start } = eventBattle(run, undefined, true);
      assert.equal(start.enemy.buffs.divine, 1);
      const turn = won ? 3 : 4;
      for (let i = 1; i < turn; i++) battle.act(0);
      assert.equal(battle.state().turn, turn);
      for (let i = 0; i < battle.enemyCount && !battle.outcome; i++) {
        battle.host.battle.enemy.hp = 1;
        battle.act(0);
      }
      assert.equal(battle.outcome, 'win');
      assert.deepEqual(ok(Run.settleBattle(run, battle)).bet, { kind: 'kill_on_turn', turn: 3, won });
      assert.equal(run.relics.includes('over_divine'), won);
      assert.equal(run.nextBattle, null);
    },
    buy_bell(run, choose) {
      const full = run.floor === 5;
      if (full) run.relics = ['reverse', 'double_attack', 'over_flame', 'ice_break'];
      choose({ cost: 3, delta: full ? 0 : -3 });
      if (full) {
        assert.equal(run.pending.cost, 3);
        ok(Run.equipRelic(run, 'over_divine', 'reverse'));
        assert.equal(run.crystals, 7);
      }
      assert.ok(eventBattle(run).options.artifacts.includes('over_divine'));
    },
    white_note(run, choose) {
      const { skill } = eventHeirloom(run, choose, 'galaxy_whale', '앱솔루트라이트', 2);
      assert.ok(skill.effects.some(effect => effect.type === 'dmg_boost' && effect.element === 'dark' && effect.mult === 3));
    }
  });

  testTempoEvent('two_garden_chairs', {
    middle(run, choose) {
      verifyRecruit(run, choose, ['mummy'], 1);
      const [front, rear] = run.bench;
      assert.deepEqual(eventBattle(run, [front, 'mummy', rear]).options.party, [front, 'mummy', rear]);
    },
    rear(run, choose) {
      verifyRecruit(run, choose, ['victoria'], 3);
      const [front, middle] = run.bench;
      assert.deepEqual(eventBattle(run, [front, middle, 'victoria']).options.party, [front, middle, 'victoria']);
    },
    lanterns(run, choose) {
      choose();
      const { start } = eventBattle(run);
      assert.deepEqual([...start.field].slice(0, 2), ['goddess_descent', 'twinkle_party']);
      assert.deepEqual(run.released, []);
    }
  });

  testTempoEvent('dainichi_alms_bowl', {
    level(run, choose) {
      run.blessings[run.bench[0]] = 0.75;
      choose({ delta: 2 });
      assert.deepEqual(run.blessings, Object.fromEntries(run.bench.map(id => [id, 0.1])));
      const { options } = eventBattle(run);
      const { id, multiplier } = options.tempo.blessing;
      for (const blessing of options.blessings) {
        assert.equal(blessing.multiplier, blessing.id === id ? Math.round((multiplier - 1) * 100) / 100 : 0.1);
      }
    },
    mantra(run, choose) {
      const target = run.bench.find(id => roster.card(id).skills.some(skill => skill.type === 'sup' && skill.cost > 0));
      assert.ok(target);
      run.blessings[target] = 0.75;
      choose();
      const party = [target, ...run.bench.filter(id => id !== target).slice(0, 2)];
      const { battle, options } = eventBattle(run, party);
      assert.deepEqual(run.blessings, { [target]: 0.75 });
      assert.ok(options.artifacts.includes('support_boost'));
      const support = battle.options().filter(skill => skill.type === 'sup');
      assert.ok(support.length && support.every(skill => skill.cost === 0));
      settle(run);
      assert.equal(run.nextBattle, null);
      assert.ok(!run.relics.includes('support_boost'));
    }
  });

  testTempoEvent('penguin_ice_seam', {
    break(run, choose) {
      choose();
      const { start, intent } = eventBattle(run);
      assert.equal(start.enemy.buffs.stun, 1);
      assert.equal(intent.kind, 'stun');
    },
    carry(run, choose) {
      run.relics = ['reverse', 'double_attack', 'over_flame', 'ice_break'];
      assert.equal(Run.chooseEvent(run, 'carry').reason, 'invalid_event_choice');
      run.relics = [];
      choose();
      const first = run.bench.find(id => roster.card(id).element === 'water');
      assert.ok(first);
      const party = [first, ...run.bench.filter(id => id !== first).slice(0, 2)];
      const { options, battle, start } = eventBattle(run, party, true);
      assert.ok(options.artifacts.includes('frozen_body') && !run.relics.includes('frozen_body'));
      assert.equal(start.enemy.buffs.stun, undefined);
      if (run.difficulty === 'nightmare') {
        assert.ok(!battle.retreat().some(entry => entry.t === 'buff' && entry.id === 'stun'));
      } else {
        battle.host.battle.players[0].hp = 1;
        Object.assign(battle.host.battle.enemy, { atk: 10000, baseAtk: 10000 });
        assert.ok(battle.act(0).some(entry => entry.t === 'buff' && entry.who.side === 'enemy' && entry.id === 'stun' && entry.to === 1));
      }
    }
  });

  testTempoEvent('venom_five_knots', {
    hold(run, choose) {
      const { skill, battle } = eventHeirloom(run, choose, 'venom', '플레이그', 2);
      const hits = events => events.filter(entry => entry.t === 'act' && entry.delayed && entry.skill.name === '플레이그').length;
      let landed = hits(battle.act(skill.index));
      const retreat = run.difficulty === 'nightmare';
      if (retreat) {
        // Retreat after the first scheduled hit. Remaining knots cannot hit from the reserve.
        assert.equal(landed, 1);
        landed += hits(battle.retreat());
      }
      for (let i = 0; i < 5; i++) landed += hits(battle.act(0));
      assert.equal(landed, retreat ? 1 : 5);
    },
    brace(run, choose) {
      const target = run.bench[1];
      run.blessings[target] = 0.75;
      choose({ target });
      assert.deepEqual(run.blessings, { [target]: 0.25 });
      const { battle, options } = eventBattle(run);
      const { id, multiplier } = options.tempo.blessing;
      const bonus = id === target ? Math.round((multiplier - 1) * 100) / 100 : 0;
      assert.equal(options.blessings.find(entry => entry.id === target).multiplier, Math.max(0.25, bonus));
      assert.ok(battle.retreat().some(entry => entry.t === 'retreat'));
      assert.equal(battle.state().allies[battle.state().cur].form, target);
    }
  });

  testTempoEvent('arena_chalk_lines', {
    grind(run, choose) {
      choose();
      const { start } = eventBattle(run);
      assert.equal(start.field[0], 'arena');
      assert.equal(start.enemy.buffs.corrosion, 1);
    },
    cut(run, choose) {
      const target = run.bench[1];
      choose({ cost: 2, target });
      const { battle, start } = eventBattle(run, undefined, true);
      assert.equal(start.field[0], 'arena');
      battle.act(0);
      battle.act(0);
      battle.retreat();
      const skill = battle.options().find(option => option.name === '듀얼브레이커' && option.heirloom);
      assert.ok(skill?.usable);
      const events = battle.act(skill.index);
      assert.ok(events.some(entry => entry.t === 'rule' && entry.rule === 'arena_charge' && entry.multiplier === 2));
      assert.ok(!battle.state().field.includes('arena'));
    }
  });

  testTempoEvent('rollcall_ends', {
    pair(run, choose) {
      const recruits = ['discipline_captain', 'werebear'];
      if (run.difficulty === 'normal') run.bench.length = run.floor === 3 ? 4 : 5;
      const before = Save.serializeRun(run);
      assert.equal(Run.chooseEvent(run, 'pair', null, [run.bench[0], run.bench[0]]).reason, 'invalid_replacement');
      assert.equal(Save.serializeRun(run), before);
      verifyRecruit(run, choose, recruits, 1);
      const middle = run.bench.find(id => roster.card(id).grade === 'normal' && !recruits.includes(id));
      assert.ok(middle);
      const party = [recruits[0], middle, recruits[1]];
      assert.deepEqual(eventBattle(run, party).options.party, party);
    },
    rebuke(run, choose) {
      choose();
      const { start, intent } = eventBattle(run);
      assert.equal(start.enemy.buffs.silence, 1);
      assert.equal(start.enemy.buffs.weak, 1);
      // A wild species with its own pattern opens with that pattern's first beat.
      const opening = wildBeatPattern(WILD_PATTERNS[run.room.enemies[0].id])?.beats[0].name;
      assert.equal(intent.name, opening ?? (run.difficulty === 'normal' && run.floor === 6 ? '물리 충전' : '일반 공격'));
    }
  });
}
