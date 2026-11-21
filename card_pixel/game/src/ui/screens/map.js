import { $, $$, esc, show } from '../dom.js';
import { activeContract, affixChips, foeFlip, head, tempoBeatText, TYPE } from '../widgets.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import * as Run from '../../engine/run.js';
import { CONTRACTS, gateEscrow } from '../../content/contracts.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { ROOM_NAMES } from '../../content/layouts.js';
import { REGIONS } from '../../content/regions.js';
import { QUIRKS } from '../../content/quirks.js';
import { AFFIXES } from '../../content/affixes.js';
import { getWalkLayout, mapPosition, mountWalkingMap } from '../../stage/walking-map.js';
import { shortRiftDate } from './daily-rift.js';
import { bindRelicSlots, openRelicSheet, relicEffect, relicStrip } from '../relics.js';
import { mountFormation } from './order.js';

const AFFIX_RISK = {
  tough: '첫 3턴 적 피해 50% 감소', frenzy: '적 HP 50% 이하 시 공·마공 ×1.5',
  leech: '적이 가한 피해의 50% 회복', thorns: '물리 피해 25% 반사'
};
const ROOM_EFFECT = {
  spring: '결정으로 동료 깨우기', altar: '무작위 동료 축복 · 최대 3회',
  event: '사건 선택', treasure: '유물 장착'
};
const REGION_RISK = {
  ember_carry: '교대 시 작열 최대 2 계승', twilight_bell: '3·6·9턴 적 디바인 +2',
  tide_cycle: REGIONS.tide_cycle.desc, arena_charge: '일반 공격 2회 명중 → 공격 스킬 ×2'
};
const BOSS_LESSON = {
  iris_curse: '10턴 아포칼립스 · 선두에 물리 ×5',
  iris_love: '7턴 소울드레인 · 명중하면 현재 MP 전부 소멸',
  pharaoh: '5턴마다 고대의저주 · 이번 턴 피격 시 ×3, 미피격 시 ×1',
  poseidon: '5턴 어비스블레싱 · 자기 약화 전부 해제',
  ares: '3·8턴 충전 → 다음 턴 ×4',
  creator_god: '1턴 물리 → 2턴 저지먼트·마법 ×3.5'
};

export function doorLesson(preview) {
  const lesson = preview?.lesson;
  const boss = preview?.bossRule;
  if (!lesson) return boss && (BOSS_LESSON[boss.bossId] ?? boss.text);
  const [first, second] = lesson.steps ?? [];
  const step = second ?? first;
  if (!step) return '';
  const type = TYPE[step.type] || '';
  const power = value => Number.isFinite(value) ? ' ×' + value.toFixed(2) : '';
  let rule = [step.name, step.val > 0 ? type + ' ×' + step.val.toFixed(2) : ''].filter(Boolean).join(' · ');
  switch (step.rule) {
    case 'front_hit': rule = '선두에 ' + type + power(step.val); break;
    case 'mana_drain': rule = '마법 · HP 0' + (step.drainFlat != null ? ' / 현재 MP −' + step.drainFlat : ''); break;
    case 'retaliation': rule = '마법 · 피격 시' + power(step.hitPower) + ', 미피격 시' + power(step.val); break;
    case 'cleanse': rule = '정화 · 자기 약화 전부 해제'; break;
    case 'charged_hit': rule = type + power(step.val); break;
    case 'magic_followup': rule = '마법' + power(step.val); break;
    case 'defense_protocol': rule = '직전 피격 종류의 방어 +' + Math.round(step.bonus * 100) + '%'; break;
    case 'alternating_defense': rule = '홀수 마방 / 짝수 물방 +' + Math.round(step.bonus * 100) + '%'; break;
    case 'lesson_guard': rule = '다음 턴 받는 피해 ' + Math.round(step.reduction * 100) + '% 감소'; break;
    case 'swap_stats': rule = '마법' + power(step.val) + ' · 명중 뒤 공·마공, 물방·마방 교환'; break;
  }
  return '2턴째 ' + rule + (first?.rule === 'charge' ? ' · 1턴 ' + first.name :
    step.rule === 'magic_followup' ? ' · 1턴 물리' : '');
}
function confront(name) {
  const endsWithConsonant = /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0;
  return name + (endsWithConsonant ? '과 대면' : '와 대면');
}

