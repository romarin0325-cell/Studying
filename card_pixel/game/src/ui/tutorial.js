import { $, $$ } from './dom.js';
import { createCoach } from './coach.js';
import { TERMS } from './glossary.js';
import { josa } from './text.js';
import { formatRange } from './widgets.js';
import * as Meta from '../engine/meta.js';
import { QUIRKS } from '../content/quirks.js';
import { AFFIXES } from '../content/affixes.js';
import { DUNGEONS } from '../content/dungeons.js';
import { REGIONS } from '../content/regions.js';
import { eventChoices } from '../engine/rooms.js';

const ENTRY = {
  title: ['#title.on #b-start', '형아, 루미가 하나씩 알려 줄게. 새벽의 숲으로 가 보자!'],
  opening: ['#battle.on .opening-choice', ({ name, enemy, damage, hp }) =>
    `앞에서 한 명씩 싸워. 지금은 ${name} 차례야.\n${josa(enemy, '이/가')} ${damage} 피해를 줄 거야. ${name} HP는 ${josa(hp, '이야/야')}.`,
    ['#battle.on #intent', '#battle.on :is(#opening-face, .opening-choice)']],
  inherit: ['#battle.on #b-heir.on', ({ name, next, skill }) =>
    `쓰러진 ${josa(name, '이/가')} ${josa(skill, '을/를')} 남겼어. ${josa(next, '으로/로')} 써 봐.`],
  rescue: [({ index }) => `#battle.on .act[data-i="${index}"]`, ({ name, next, skill }) =>
    `${josa(name, '은/는')} 살았어. 대신 맞은 ${josa(next, '으로/로')} ${josa(skill, '을/를')} 써 봐.`],
  awakening: ['#awaken.on [data-coach="awakening-candidate"]', '이번 원정에 데려갈 한 명을 골라.',
    ['#awaken.on .fixed-top', '#awaken.on [data-coach="awakening-candidate"]']],
  'awakening-confirm': ['#awaken.on [data-coach="awakening-confirm"]', ({ name }) => josa(name, '과/와') + ' 함께 가자.'],
  door: ['#map.on :is(.door-entry[data-coach="door"], [data-coach="door-info"])', '두 문은 만날 적이 달라. 싸울 적을 골라.'],
  formation: ['#order.on :is([data-slot], [data-coach="formation-confirm"])', '선봉부터 싸워. 바꾸려면 두 자리를 차례로 눌러.',
    ['#order.on [data-slot]', '#order.on [data-coach="formation-confirm"]']],
  recruit: ['#recruit.on [data-candidate]', '관측소에 영입할 한 명을 골라. 다음 원정에도 쓸 수 있어.'],
  'recruit-confirm': ['#recruit.on #meta-recruit-confirm', ({ name }) => josa(name, '을/를') + ' 관측소에 영입하자.'],
  departure: ['#hub.on #meta-depart, #hub.on #meta-other-region', ({ name, region }) =>
    `${josa(name, '과/와')} ${josa(region, '으로/로')} 떠나자.`,
    ['#hub.on :is(#meta-depart, #meta-other-region, .recruit-receipts)']]
};

