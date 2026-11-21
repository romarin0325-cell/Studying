import { $, $$, esc } from '../dom.js';
import { TYPE, formatRange as damageRange, traitText } from '../widgets.js';
import { relicEffect, relicMarks } from '../relics.js';
import { FIELD } from './hud.js';
import { skillFields } from './fields.js';
import { HEIRLOOM_POWER, heirloomSkill } from '../../engine/bridge.js';

const previewDamage = p => p.min != null && p.max != null ? damageRange([p.min, p.max]) : String(p.dmg ?? '');
const hasFinalConsonant = name => /[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 !== 0;

export function commandRelics(artifacts, option, actor, { enemy, turn }) {
  const normal = option.index === 0;
  const attack = option.type === 'phy' || option.type === 'mag';
  const immediate = !option.preview?.delayed;
  const trait = actor?.trait?.type;
  const addsBurn = normal && (trait === 'normal_attack_burn_divine' || trait === 'syn_fire_3_crit_burn');
  const addsDivine = normal && trait === 'normal_attack_burn_divine';
  const applies = status => option.effects.some(effect =>
    ((effect.type === 'debuff' || effect.type === 'self_debuff') && effect.id === status) ||
    (effect.type === 'random_debuff' && effect.pool?.includes(status)) ||
    (effect.type === 'turn_modulo_debuffs' && turn % effect.mod === 0 && effect.debuffs?.includes(status)) ||
    effect.type === 'wild_card_debuff');
  return (artifacts || []).filter(id => {
    switch (id) {
      case 'double_attack': return normal;
      case 'support_boost': return option.type === 'sup' && !option.heirloom &&
        actor?.skills.some(skill => skill.name === option.name.split(' → ')[0] && skill.cost > 0);
      case 'death_roulette': return attack || !normal;
      case 'over_flame': return addsBurn || applies('burn');
      case 'over_divine': return addsDivine || applies('divine') || (immediate && (enemy.buffs.divine || 0) < 3 &&
        option.effects.some(effect => effect.type === 'check_divine_3_stun_else_add'));
      case 'flame_piercing': return immediate && option.type === 'phy' && (addsBurn || !!enemy.buffs.burn);
      case 'ice_break': return immediate && attack && !!enemy.buffs.stun;
      case 'lucky_vicky': return !!option.preview?.forcedCrit;
      default: return false;
    }
  });
}

export function createTiles({ core, widgets, audio, sheets, B, foeDef, play, ticker }) {
  const { card, faceBadge } = widgets;
  const { sfx } = audio;
  const { openSheet, closeSheet, sheet } = sheets;
  const FIELD_NAMES = new Set(Object.keys(FIELD).map(id => core.BUFF_NAMES[id]));
  const markedRelics = option => commandRelics(B.artifacts, option,
    card(B.D.allies[B.D.cur].form || B.party[B.D.cur]), B.D);

  function supportLine(o, intent) {
    const defense = o.defense;
    if (defense) {
      const { kind, reduction } = defense;
      const percent = Math.round(reduction * 100);
      if (kind === 'evasion') return ['회피 ' + percent + '%', '적 공격 회피 확률'];
      const blocking = kind === 'barrier' ? 'phy' : kind === 'magic_guard' ? 'mag' : null;
      if (blocking && intent?.kind !== blocking) return [TYPE[blocking] + ' 피해 차단', '한 번 무효'];
      const currentBuffs = B.D.allies[B.D.cur].buffs;
      const dmg = !currentBuffs.guard && !currentBuffs.damage_half ? intent?.dmg : null;
      const reduced = dmg && dmg.map(amount => Math.floor(amount * (1 - reduction)));
      return [dmg ? damageRange(dmg) + ' → ' + damageRange(reduced) : '피해 −' + percent + '%',
        blocking ? '다음 ' + TYPE[blocking] + ' 차단' :
          (TYPE[intent?.kind] ? TYPE[intent.kind] + ' 피해 ' : '받는 피해 ') + percent + '% 감소'];
    }
    return ['', ''];
  }
  const fullText = (o, me) => (o.index === 0 ? 'MP를 소모하지 않는 기본 공격.' : core.SkillDisplay.body({
    name: o.name, type: o.type, val: o.val, cost: o.cost, tier: o.tier, effects: o.effects,
    isActualDelayedTrigger: o.preview?.instant
  }, { entity: me }));
  /* The tile line: the card's own skill text, shortened to fit two lines. The full text is one long press away. */
  function brief(o, me) {
    if (o.index === 0) return 'MP 0';
    return fullText(o, me)
      .replace(/^위력 [\d.~]+배\.\s*/, '')
      .replace(/\.?\s*발동 전에 시전자가 사망하면 예약 취소\.?/g, '')
      .replace(/사용 후 ([\d·]+)턴에 각각 위력 ([\d.]+)배로 공격 예약/g, (m, turns, x) => turns.split('·').length + '턴간 매 턴 ' + x + '배 공격 예약')
      .replace(/(\d+)턴 후 위력 ([\d.~]+)배로 공격 예약/g, '$1턴 후 $2배 공격 예약')
      .replace(/(각 )?예약 발동 시/g, '발동 시')
      .replace(/(필드에 )?‘([^’]+)’ 중 무작위 (\d+)종/g, (m, f, list, n) => (list.split('·').some(x => FIELD_NAMES.has(x)) ? '무작위 필드 버프 ' : '무작위 디버프 ') + n + '종')
      .replace(/적이 (\S+) 상태이면/g, '$1 상태면')
      .replace(/(자신에게|적에게|자신의|적의) /g, '')
      .replace(/ \((다음 턴 행동 불가|받는 피해 50% 감소|마법 피해 무효|물리 피해 무효|회피율 \+50%p|최소 1 HP)\)/g, '')
      .replace(/필드 버프 (?=‘)/g, '')
      .replace(/\.$/, '').replace(/\. /g, ' · ')
      .replace(/발동 시 ([^ ·]+) 부여 · 발동 시 ([^ ·]+) 부여/g, '발동 시 $1·$2 부여');
  }
  const FORM_SKILL = '기적의우화';
  const FORM_PREFIX = FORM_SKILL + ' → ';
  const isFormOption = o => o.name.startsWith(FORM_PREFIX);

  function delayedLine(option, turn) {
    if (option.preview?.instant) return '';
    const effect = core.findDelayedSkillEffect?.(option);
    if (!effect) return option.preview?.delayed ? '예약' : '';
    const offsets = Array.isArray(effect?.turns) ? effect.turns : [effect?.turns];
    const turns = offsets.filter(Number.isFinite).map(offset => turn + offset);
    if (!turns.length) return '예약';
    const landing = turns.join('·') + '턴';
    return landing + (option.type === 'sup' ? '에 발동' : '에 적중');
  }

  function renderOpening(model) {
    const { stand, rescue } = model;
    const current = B.D.allies[B.D.cur];
    const next = B.D.allies.find(ally => ally?.form === rescue.incomingId);
    const actorId = stand.actorId ?? current.form ?? B.party[B.D.cur];
    const heirloom = heirloomSkill(card(actorId));
    const retreatHp = next && rescue.incomingHpAfter != null
      ? next.name + ' HP ' + next.hp + ' → ' + damageRange(rescue.incomingHpAfter) : '다음 동료가 대신 피격';
    const inheritance = next && heirloom ? '쓰러지면 ' + next.name + (hasFinalConsonant(next.name) ? '이 ' : '가 ') +
      heirloom.name + (hasFinalConsonant(heirloom.name) ? '을' : '를') + ' 계승' : '쓰러지면 다음 동료에게 유품 계승';
    $('#opening-face').innerHTML = faceBadge(actorId, current.name) + '<b>HP ' + current.hp + ' / ' + current.maxHp + '</b>';
    $('#acts').innerHTML = '<button class="act opening-choice rescue" data-opening-rescue><b>' + esc(current.name) +
      ' 생존 후퇴</b><small>' + esc(retreatHp) + '</small></button>' +
      '<button class="act opening-choice stand" data-i="' + stand.optionIndex + '"><b>' + esc(current.name) +
      '로 마지막 공격</b><small>' + esc(inheritance) + '</small><small>' + esc(B.D.enemy.name) + '에 피해 ' +
      esc(damageRange(stand.damageRange)) + '</small></button>';
  }

  function renderActions(opening) {
    const options = B.bridge.options(), D = B.D, me = card(B.party[D.cur]);
    const adv = core.Logic.getElementalMultiplier(me.element, foeDef().element) > 1;
    const forms = options.filter(isFormOption), firstForm = forms[0];
    B.options = options;
    $('#battle').classList.toggle('opening-decision', !!opening);
    if (opening) {
      renderOpening(opening);
      return;
    }
    const tile = o => {
      const chooseForm = o === firstForm, p = o.preview;
      const name = chooseForm ? FORM_SKILL : o.name;
      const usable = chooseForm ? forms.some(form => form.usable) : o.usable;
      const fields = skillFields(core, o, B.artifacts);
      const landing = delayedLine(o, D.turn);
      let r2, r3 = chooseForm ? '변신할 형태 선택' : brief(o, me);
      if (fields) {
        r2 = '<strong class="field-effect">' + esc(fields.line) + '</strong>';
        const other = fields.other.length ? brief({ ...o, effects: fields.other }, me) : '';
        r3 = [landing, fields.names.length <= 2 ? fields.names.join('·') : '', other].filter(Boolean).join(' · ');
      }
      else if (landing) r2 = '<strong class="txt delayed-forecast">' + esc(landing) + '</strong>';
      else if (p?.instant && o.type === 'sup') r2 = '<strong class="txt">즉시</strong>';
      else if (p) {
        const damage = previewDamage(p);
        r2 = '<strong' + (damage.includes('~') ? ' class="range"' : '') + '>' + damage + '</strong>' +
          (p.instant ? '<small>즉시</small>' : adv ? '<small>▲상성</small>' : '') +
          (p.forcedCrit ? '<small>확정 치명</small>' : '') + (p.kill ? '<u>처치</u>' : '');
      }
      else {
        const [forecast, description] = supportLine(o, B.intent);
        r2 = forecast ? '<strong class="txt">' + esc(forecast) + '</strong>' : '';
        if (description) r3 = description;
      }
      const marks = relicMarks(core, markedRelics(o));
      return '<button class="act ' + o.type + '" data-i="' + o.index + '"' + (usable ? '' : ' disabled') + '>' +
        '<span class="ic">' + TYPE[o.type].slice(0, 1) + marks + '</span><span class="tx">' +
        '<span class="r1"><b>' + esc(name) + '</b><em>' + (o.cost ? 'MP ' + o.cost : '') + '</em></span>' +
        '<span class="r2">' + r2 + '</span><span class="r3">' + esc(r3) + '</span></span></button>';
    };
    const plain = options.filter(o => !o.heirloom && (!isFormOption(o) || o === firstForm));
    const heir = options.find(o => o.heirloom);
    $('#acts').innerHTML = [1, 2, 3, 0].map(k => plain[k]).filter(Boolean).map(tile).join('');
    const h = $('#b-heir');
    if (heir) {
      const p = heir.preview;
      h.className = 'on'; h.dataset.i = heir.index; h.disabled = false;
      const forecast = p?.instant ? previewDamage(p) + ' · 즉시' : p?.delayed ? delayedLine(heir, D.turn) : p ? previewDamage(p) : '';
      h.innerHTML = '<small>유품 · ' + esc(heir.heirFromName || '') + '</small><b>' + esc(heir.name) + '</b><strong>' + esc(forecast) + '</strong>' +
        relicMarks(core, markedRelics(heir)) + (p?.kill ? '<u>처치</u>' : '');
    } else { h.className = ''; h.innerHTML = ''; h.disabled = true; delete h.dataset.i; }
    const r = $('#b-retreat'), can = B.bridge.canRetreat();
    B.armed = false; r.className = ''; r.disabled = !can;
    r.innerHTML = '↩ 후퇴<small>' + (B.bridge.retreatUsed ? '사용 완료' : can ? '안전 이탈 · 턴 소모' : '교대할 동료 없음') + '</small>';
  }
  function lockPanel() { $$('.act').forEach(b => { b.disabled = true; }); $('#b-retreat').disabled = true; $('#b-heir').disabled = true; }
  function playAction(index) {
    audio.unlockAudio(); sfx.tap();
    play(B.bridge.act(index));
  }
  function retreat() {
    audio.unlockAudio(); sfx.tap();
    play(B.bridge.retreat());
  }
  function formSheet(option) {
    const formIds = option.effects.find(e => e.type === 'transform_choice').forms;
    const buttons = formIds.map(id => {
      const form = card(id);
      const choice = B.options.find(o => o.name === FORM_PREFIX + form.name);
      if (!choice) return '';
      const { atk, matk, def, mdef } = form.stats;
      const summary = '공격 ' + atk + ' · 마공 ' + matk + ' · 방어 ' + def + ' · 마방 ' + mdef;
      return '<button class="btn big" data-form="' + choice.index + '"' + (choice.usable ? '' : ' disabled') +
        '><b>' + esc(form.name) + '</b><small>' + esc(summary) + '</small></button>';
    });
    openSheet(FORM_SKILL, '<div class="togs">' + buttons.join('') + '</div>');
    $$('#sh-body [data-form]').forEach(b => b.addEventListener('click', () => {
      if (B.busy || b.disabled) return;
      closeSheet();
      playAction(Number(b.dataset.form));
    }));
  }
  let pressTimer = null, pressed = false;
  function detail(index) {
    const o = (B.options || [])[index]; if (!o) return;
    const me = card(B.party[B.D.cur]);
    const name = isFormOption(o) ? FORM_SKILL : o.name;
    const fields = skillFields(core, o, B.artifacts);
    const relics = markedRelics(o).map(id => {
      const relic = core.GameUtils.getArtifactById(id);
      return relic.name + ' · ' + relicEffect(relic);
    }).join(' ');
    sheet(name + ' · ' + TYPE[o.type] + (o.cost ? ' · MP ' + o.cost : '') + (o.heirloom ? ' · 유품' : ''),
      (o.heirloom ? (o.heirFromName || '') + '에게서 계승한 스킬 · 위력 1.5배, MP 0, 전투당 1회. ' : '') + fullText(o, me) +
      (fields ? ' ' + fields.detail : '') + (relics ? ' ' + relics : '') + ' · 특성: ' + traitText(me.trait));
  }
  const acts = $('#acts');
  acts.addEventListener('pointerdown', ev => {
    const b = ev.target.closest('.act:not(.opening-choice)'); if (!b) return;
    pressed = false; clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressed = true; detail(Number(b.dataset.i)); }, 480);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => acts.addEventListener(t, () => clearTimeout(pressTimer)));
  acts.addEventListener('contextmenu', ev => { const b = ev.target.closest('.act:not(.opening-choice)'); if (b) { ev.preventDefault(); detail(Number(b.dataset.i)); } });
  acts.addEventListener('click', ev => {
    const b = ev.target.closest('.act'); if (!b || b.disabled || B.busy) return;
    if (b.hasAttribute('data-opening-rescue')) return retreat();
    if (pressed) { pressed = false; return; }
    const index = Number(b.dataset.i), option = B.options[index];
    if (option && isFormOption(option)) {
      sfx.tap();
      formSheet(option);
      return;
    }
    playAction(index);
  });
  $('#b-heir').addEventListener('click', function () {
    if (B.busy || this.disabled || this.dataset.i == null) return;
    audio.unlockAudio(); sfx.tap();
    play(B.bridge.act(Number(this.dataset.i)));
  });
  $('#b-retreat').addEventListener('click', () => {
    if (B.busy || !B.bridge.canRetreat()) return;
    const r = $('#b-retreat');
    if (!B.armed) {
      const preview = B.bridge.previewRetreat();
      const next = B.D.allies[preview.next.idx];
      const current = B.D.allies[B.D.cur];
      const hp = preview.dmg.map(damage => Math.max(0, next.hp - damage)).reverse();
      const skill = preview.intent.name;
      const effect = preview.intent.resourceEffect;
      const mp = effect?.kind === 'mp' && !effect.preventedBy ? ' · MP ' + effect.before + '→' + effect.after : '';
      const line = preview.intent.dmg ? next.name + (hasFinalConsonant(next.name) ? '이 ' : '가 ') +
        skill + (hasFinalConsonant(skill) ? '을' : '를') + ' 받음 · 명중 시 ' +
        damageRange(preview.dmg) + ' · HP ' + next.hp + '→' + damageRange(hp) + mp :
        next.name + ' 출전 · 적 ' + preview.intent.name + ' · HP ' + next.hp + '→' + next.hp;
      const pending = [...new Set(B.D.delayed?.filter(attack => attack.by === B.D.cur).map(attack => attack.name))];
      const warning = pending.length ? '예약한 ' + pending.join('·') + ' 취소됨' : '';
      let outcomes;
      const minimum = B.intent?.dmg?.[0];
      if (minimum != null && current.hp <= minimum) {
        const form = card(current.form || B.party[B.D.cur]);
        const heir = form && heirloomSkill(form);
        outcomes = [
          '후퇴 시 ' + next.name + ' HP ' + next.hp + '→' + damageRange(hp),
          '쓰러지면 ' + next.name + '에게 ' + (heir ? heir.name + ' ×' + HEIRLOOM_POWER : '넘길 유품 없음')
        ];
      }
      B.armed = true;
      r.className = 'armed';
      const notes = warning ? [warning] : outcomes || ['턴 소모 · 유품 없음'];
      r.innerHTML = esc(current.name) + ' 후퇴 확정' + '<span class="retreat-face">' + faceBadge(next.form, next.name, 32) +
        '<small>HP ' + next.hp + ' → ' + damageRange(hp) + '</small></span>' + notes.map(note => '<small>' + esc(note) + '</small>').join('');
      $('#tally').innerHTML = '';
      // The button already carries the outcomes unless the reserved-attack warning took its place.
      ticker(warning && outcomes ? outcomes.join('\n') : line, true);
      sfx.tap();
      return;
    }
    retreat();
  });

  return { brief, renderActions, lockPanel };
}
