import { $, $$, esc } from '../dom.js';
import { TYPE } from '../widgets.js';
import { QUIRKS } from '../../content/quirks.js';
import { FIELD } from './hud.js';

export function createTiles({ core, card, audio, sheets, B, foeDef, play, markHeirloomUsed }) {
  const { sfx } = audio;
  const { openSheet, closeSheet, sheet } = sheets;
  const FIELD_NAMES = new Set(Object.keys(FIELD).map(id => core.BUFF_NAMES[id]));

  function supportLine(o, intent) {
    const buffs = o.effects.filter(e => e.type === 'buff').map(e => e.id);
    const hi = intent && intent.dmg ? intent.dmg[1] : null;
    if (buffs.includes('guard') || buffs.includes('damage_half')) return hi != null ? [hi + ' → ' + Math.floor(hi * 0.5), '받는 피해 절반'] : ['절반', '받는 피해 절반'];
    if (buffs.includes('barrier')) return intent && intent.kind === 'phy' ? [hi + ' → 0', '물리 공격을 지운다'] : ['—', '이번 공격은 못 막는다'];
    if (buffs.includes('magic_guard')) return intent && intent.kind === 'mag' ? [hi + ' → 0', '마법 공격을 지운다'] : ['—', '이번 공격은 못 막는다'];
    if (buffs.includes('evasion')) return ['회피 +50%', '맞지 않을 수도 있다'];
    const field = o.effects.find(e => e.type === 'field_buff');
    if (field) return [core.BUFF_NAMES[field.id] || field.id, '하늘에 건다'];
    return ['', ''];
  }
  const fullText = (o, me) => (o.index === 0 ? '마나를 쓰지 않는 기본 공격.' : core.SkillDisplay.body({ name: o.name, type: o.type, val: o.val, cost: o.cost, tier: o.tier, effects: o.effects }, { entity: me }));
  /* The tile line: the card's own skill text, shortened to fit two lines. The full text is one long press away. */
  function brief(o, me) {
    if (o.index === 0) return '마나 0';
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
  function renderActions() {
    const options = B.bridge.options(), D = B.D, me = card(B.party[D.cur]);
    const adv = core.Logic.getElementalMultiplier(me.element, foeDef().element) > 1;
    const forms = options.filter(isFormOption), firstForm = forms[0];
    B.options = options;
    const tile = o => {
      const chooseForm = o === firstForm, p = o.preview;
      const name = chooseForm ? FORM_SKILL : o.name;
      const usable = chooseForm ? forms.some(form => form.usable) : o.usable;
      let r2, r3 = chooseForm ? '변신할 형태를 고른다' : brief(o, me);
      if (p && p.delayed) r2 = '<strong class="txt">예약</strong>';
      else if (p) r2 = '<strong>' + p.dmg + '</strong>' + (adv ? '<small>▲상성</small>' : '') + (p.forcedCrit ? '<small>치명</small>' : '') + (p.kill ? '<u>처치</u>' : '');
      else { const s = supportLine(o, B.intent); r2 = '<strong class="txt' + (s[0] === '—' ? ' no' : '') + '">' + esc(s[0]) + '</strong>'; if (s[1]) r3 = s[1]; }
      return '<button class="act ' + o.type + '" data-i="' + o.index + '"' + (usable ? '' : ' disabled') + '>' +
        '<span class="ic">' + TYPE[o.type].slice(0, 1) + '</span><span class="tx">' +
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
      h.innerHTML = '<small>유품 · ' + esc(heir.heirFromName || '') + '</small><b>' + esc(heir.name) + '</b><strong>' + (p && p.dmg ? p.dmg : p && p.delayed ? '예약' : '') + '</strong>' + (p && p.kill ? '<u>처치</u>' : '');
    } else { h.className = ''; h.innerHTML = ''; h.disabled = true; delete h.dataset.i; }
    const r = $('#b-retreat'), can = B.bridge.canRetreat();
    B.armed = false; r.className = ''; r.disabled = !can;
    r.innerHTML = '↩ 물러나기<small>' + (B.bridge.retreatUsed ? '이미 썼다' : can ? '살려서 뺀다 · 턴 소모' : '뒤에 남은 동료 없음') + '</small>';
  }
  function lockPanel() { $$('.act').forEach(b => { b.disabled = true; }); $('#b-retreat').disabled = true; $('#b-heir').disabled = true; }
  function playAction(index) {
    audio.unlockAudio(); sfx.tap();
    play(B.bridge.act(index));
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
    sheet(name + ' · ' + TYPE[o.type] + (o.cost ? ' · MP ' + o.cost : '') + (o.heirloom ? ' · 유품' : ''),
      (o.heirloom ? (o.heirFromName || '') + '에게서 물려받은 기술. 위력 1.5배, MP 0, 이 전투에서 한 번. ' : '') + fullText(o, me) + '  특성 — ' + me.trait.desc);
  }
  const acts = $('#acts');
  acts.addEventListener('pointerdown', ev => {
    const b = ev.target.closest('.act'); if (!b) return;
    pressed = false; clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressed = true; detail(Number(b.dataset.i)); }, 480);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => acts.addEventListener(t, () => clearTimeout(pressTimer)));
  acts.addEventListener('contextmenu', ev => { const b = ev.target.closest('.act'); if (b) { ev.preventDefault(); detail(Number(b.dataset.i)); } });
  acts.addEventListener('click', ev => {
    const b = ev.target.closest('.act'); if (!b || b.disabled || B.busy) return;
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
    audio.unlockAudio(); sfx.tap(); markHeirloomUsed();
    play(B.bridge.act(Number(this.dataset.i)));
  });
  $('#b-retreat').addEventListener('click', () => {
    if (B.busy || !B.bridge.canRetreat()) return;
    const r = $('#b-retreat');
    if (!B.armed) { B.armed = true; r.className = 'armed'; r.innerHTML = '↩ 한 번 더<small>누르면 물러난다</small>'; sfx.tap(); return; }
    play(B.bridge.retreat());
  });
  $('#b-quirk').addEventListener('click', () => { const q = B.bridge && B.bridge.quirk && QUIRKS[B.bridge.quirk]; if (q) sheet('꿈의 변덕 · ' + q.name, q.desc); });

  return { brief, renderActions, lockPanel };
}
