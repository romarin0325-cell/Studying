import { esc } from './dom.js';
import { tools } from './settings.js';
import { ELEMENT, GRADE } from '../engine/roster.js';
import { AFFIXES } from '../content/affixes.js';

export const TYPE = { phy: '물리', mag: '마법', sup: '보조' };
export const DOOR = {
  wild: ['전투', '몽마가 기다린다'], elite: ['정예', '접두사 둘을 단 강적'], gate: ['문지기', '그림자의 릴레이 · 이기면 한 명이 동료가 된다'],
  boss: ['보스', '꿈의 주인'], spring: ['소환의 샘', '꿈의 결정으로 동료를 깨운다'], altar: ['혼돈의 제단', '무작위 동료에게 축복 · 세 번까지 굴린다']
};
export const foeFlip = def => (def.facing || 'right') === 'right';

export const riftKindLabel = kind => kind === 'practice' ? '연습' : '기록 도전';

export const head = (run, title, sub) => '<header class="top"><b>' + esc(title) + '</b>' +
  (sub ? '<span>' + esc(sub) + '</span>' : '') + '<span class="sp"></span><span class="gems">' +
  (run?.daily ? riftKindLabel(run.daily.kind) : '◆ ' + (run ? run.crystals : 0)) + '</span>' + tools() + '</header>';
export function badges(run, id) {
  const out = [];
  if (run && run.blessings[id]) out.push('<i class="bless">축복 +' + Math.round(run.blessings[id] * 100) + '%</i>');
  if (run && run.heirlooms[id]) out.push('<i class="heir">유품 ' + esc(run.heirlooms[id].name) + '</i>');
  return out.join('');
}

export const affixChips = def => (def.affixes || []).map(a => '<i class="affix">' + esc(AFFIXES[a].name) + '</i>').join('');

/** rows: [label, now, base, unit]. The base shows struck through when the value moved. */
export function statGrid(rows) {
  return '<div class="sg">' + rows.map(r => {
    const d = r[1] > r[2] ? 'up' : r[1] < r[2] ? 'down' : '';
    return '<span><em>' + r[0] + '</em><b class="' + d + '">' + r[1] + (r[3] || '') + '</b>' + (d ? '<small>' + r[2] + (r[3] || '') + '</small>' : '') + '</span>';
  }).join('') + '</div>';
}

export function createWidgets(ASSETS, card) {
  const spr = (id, pose) => ASSETS.sp[id + '-' + (pose || 'idle')] || ASSETS.sp[id + '-idle'];
  function sprite(id, o) {
    const m = spr(id, o && o.pose); if (!m) return '';
    const cls = ['px'].concat(o && o.cls ? [o.cls] : []).join(' ');
    const style = (o && o.flip ? 'transform:scaleX(-1);' : '') + (o && o.style ? o.style : '');
    return '<img class="' + cls + '" alt="" src="' + m.src + '" width="' + m.w + '" height="' + m.h + '"' + (style ? ' style="' + style + '"' : '') + '>';
  }
  function face(id, box) {
    const m = spr(id);
    if (!m) return '';
    return sprite(id, {
      style: 'margin-left:' + Math.round((box || 40) / 2 - m.cx) + 'px;margin-top:-2px'
    });
  }

  function cardRow(run, id, o) {
    const c = card(id), opt = o || {};
    return '<button class="cardrow win g-' + c.grade + (opt.cls ? ' ' + opt.cls : '') + '" data-id="' + id + '"' + (opt.sheet ? ' data-sheet="' + id + '"' : '') + '><span class="pic">' + sprite(id) + '</span><span class="txt">' +
      '<div class="nm">' + esc(c.name) + '<i class="grade">' + (GRADE[c.grade] || c.grade) + '</i><i class="el-' + c.element + '">' + ELEMENT[c.element] + '</i>' + (opt.tag ? '<i class="tag">' + esc(opt.tag) + '</i>' : '') + '</div>' +
      '<div class="st">HP ' + c.stats.hp + ' · 공 ' + c.stats.atk + ' · 마공 ' + c.stats.matk + ' · 방 ' + c.stats.def + '/' + c.stats.mdef + '</div>' +
      '<div class="trait">' + esc(c.trait.desc) + '</div>' +
      (opt.skills !== false ? '<div class="sk">' + c.skills.map(s => esc(s.name) + '<small>' + TYPE[s.type] + (s.cost ? ' ' + s.cost : '') + '</small>').join(' · ') + '</div>' : '') +
      '<div class="badges">' + badges(run, id) + '</div></span></button>';
  }
  const benchMinis = run => run.bench.map(id => '<button class="mini g-' + card(id).grade + '" data-sheet="' + id + '" aria-label="' + esc(card(id).name) + '">' + face(id, 40) +
    (run.heirlooms[id] ? '<i class="h">유</i>' : '') + (run.blessings[id] ? '<i class="b">축</i>' : '') + '</button>').join('');

  function cardHead(id, sub) {
    const c = card(id);
    const art = sprite(id) || (c.baseCardId ? sprite(c.baseCardId) : '');
    return '<div class="ih g-' + c.grade + '"><span class="pic">' + art + '</span><div><b>' + esc(c.name) + '</b><i class="grade">' + (GRADE[c.grade] || c.grade) + '</i><i class="el-' + c.element + '">' + ELEMENT[c.element] + '</i>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div></div>';
  }

  return { card, spr, sprite, face, cardRow, benchMinis, cardHead };
}