function primaryBeat(door, preview) {
  const pattern = preview?.pattern ?? door.tempo?.pattern;
  const beats = preview?.enemies?.[0]?.beats ?? [];
  const turn = { introFixed: 1, threeBeat: 2, tide: 3 }[pattern];
  return beats.find(beat => beat.turn === turn) ?? (pattern === 'bossScript'
    ? beats.filter(beat => TYPE[beat.type] && beat.power > 1).sort((a, b) => b.power - a.power || a.turn - b.turn)[0]
    : undefined);
}

function contractEscrow(run, door) {
  const amount = gateEscrow(run.floor, door.type);
  return amount && CONTRACTS[run.contract?.id] ? amount : 0;
}

export function doorDecision(run, door, preview) {
  const crystals = (door.reward ?? 0) - contractEscrow(run, door);
  if (!door.enemies.length) return REGIONS[door.regionChoice?.id]?.name ?? ROOM_NAMES[door.type] ?? door.name;
  if (preview?.bossRule) return door.type === 'boss' ? preview.bossRule.name ?? door.name : door.name;
  if (preview?.lesson) return '2턴째 예행' + (!run.daily && crystals > 0 ? ' · 결정 ' + crystals : '');
  const beat = primaryBeat(door, preview);
  const type = TYPE[beat?.type ?? door.intent];
  const risk = type
    ? type + (beat?.name === '일반 공격' ? ' 공격' : ' 강공')
    : ROOM_NAMES[door.type] ?? door.name;
  return !run.daily && crystals > 0 ? risk + ' · 결정 ' + crystals : risk;
}

