import { $, $$, esc, show, sleep } from '../dom.js';
import { affixChips, foeFlip, head, TYPE } from '../widgets.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import * as Run from '../../engine/run.js';
import { CONTRACTS, CONTRACT_ESCROW } from '../../content/contracts.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { ROOM_NAMES } from '../../content/layouts.js';
import { REGIONS } from '../../content/regions.js';
import { QUIRKS } from '../../content/quirks.js';
import { AFFIXES } from '../../content/affixes.js';

const MARCH_MS = 500;
const AFFIX_RISK = {
  tough: '첫 3턴 적 피해 절반', frenzy: '적 HP 절반부터 공격 ×1.5',
  leech: '적이 준 피해의 절반 회복', thorns: '물리 피해 25% 반사'
};
const ROOM_EFFECT = {
  spring: '결정으로 동료 깨우기', altar: '무작위 동료 축복 · 최대 세 번',
  event: '사건 선택', treasure: '유물 장착'
};
const REGION_RISK = {
  ember_carry: '교대 시 작열 최대 2 계승', twilight_bell: '3·6·9턴 적 디바인 +2',
  tide_cycle: REGIONS.tide_cycle.desc, arena_charge: '일반 공격 2회 명중 → 공격 기술 ×2'
};
function confront(name) {
  const endsWithConsonant = /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0;
  return name + (endsWithConsonant ? '과 대면' : '와 대면');
}