const TOURS = {
  heirloom: ['', '쓰러진 동료가 남긴 기술이야. 전투에서 한 번, MP 없이 쓸 수 있어.'],
  'last-stand': ['', '마지막 한 명은 공격·마공 ×1.5, 치명타율 +25%p를 받아.'],
  relic: ['', '이 유물은 이번 원정 동안 적용돼.'],
  'relic-replace': ['[data-replace]', '네 칸이 찼어. 새 유물로 바꿀 칸을 골라.'],
  'spring-draw': ['#spring.on #b-draw', '결정 1개로 한 번 뽑아. 새 동료가 합류하거나, 강화 또는 기억을 얻어.'],
  'spring-pick': ['#spring.on #b-pick', '후보 3칸은 무료로 보고, 한 명을 고를 때 결정 3개를 써.'],
  preparation: ['#sheet.on :is([data-can-invite], #meta-find-invites)', TERMS.springInvite.firstUse],
  difficulty: ['#sheet.on [data-difficulty="normal"]', '여정은 보통 난이도야. 이 지역을 여정으로 클리어하면 악몽이 열려.'],
  region: ['#sheet.on #meta-region-rule', '이 지역만의 전투 규칙이 있어.'],
  quirk: ['', '이 문에는 전투를 바꾸는 변덕이 있어.'],
  affix: ['', '이 적은 접두사에 따라 달라져.'],
  altar: ['#altar.on #b-roll', '세 번까지 굴려. 받으면 그 동료의 기존 축복을 바꿔.'],
  wager: ['', '조건을 달성하고 그 전투에서 이기면 보상을 받아.'],
  mission: ['#notebook.on [data-mission], #notebook.on [data-mission-guide]', '이번 주나 달의 목표를 달성하면 동료를 영입하거나 완료 도장을 받아.'],
  'daily-rift': ['#sheet.on #meta-daily-start, #sheet.on #meta-rift-resume',
    '오늘은 모두 같은 대여 동료로 시작해. 첫 도전과 연습은 따로 기록해.']
};

export function basicTutorial(profile) {
  const entry = profile.ui?.entry;
  return !!entry && (!entry.legacy || !!profile.ui.tutorialReplay) && !entry.skipped &&
    !entry.done.includes('departure');
}