export function mapScreen(run, ui, { awakened = [], receipt } = {}) {
  ui.playMusic();
  const { core, widgets, sheets, artifacts, scene, icon } = ui;
  const { card, spr, sprite, face, faceBadge } = widgets;
  const { openSheet } = sheets;
  const dungeon = DUNGEONS[run.dungeonId];
  const node = $('#map');
  const intro = dungeon.layout === 'intro';
  const gate = run.doors.find(door => door.type === 'gate');
  const rift = run.daily;
  const gateIds = rift?.spec?.gateIds ?? gate?.enemies?.map(enemy => enemy.sprite) ?? [];
  const bossId = rift?.spec?.bossId;
  const boss = run.bossPreview || (bossId && ui.roster.bosses.includes(bossId) ? ui.roster.bossOf(bossId) : null);
  const shadow = id => '<span class="run-face shadow-tint">' + face(id, 28) + '</span>';

  const track = Array.from({ length: run.floors }, (_, index) => {
    const floor = index + 1;
    let marker = '';
    if (rift && floor === 4) {
      marker = gateIds.length ? gateIds.map(shadow).join('') : icon('gate');
    } else if (intro && floor === run.floors) {
      const shadows = gate?.enemies.map(enemy => enemy.sprite) || [run.reserved, null];
      marker = shadows.map(id => id ? shadow(id) : icon('nightmare')).join('');
    } else if (!intro && floor === 4) {
      marker = run.reserved ? shadow(run.reserved) : icon('gate');
    } else if (floor === run.floors && boss?.sprite) {
      marker = '<span class="run-face">' + face(boss.sprite, 28) + '</span>';
    }
    const classes = (floor === run.floor ? ' cur' : floor < run.floor ? ' done' : '') +
      (rift && floor === 4 && gateIds.length > 1 ? ' rift-gate' : '');
    return '<span class="floor-cell' + classes + '"><small>' + floor + '</small>' + marker + '</span>';
  }).join('');

  function startSky(door) {
    if (!door.enemies.length) return '';
    const field = Run.doorStart?.(run, door.index)?.field ?? door.start?.field;
    if (!Array.isArray(field) || (!field.length && door.region?.id !== 'starlit_sky')) return '';
    return '시작 필드 · ' + (field.map(id => core.BUFF_NAMES[id] || id).join(' · ') || '비어 있음');
  }

  function risks(door) {
    const lines = [];
    if (door.regionChoice) lines.push('후반 · ' + REGIONS[door.regionChoice.id].name);
    if (door.quirk) lines.push(QUIRKS[door.quirk].desc);
    for (const id of new Set(door.enemies.flatMap(enemy => enemy.affixes || []))) {
      if (AFFIX_RISK[id]) lines.push(AFFIX_RISK[id]);
    }
    const sky = startSky(door);
    if (sky) lines.push(sky);
    const regionalRisk = REGION_RISK[door.region?.id];
    if (regionalRisk && door.enemies.length && !(door.region.id === 'tide_cycle' && door.type === 'boss')) {
      lines.push(regionalRisk);
    }
    return lines;
  }

  function reward(door, crystalLabel = '결정') {
    const crystals = (door.reward ?? 0) - contractEscrow(run, door);
    const relic = !door.final && artifacts.get(door.relic);
    return [
      !rift && crystals ? crystalLabel + ' +' + crystals : '',
      !rift && door.type === 'gate' && !door.final ? (relic ? '그림자 1명 또는 ' + relic.name : '그림자 1명') : relic?.name
    ].filter(Boolean).join(' · ');
  }

  function roomEffect(door) {
    const count = run.bench.length;
    if (run.floor === 7 && count < 3) {
      if (door.type === 'altar') return count ? '현재 ' + count + '명 중 한 명 축복' : '축복 받을 동료 없음';
      if (door.type === 'spring') {
        const missing = 3 - count;
        const cost = missing * Run.COST.draw;
        const short = cost - run.crystals;
        return '현재 ' + count + '명 · 결정 ' + cost + '개로 ' + (missing === 1 ? '셋째' : missing + '명') + ' 깨우기' +
          (short > 0 ? ' · 결정 ' + short + '개 부족' : '');
      }
    }
    return ROOM_EFFECT[door.type] || '';
  }

  function contractGoal(door) {
    const contract = activeContract(run);
    if (!contract) return '';
    const { floor } = run;
    const eliteRisk = contract.id === 'elite' && floor === 2 && door.risk;
    const relevant = contract.id === 'elite'
      ? eliteRisk || (floor === 6 && door.type === 'elite')
      : floor === 4 || floor === 6;
    if (!relevant) return '';
    const goal = eliteRisk ? '이 위험 문을 거쳐 6층 정예에 도전합니다.' : contract.rule;
    return '<h4>계약 · ' + esc(contract.name) + '</h4><p>' + esc(goal) + '</p>' +
      (run.contract.met ? '<p>달성</p>' : '');
  }

  function doorPreview(door) {
    if (door.enemies.length) {
      const previews = door.enemies.map(enemy => {
        const types = ['phy', 'mag'].filter(type => enemy.skills.some(skill => skill.type === type));
        const element = ELEMENT[enemy.element];
        const dot = element ? '<i class="door-element el-' + enemy.element + '" role="img" aria-label="' + element + '"></i>' : '';
        const attacks = types.map(type => '<span class="' + type + '">' + TYPE[type] + '</span>').join('');
        return '<span class="door-enemy" title="' + esc(enemy.name) + '">' +
          sprite(enemy.sprite, { flip: foeFlip(enemy), cls: 'shadow-tint' }) +
          '<small class="door-intent">' + dot + attacks + '</small></span>';
      }).join('');
      return '<span class="door-lineup">' + previews + '</span>';
    }
    const visitor = door.event?.requires?.present?.[0];
    if (visitor) return '<span class="run-face" title="' + esc(card(visitor).name) + '">' + face(visitor, 44) + '</span>';
    return icon(door.type);
  }

  const layout = getWalkLayout(run);
  const tempoViews = run.doors.map(door => Run.getTempoView?.(run, door.index));
  const lessonLine = door => {
    const lesson = doorLesson(tempoViews[door.index]);
    return lesson ? '<small class="door-lesson">' + icon('battle') + '<span>' + esc(lesson) + '</span></small>' : '';
  };
  const portals = run.doors.map((door, index) => {
    const [x, y] = mapPosition(layout.branches[index].center);
    const enemy = door.enemies[0];
    const visitor = door.event?.requires?.present?.[0];
    const art = (enemy && sprite(enemy.sprite, { flip: foeFlip(enemy), cls: 'map-door-shadow' })) ||
      (visitor && sprite(visitor)) || icon(door.relic || (door.type === 'wild' ? 'battle' : door.type));
    const label = doorDecision(run, door, tempoViews[index]);
    return '<button type="button" class="map-door" data-map-door="' + index + '" data-kind="' + door.type +
      '" aria-label="' + esc(door.name + ' · ' + label) + '" style="--door-x:' + x + ';--door-y:' + y + '">' +
      '<span class="map-door-frame" aria-hidden="true"><span class="map-door-light"></span>' +
      '<span class="map-door-emblem">' + art + '</span></span><small class="map-door-line">' + esc(label) +
      '</small></button>';
  }).join('');

  const doors = run.doors.map(door => {
    const enemy = door.enemies[0];
    const isShowdown = run.doors.length === 1 && !!enemy;
    const opponent = enemy?.source ? card(enemy.source).name : enemy?.name;
    const title = isShowdown && opponent ? confront(opponent) : door.name;
    const info = [
      isShowdown ? ROOM_NAMES[door.type] : door.type === 'event' ? '사건' : enemy?.name,
      door.enemies.length > 1 ? door.enemies.length + '연전' : ''
    ].filter(Boolean).join(' · ');
    const risksHere = risks(door);
    const rules = risksHere.join(' · ') || roomEffect(door);
    const gain = reward(door);
    const quirk = door.quirk ? '<i>' + esc(QUIRKS[door.quirk].name) + '</i>' : '';
    const chips = quirk + door.enemies.map(affixChips).join('');
    return '<div class="door-plate win" data-door-preview="' + door.index + '"><button class="door-entry" data-door="' + door.index + '">' +
      doorPreview(door) + '<span class="door-copy"><b>' + esc(title) + '</b>' +
      (info ? '<small>' + esc(info) + '</small>' : '') +
      (chips ? '<span class="chips door-chips">' + chips + '</span>' : '') +
      (rules ? '<small class="door-risk' + (risksHere.length ? ' danger' : '') + '">' + esc(rules) + '</small>' : '') +
      lessonLine(door) +
      (gain ? '<small class="door-reward">' + esc(gain) + '</small>' : '') +
      '</span>' + (door.relic && !door.final ? icon(door.relic) : '') + '</button><button class="door-info" data-info="' + door.index + '" aria-label="' +
      esc(title) + ' 정보">정보</button></div>';
  }).join('');

  const front = Run.defaultParty(run);
  const lineup = party => party.map((id, index) => {
    if (!id) return '';
    const role = POSITION[index];
    const art = spr(id);
    if (!art) return '';
    const flip = art.facing === 'left';
    const scale = .85;
    const style = 'width:' + art.w * scale + 'px;height:' + art.h * scale + 'px;' +
      'left:' + (-art.cx * scale) + 'px;top:' + (-(art.fy + 1) * scale) + 'px;' +
      'transform-origin:' + art.cx * scale + 'px ' + (art.fy + 1) * scale + 'px;';
    return '<div class="map-walker-anchor" data-seat="' + index + '">' +
      '<button type="button" class="map-actor map-walker" data-sheet="' + esc(id) + '" aria-label="' + esc(role + ' ' + card(id).name) + '">' +
      '<span class="map-walker-art">' + sprite(id, { flip, style }) + '</span><small>' + role + '</small></button></div>';
  }).join('');
  const landscape = '<div class="map-landscape" aria-hidden="true"></div>';
  const trails = '<div class="map-trails" aria-hidden="true">' + '<canvas class="map-trail"></canvas>'.repeat(1 + run.doors.length) + '</div>';
  const cast = '<div class="map-walkers">' + lineup(front) + '</div>';
  const skip = '<button type="button" class="map-skip" hidden><span>건너뛰기</span></button>';
  const title = rift ? [shortRiftDate(rift.spec?.dayKey), '균열'].filter(Boolean).join(' ') : dungeon.name;
  const faces = awakened.length ? '<div class="map-awaken win"><b>함께 깨어남</b><div class="map-awaken-faces">' +
    awakened.map((id, index) => '<button class="btn" data-sheet="' + esc(id) + '" style="--wake-delay:' +
      index * 170 + 'ms">' + faceBadge(id) + '</button>').join('') + '</div></div>' : '';
  node.innerHTML = head(run, title, run.floor + '층') + relicStrip(core, run.relics) + '<div class="run-route">' +
    '<button class="floor-strip" id="b-floors" aria-label="층 진행과 문지기 정보">' + track + '</button>' +
    scene(dungeon.background, landscape + trails + cast + '<div class="map-portals">' + portals + '</div>' + skip, 'walking-map') +
    faces + (receipt ? '<p class="map-receipt gain" role="status">' + esc(receipt) + ' · 장착 완료</p>' : '') +
    '<div class="run-doors">' + doors + '</div><div class="map-formation formation" hidden></div></div>';
  show('map');
  bindRelicSlots(node, run.relics, id => {
    ui.audio.sfx.tap();
    openRelicSheet(openSheet, artifacts.get(id));
  });
  const walk = mountWalkingMap($('.walking-map', node), layout, {
    run,
    instant: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.__game?.clock?.speed > 1,
    open: ui.route,
    footstep: ui.audio.sfx.enter
  });
  let locked = false;
  let selected = null;
  let formation = null;
  const choices = $$('[data-door], [data-map-door]', node);
  const formationNode = $('.map-formation', node);

  function enter(party) {
    if (locked) return;
    const battle = !!run.doors[selected]?.enemies.length;
    const result = battle ? ui.enterFormation(selected, party) : ui.command(Run.chooseDoor, selected);
    if (!result.ok) return;
    locked = true;
    for (const button of $$('button:not(.map-skip)', node)) button.disabled = true;
    $('.walking-map', node).scrollIntoView({ block: 'nearest' });
    walk.select(selected);
  }

  function choose(index) {
    if (locked) return;
    const door = run.doors[index];
    selected = index;
    for (const button of choices) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.door ?? button.dataset.mapDoor) === index));
    }
    for (const plate of $$('[data-door-preview]', node)) {
      plate.classList.toggle('previewing', Number(plate.dataset.doorPreview) === index);
    }
    if (!door.enemies.length) {
      ui.audio.unlockAudio();
      ui.audio.sfx.tap();
      enter();
      return;
    }
    formationNode.hidden = false;
    if (formation) formation.selectDoor(door);
    else formation = mountFormation(formationNode, run, ui, {
      door, party: front, entryLabel: '이 편성으로 입장', onEnter: enter,
      onChange(party) {
        $('.map-walkers', node).innerHTML = lineup(party);
        walk.updateActors();
      }
    });
  }
  for (const button of choices) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.door ?? button.dataset.mapDoor);
      if (run.doors[index].enemies.length) ui.audio.sfx.tap();
      choose(index);
    });
  }
  if (run.doors.length === 1 && run.doors[0].enemies.length) choose(0);
  $('.map-walkers', node).addEventListener('click', event => {
    const id = event.target.closest('[data-sheet]')?.dataset.sheet;
    if (!id || locked) return;
    event.stopPropagation();
    ui.audio.sfx.tap();
    ui.companion?.(id, formation?.blessingView(id));
  });
  for (const button of $$('[data-info]', node)) {
    button.addEventListener('click', () => {
      if (!locked) describeDoor(run.doors[Number(button.dataset.info)]);
    });
  }
  $('#b-floors', node).addEventListener('click', () => {
    const names = rift ? gateIds.map(id => card(id)?.name || id).join(' · ')
      : gate?.enemies.map(enemy => enemy.name).join(' · ') || (run.reserved ? card(run.reserved).name : '');
    const middle = names ? '<p>' + (intro ? '5층' : '4층') + ' · 문지기 ' + esc(names) + '</p>' : '';
    openSheet('층 진행', '<p>현재 ' + run.floor + ' / ' + run.floors + '층</p>' + middle +
      (boss?.name ? '<p>' + run.floors + '층 · ' + esc(boss.name) + '</p>' : '') +
      (boss?.note ? '<p>' + esc(boss.note) + '</p>' : ''));
  });

  function describeDoor(door) {
    const ready = Run.doorEnemies?.(run, door.index);
    const tempo = tempoViews[door.index];
    const enemies = door.enemies.map((enemy, index) => {
      const strong = Object.keys(ELEMENT).filter(element => core.Logic.getElementalMultiplier(element, enemy.element) > 1);
      const preview = tempo?.enemies?.[index];
      const hp = preview?.maxHp ?? ready?.[index]?.maxHp ?? enemy.stats.hp;
      const beats = preview?.beats?.map(beat => tempoBeatText(beat, tempo.lesson?.steps?.[beat.turn - 1])) ?? [];
      return '<div class="run-foe-detail">' + sprite(enemy.sprite, { flip: foeFlip(enemy), cls: enemy.look === 'shadow' ? 'shadow-tint' : '' }) +
        '<div><h4>' + esc(enemy.name) + '</h4><p>' + esc(ELEMENT[enemy.element] || '') + ' · HP ' + hp + '</p>' +
        (strong.length ? '<p>상성 우위 · ' + strong.map(element => ELEMENT[element]).join(' · ') + '</p>' : '') +
        (beats.length ? '<p>' + esc(beats.join(' / ')) + '</p>' : '') +
        (enemy.note ? '<p>' + esc(enemy.note) + '</p>' : '') +
        (enemy.affixes || []).map(id => '<p>' + esc(AFFIXES[id].name + (id === 'treasure' ? '' : ' · ' + AFFIXES[id].desc)) + '</p>').join('') + '</div></div>';
    }).join('');
    const region = REGIONS[door.region?.id], quirk = QUIRKS[door.quirk], relic = !door.final && artifacts.get(door.relic);
    const rule = entry => entry ? '<h4>' + esc(entry.name) + '</h4><p>' + esc(entry.desc) + '</p>' : '';
    const sky = startSky(door), gain = reward(door, '확정 결정');
    const escrow = contractEscrow(run, door);
    const treasure = door.enemies.some(enemy => enemy.affixes?.includes('treasure'));
    const service = run.floor === 7 && run.bench.length < 3 ? roomEffect(door) : '';
    openSheet(door.name, lessonLine(door) + enemies + rule(quirk) + rule(region) +
      (sky ? '<p>' + esc(sky) + '</p>' : '') +
      (door.event ? '<p>' + esc(door.event.text) + '</p>' : '') +
      (service ? '<p>' + esc(service) + '</p>' : '') +
      (service && door.type === 'spring' ? '<p>보유 결정 ' + run.crystals + '개</p>' : '') +
      (gain ? '<p class="gain">' + esc(gain) + '</p>' : '') +
      (escrow ? '<p>계약에 ◆' + escrow + ' 맡김</p>' : '') +
      (treasure ? '<p class="gain">추가 보상 · 보물 적 처치 후 승리 시 1명당 결정 +2</p>' : '') + contractGoal(door) +
      (relic ? rule({ ...relic, desc: relicEffect(relic) }) : ''));
  }
}
