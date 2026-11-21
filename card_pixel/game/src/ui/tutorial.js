import { $, $$ } from './dom.js';
import { createCoach } from './coach.js';
import { TERMS } from './glossary.js';
import * as Meta from '../engine/meta.js';
import { QUIRKS } from '../content/quirks.js';
import { AFFIXES } from '../content/affixes.js';
import { REGIONS } from '../content/regions.js';
import { eventChoices } from '../engine/rooms.js';

const ENTRY = {
  title: ['#title.on #b-start', '형아, 루미가 하나씩 알려 줄게. 새벽의 숲으로 가 보자!'],
  opening: ['#battle.on .opening-choice', '골렘이 공격해. 애쉬로 맞설지, 뒤로 물릴지 골라.'],
  inherit: ['#battle.on #b-heir.on', '눈토끼가 애쉬의 아마겟돈을 받았어. 써 봐.'],
  rescue: ['#battle.on .act[data-i="0"]', '애쉬는 살아 있어. 이제 앞에 선 동료로 공격해.'],
  awakening: ['#awaken.on [data-coach="awakening-candidate"]', '이번 원정에 함께할 동료 한 명을 골라.'],
  'awakening-confirm': ['#awaken.on [data-coach="awakening-confirm"]', '고른 동료와 함께 가자.'],
  door: ['#map.on .door-entry[data-coach="door"]', '문에 적의 공격이 보여. 가고 싶은 문을 눌러.'],
  formation: ['#order.on [data-coach="formation-confirm"]', '선봉부터 싸워. 준비됐으면 시작해.'],
  recruit: ['#recruit.on [data-candidate]', '돌아온 동료 한 명을 다음에도 만날 수 있어.'],
  'recruit-confirm': ['#recruit.on #meta-recruit-confirm', '이 동료를 관측소에 영입하자.'],
  departure: ['#hub.on #meta-depart, #hub.on #meta-other-region', '이 동료와 첫 던전으로 떠나자.']
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

  function basicStep(id, inBattle = false, selector) {
    const [target, line] = ENTRY[id];
    const targets = find(selector ?? target);
    if (targets.length) coach.show({ id, line, battle: inBattle, skip: dismissBasic }, targets);
    return targets.length > 0;
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
        if (!done.includes('opening') && basicStep('opening', true)) return;
        if (!done.includes('opening-followup')) {
          if (done.includes('opening-stand') && battle.state.all.some(event => event.t === 'heirloom')) {
            if (basicStep('inherit', true)) return;
          }
          if (done.includes('opening-rescue')) {
            const storm = battle.state.options.find(option => option.name === '실버스톰' && option.usable);
            if (basicStep('rescue', true, storm && `#battle.on .act[data-i="${storm.index}"]`)) return;
          }
        }
      }
      if (intro && screen === 'awaken' && run.pending?.kind === 'start' && !done.includes('awakening')) {
        if (basicStep($('#b-wake')?.disabled ? 'awakening' : 'awakening-confirm')) return;
      }
      if (intro && screen === 'map' && run.floor === 3 && !done.includes('door') && basicStep('door')) return;
      if (intro && screen === 'order' && run.floor === 3 && !done.includes('formation') && basicStep('formation')) return;
      if (intro && screen === 'recruit' && run.result === 'win' && !done.includes('recruit') && $('[data-candidate]')) {
        if (basicStep($('[data-candidate][aria-pressed="true"]') ? 'recruit-confirm' : 'recruit')) return;
      }
      if (!run && screen === 'hub' && profile.lead && Meta.featureFlags(profile).introCleared &&
        (!Meta.featureFlags(profile).firstMainCleared || profile.ui.tutorialReplay) && basicStep('departure')) return;
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