export function createTutorial({ currentProfile, updateProfile, widgets, stage, core, roster }) {
  const coach = createCoach({
    face: widgets.face('rumi'),
    pause(on) { stage.pause(on || $('#sheet').classList.contains('on')); }
  });
  let battle;
  let visit;
  let usedTour;

  function mark(id, patch = {}) {
    const current = currentProfile();
    if (!basicTutorial(current)) return;
    const next = Meta.markEntryStep(current, id);
    updateProfile({ ...next, ui: { ...next.ui, ...patch } });
    coach.hide();
  }

  function dismissBasic() {
    const next = Meta.skipTutorial(currentProfile());
    updateProfile({ ...next, ui: { ...next.ui, entryDoor: null } });
    coach.hide();
  }

  function find(selector) {
    if (!selector) return [];
    return $$(selector).filter(node => node.getClientRects().length && !node.hidden && !node.disabled &&
      getComputedStyle(node).visibility === 'visible');
  }

  function basicStep(id, context, inBattle = false) {
    const [selector, copy, spotlights] = ENTRY[id];
    const targets = find(typeof selector === 'function' ? selector(context) : selector);
    if (!targets.length) return false;
    const line = typeof copy === 'function' ? copy(context) : copy;
    coach.show({ id, line, battle: inBattle, skip: dismissBasic }, targets, spotlights?.map(find));
    return true;
  }

  function tour(key, id, { selector, line, inBattle = false, interactive = false, multiple = false } = {}) {
    const entry = currentProfile().ui.entry;
    if (entry.legacy || entry.tours.includes(id) || (visit === key && usedTour)) return false;
    const matches = find(selector ?? TOURS[id][0]);
    const targets = multiple ? matches : matches.slice(0, 1);
    if (!targets.length) return false;
    visit = key;
    const acknowledge = () => {
      usedTour = true;
      updateProfile(Meta.markTour(currentProfile(), id));
      coach.hide();
    };
    coach.show({ id: 'tour-' + id, line: line ?? TOURS[id][1], battle: inBattle, acknowledge,
      activate: interactive ? acknowledge : undefined }, targets);
    return true;
  }

  function sync(run) {
    const screen = $('.screen.on')?.id;
    const sheet = $('#sheet').classList.contains('on');
    const profile = currentProfile();
    const { done, tours } = profile.ui.entry;
    const basic = basicTutorial(profile);
    const intro = run?.dungeonId === 'dawn_forest';
    const result = screen === 'battle' && $('#result').classList.contains('on');
    const ready = screen === 'battle' && battle?.run === run && !result && !battle.state.busy;
    if (basic && !sheet) {
      if (screen === 'title' && !done.includes('title') && basicStep('title')) return;
      if (intro && ready && run.room.type === 'borrowed') {
        const { D, intent, options, all } = battle.state;
        const { name, hp } = D.allies[D.cur];
        if (!done.includes('opening') && intent?.dmg && basicStep('opening', {
          name, hp, enemy: roster.card(D.enemy.form.replace(/^wild_/, ''))?.name ?? D.enemy.name, damage: formatRange(intent.dmg)
        }, true)) return;
        if (!done.includes('opening-followup')) {
          if (done.includes('opening-stand')) {
            const heirloom = options.find(option => option.heirloom && option.usable);
            if (heirloom && basicStep('inherit', { name: heirloom.heirFromName, next: name, skill: heirloom.name }, true)) return;
          }
          if (done.includes('opening-rescue')) {
            const retreated = all.find(event => event.t === 'retreat');
            const damage = option => option.preview.min ?? option.preview.dmg;
            const skill = options.filter(option => option.usable && option.preview && !option.preview.delayed)
              .sort((a, b) => damage(b) - damage(a))[0];
            if (retreated && skill && basicStep('rescue', {
              name: D.allies[retreated.who.idx].name, next: name, skill: skill.name, index: skill.index
            }, true)) return;
          }
        }
      }
      if (intro && screen === 'awaken' && run.pending?.kind === 'start' && !done.includes('awakening')) {
        const picked = $('#wake-choices .cardrow.sel')?.dataset.id;
        if (picked ? basicStep('awakening-confirm', { name: widgets.card(picked).name }) : basicStep('awakening')) return;
      }
      if (intro && screen === 'map' && run.floor === 3 && !done.includes('door') && basicStep('door')) return;
      if (intro && screen === 'order' && run.floor === 3 && !done.includes('formation') && basicStep('formation')) return;
      if (intro && screen === 'recruit' && run.result === 'win' && !done.includes('recruit') && $('[data-candidate]')) {
        const picked = $('[data-candidate][aria-pressed="true"]')?.dataset.candidate;
        if (picked ? basicStep('recruit-confirm', { name: widgets.card(picked).name }) : basicStep('recruit')) return;
      }
      if (!run && screen === 'hub' && profile.lead && Meta.featureFlags(profile).introCleared &&
        (!Meta.featureFlags(profile).firstMainCleared || profile.ui.tutorialReplay)) {
        const destination = DUNGEONS[$('#meta-depart [data-region]')?.dataset.region];
        if (destination && basicStep('departure', { name: widgets.card(profile.lead).name, region: destination.name })) return;
      }
    }

    const key = visitKey(result ? 'battle-result' : screen, run, sheet);
    if (coach.id?.startsWith('tour-') && visit === key) return;
    coach.hide();
    if (profile.ui.entry.legacy) return;
    if (visit !== key) usedTour = false;
    if (sheet) {
      if ($('.meta-prep')) {
        if (tour(key, 'preparation') || tour(key, 'difficulty')) return;
        const rule = $('#meta-region-rule')?.dataset.rule;
        if (rule) tour(key, 'region', { line: rule });
      } else if (screen === 'hub') {
        const resume = $('#meta-rift-resume');
        const date = resume?.dataset.riftDate;
        tour(key, 'daily-rift', { line: date ? date + ' 균열은 저장한 대여 동료로 이어가. 첫 도전과 연습은 따로 기록해.' : undefined });
      }
      return;
    }
    if (screen === 'notebook') return tour(key, 'mission');
    if (!run || run.daily) return;
    if (screen === 'spring') {
      if (!tour(key, 'spring-draw', { interactive: true })) tour(key, 'spring-pick', { interactive: true });
    } else if (screen === 'altar') {
      tour(key, 'altar');
    } else if (screen === 'event' && run.features?.bets !== false) {
      const wager = eventChoices(run, core, roster).find(choice => choice.enabled && choice.ops.some(op => op.type === 'bet'));
      if (wager) tour(key, 'wager', { selector: `#event.on [data-choice="${CSS.escape(wager.id)}"]` });
    } else if (screen === 'map') {
      const selector = door => `#map.on .door-entry[data-door="${door.index}"]`;
      const quirky = run.features?.quirks !== false && run.doors.find(door => QUIRKS[door.quirk]);
      if (quirky) {
        const rule = QUIRKS[quirky.quirk];
        if (tour(key, 'quirk', { selector: selector(quirky), line: rule.name + ' · ' + rule.desc })) return;
      }
      const prefixed = run.features?.affixes !== false && run.doors.find(door => door.enemies.some(enemy => enemy.affixes?.length));
      if (prefixed) {
        const affixes = [...new Set(prefixed.enemies.flatMap(enemy => enemy.affixes ?? []))].map(id => AFFIXES[id]).filter(Boolean);
        if (affixes.length && tour(key, 'affix', { selector: selector(prefixed),
          line: affixes.map(rule => rule.name + ' · ' + rule.desc).join(' / ') })) return;
      }
      const regional = run.features?.regionRules !== false && run.doors.find(door => door.enemies.length && REGIONS[door.region?.id]);
      if (regional && tour(key, 'region', {
        selector: selector(regional),
        line: REGIONS[regional.region.id].desc
      })) return;
      if (!tours.includes('relic') && run.relics.length) tour(key, 'relic', { selector: '#map.on .relic-slot:not(.empty)' });
    } else if (screen === 'treasure' || result) {
      if (tour(key, 'relic-replace', { interactive: true, multiple: true })) return;
      if (result && tour(key, 'last-stand', { selector: '#result.on [data-coach="last-stand"]' })) return;
      if (result && tour(key, 'heirloom', { selector: '#result.on [data-coach="heirloom-transfer"]' })) return;
      const scope = result ? '#result.on' : '#treasure.on';
      if (tour(key, 'relic', { selector: scope + ' :is(#b-equip, .run-relic-choice)', interactive: true })) return;
      tour(key, 'relic', { selector: scope + ' .relic-slot:not(.empty)' });
    } else if (ready) {
      if (battle.state.all.some(event => event.t === 'heirloom') &&
        tour(key, 'heirloom', { selector: '#b-heir.on', inBattle: true, interactive: true })) return;
      if (tour(key, 'last-stand', { selector: '#pa-chips [data-coach="last-stand"]', inBattle: true })) return;
      const rule = run.features?.regionRules !== false && REGIONS[run.room.region?.id];
      if (rule) tour(key, 'region', { line: rule.desc, selector: '#b-field', inBattle: true });
    }
  }

  let section;
  let generation = 0;
  function visitKey(screen, run, sheet) {
    const next = [screen, run?.id, run?.floor, sheet && $('#sh-title').textContent].join('/');
    if (next !== section) {
      section = next;
      generation++;
    }
    return generation;
  }

  function accepted(run, command, events) {
    const profile = currentProfile();
    if (!basicTutorial(profile) || run.dungeonId !== 'dawn_forest' || run.room.type !== 'borrowed') return;
    const saved = profile.ui.entryBattle;
    const actions = saved?.runId === run.id ? saved.actions : [];
    const nextActions = [...actions, command];
    const done = profile.ui.entry.done;
    let next = profile;
    if (!done.includes('opening')) {
      next = Meta.markEntryStep(Meta.markEntryStep(next, 'opening'), command === 'retreat' ? 'opening-rescue' : 'opening-stand');
    } else if (!done.includes('opening-followup')) {
      next = Meta.markEntryStep(next, 'opening-followup');
      if (events.some(event => event.t === 'act' && event.heirFrom)) next = Meta.markTour(next, 'heirloom');
    }
    updateProfile({ ...next, ui: { ...next.ui, entryBattle: { runId: run.id, actions: nextActions } } });
    coach.hide();
  }

  function reset() {
    battle = null;
    visit = section = null;
    usedTour = false;
    coach.hide();
  }

  return {
    mark, sync, accepted, reset,
    battleReady(run, state) { battle = { run, state }; sync(run); },
    battleActions(run) {
      const saved = currentProfile().ui.entryBattle;
      return saved?.runId === run.id && Array.isArray(saved.actions) ? saved.actions : [];
    }
  };
}