export function mapScreen(run, ui) {
  ui.playMusic();
  const { core, widgets, sheets, artifacts, scene, icon } = ui;
  const { card, spr, sprite, face, benchMinis } = widgets;
  const { openSheet } = sheets;
  const dungeon = DUNGEONS[run.dungeonId];
  const node = $('#map');
  const intro = dungeon.layout === 'intro';
  const gate = run.doors.find(door => door.type === 'gate');
  const boss = run.bossPreview;
  const shadow = id => '<span class="run-face shadow-tint">' + face(id, 28) + '</span>';

  const track = Array.from({ length: run.floors }, (_, index) => {
    const floor = index + 1;
    let marker = '';
    if (intro && floor === run.floors) {
      const shadows = gate?.enemies.map(enemy => enemy.sprite) || [run.reserved, null];
      marker = shadows.map(id => id ? shadow(id) : icon('nightmare')).join('');
    } else if (!intro && floor === 4) {
      marker = run.reserved ? shadow(run.reserved) : icon('gate');
    } else if (floor === run.floors && boss.sprite) {
      marker = '<span class="run-face">' + face(boss.sprite, 28) + '</span>';
    }
    const classes = floor === run.floor ? ' cur' : floor < run.floor ? ' done' : '';
    return '<span class="floor-cell' + classes + '"><small>' + floor + '</small>' + marker + '</span>';
  }).join('');

  function startSky(door) {
    if (door.region?.id !== 'starlit_sky' || !door.enemies.length) return '';
    const field = Run.doorStart?.(run, door.index)?.field ?? door.start?.field;
    return field ? '시작 하늘 · ' + (field.map(id => core.BUFF_NAMES[id] || id).join(' · ') || '비어 있음') : '';
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
    const crystals = (door.reward ?? 0) - escrow(door);
    const relic = !door.final && artifacts.get(door.relic);
    return [
      crystals ? crystalLabel + ' +' + crystals : '',
      door.type === 'gate' && !door.final ? (relic ? '그림자 1명 또는 ' + relic.name : '그림자 1명') : relic?.name
    ].filter(Boolean).join(' · ');
  }

  function escrow(door) {
    return run.floor === 4 && door.type === 'gate' && CONTRACTS[run.contract?.id] ? CONTRACT_ESCROW : 0;
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
    const contract = CONTRACTS[run.contract?.id];
    if (!contract) return '';
    const { floor } = run;
    const eliteRisk = contract.id === 'elite' && floor === 2 && door.risk;
    const relevant = contract.id === 'elite'
      ? eliteRisk || (floor === 6 && door.type === 'elite')
      : floor === 4 || floor === 6;
    if (!relevant) return '';
    const goal = eliteRisk ? '이 위험 문을 지나 6층 정예에 도전한다.' : contract.rule;
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
    const visitor = door.event?.requires.present?.[0];
    if (visitor) return '<span class="run-face" title="' + esc(card(visitor).name) + '">' + face(visitor, 44) + '</span>';
    return icon(door.type);
  }

  const doors = run.doors.map(door => {
    const enemy = door.enemies[0];
    const isShowdown = run.doors.length === 1 && !!enemy;
    const opponent = enemy?.source ? card(enemy.source).name : enemy?.name;
    const title = isShowdown && opponent ? confront(opponent) : door.name;
    const info = [
      isShowdown ? ROOM_NAMES[door.type] : door.type === 'event' ? '사건' : enemy?.name,
      door.enemies.length > 1 ? door.enemies.length + '연전' : ''
    ].filter(Boolean).join(' · ');
    const rules = risks(door).join(' · ') || roomEffect(door);
    const gain = reward(door);
    const quirk = door.quirk ? '<i>' + esc(QUIRKS[door.quirk].name) + '</i>' : '';
    const chips = quirk + door.enemies.map(affixChips).join('');
    return '<div class="door-plate win"><button class="door-entry" data-door="' + door.index + '">' +
      doorPreview(door) + '<span class="door-copy"><b>' + esc(title) + '</b>' +
      (info ? '<small>' + esc(info) + '</small>' : '') +
      (chips ? '<span class="chips door-chips">' + chips + '</span>' : '') +
      (rules ? '<small class="door-risk">' + esc(rules) + '</small>' : '') +
      (gain ? '<small class="door-reward">' + esc(gain) + '</small>' : '') +
      '</span>' + (door.relic && !door.final ? icon(door.relic) : '') + '</button><button class="door-info" data-info="' + door.index + '" aria-label="' +
      esc(title) + ' 정보">정보</button></div>';
  }).join('');

  const front = run.bench.slice(0, 3).map((id, index) => ({ id, role: POSITION[index], art: spr(id) }));
  front.sort((a, b) => a.art.h - b.art.h);
  const lineup = front.map(({ id, role, art }) => {
    const flip = art.facing === 'left';
    const center = flip ? art.w - art.cx : art.cx;
    const style = 'width:' + art.w * 2 + 'px;height:' + art.h * 2 + 'px;' +
      'left:calc(50% - ' + center * 2 + 'px);bottom:' + (art.fy + 1 - art.h) * 2 + 'px;';
    return '<button class="map-actor" data-sheet="' + esc(id) + '" aria-label="' + esc(role + ' ' + card(id).name) + '">' +
      '<span class="map-actor-art">' + sprite(id, { flip, style }) + '</span><small>' + role + '</small></button>';
  }).join('');
  const cast = '<div class="map-party" style="--march-time:' + MARCH_MS + 'ms">' + lineup + '</div>';
  const reserve = { ...run, bench: run.bench.slice(3) };
  const more = reserve.bench.length > 6 ? '<button class="btn run-more" id="b-roster">+' + (reserve.bench.length - 6) + '</button>' : '';
  node.innerHTML = head(run, dungeon.name, run.floor + '층') + '<div class="run-route">' +
    '<button class="floor-strip" id="b-floors" aria-label="층 진행과 문지기 정보">' + track + '</button>' +
    scene(dungeon.background, cast) + '<div class="run-doors">' + doors + '</div>' +
    '<div class="run-map-party"><div class="benchrow">' + benchMinis({ ...reserve, bench: reserve.bench.slice(0, 6) }) + more +
    '</div><small>동료 ' + run.bench.length + ' · 쓰러짐 ' + run.fallen.length + '</small></div></div>';
  show('map');
  const party = $('.map-party', node);
  for (const button of $$('[data-door]', node)) {
    button.addEventListener('click', async () => {
      if (party.classList.contains('marching')) return;
      ui.audio.unlockAudio();
      ui.audio.sfx.tap();
      if (front.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        party.classList.add('marching');
        await sleep(MARCH_MS);
      }
      if (party.isConnected && node.classList.contains('on')) ui.enterDoor(Number(button.dataset.door));
    });
  }
  for (const button of $$('[data-info]', node)) {
    button.addEventListener('click', () => {
      if (!party.classList.contains('marching')) describeDoor(run.doors[Number(button.dataset.info)]);
    });
  }
  $('#b-floors', node).addEventListener('click', () => {
    const names = gate?.enemies.map(enemy => enemy.name).join(' · ') || (run.reserved ? card(run.reserved).name : '');
    const middle = names ? '<p>' + (intro ? '5층' : '4층') + ' · 문지기 ' + esc(names) + '</p>' : '';
    openSheet('층 진행', '<p>현재 ' + run.floor + ' / ' + run.floors + '층</p>' + middle +
      '<p>' + run.floors + '층 · ' + esc(boss.name) + '</p><p>' + esc(boss.note || '') + '</p>');
  });
  $('#b-roster', node)?.addEventListener('click', () => openSheet('대기 동료', '<div class="benchrow">' + benchMinis(reserve) + '</div>'));

  function describeDoor(door) {
    const ready = Run.doorEnemies?.(run, door.index);
    const enemies = door.enemies.map((enemy, index) => {
      const strong = Object.keys(ELEMENT).filter(element => core.Logic.getElementalMultiplier(element, enemy.element) > 1);
      const hp = ready?.[index]?.maxHp ?? enemy.stats.hp;
      return '<div class="run-foe-detail">' + sprite(enemy.sprite, { flip: foeFlip(enemy), cls: enemy.look === 'shadow' ? 'shadow-tint' : '' }) +
        '<div><h4>' + esc(enemy.name) + '</h4><p>' + esc(ELEMENT[enemy.element] || '') + ' · HP ' + hp + '</p>' +
        (strong.length ? '<p>상성 우위 · ' + strong.map(element => ELEMENT[element]).join(' · ') + '</p>' : '') +
        (enemy.note ? '<p>' + esc(enemy.note) + '</p>' : '') +
        (enemy.affixes || []).map(id => '<p>' + esc(AFFIXES[id].name + (id === 'treasure' ? '' : ' · ' + AFFIXES[id].desc)) + '</p>').join('') + '</div></div>';
    }).join('');
    const region = REGIONS[door.region?.id], quirk = QUIRKS[door.quirk], relic = !door.final && artifacts.get(door.relic);
    const rule = entry => entry ? '<h4>' + esc(entry.name) + '</h4><p>' + esc(entry.desc) + '</p>' : '';
    const sky = startSky(door), gain = reward(door, '확정 결정');
    const treasure = door.enemies.some(enemy => enemy.affixes?.includes('treasure'));
    const service = run.floor === 7 && run.bench.length < 3 ? roomEffect(door) : '';
    openSheet(door.name, enemies + rule(quirk) + rule(region) +
      (sky ? '<p>' + esc(sky) + '</p>' : '') +
      (door.event ? '<p>' + esc(door.event.text) + '</p>' : '') +
      (service ? '<p>' + esc(service) + '</p>' : '') +
      (service && door.type === 'spring' ? '<p>보유 결정 ' + run.crystals + '개</p>' : '') +
      (gain ? '<p class="gain">' + esc(gain) + '</p>' : '') +
      (escrow(door) ? '<p>계약에 ◆' + CONTRACT_ESCROW + ' 맡김</p>' : '') +
      (treasure ? '<p class="gain">추가 보상 · 보물 적 1명 처치마다 결정 +2</p>' : '') + contractGoal(door) + rule(relic));
  }
}
