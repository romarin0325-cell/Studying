import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { AFFIXES } from '../game/src/content/affixes.js';
import { LESSON_VERSION, makeBossLesson } from '../game/src/content/boss-lessons.js';
import { BOSSES } from '../game/src/content/bosses.js';
import { CONTRACTS, CONTRACT_ESCROW, CONTRACT_PAYOUT, CONTRACT_RULE_VERSION, LEGACY_CONTRACT_RULE_VERSION } from '../game/src/content/contracts.js';
import * as daily from '../game/src/content/daily-rift.js';
import { DUNGEONS } from '../game/src/content/dungeons.js';
import { EVENTS, eventForRun } from '../game/src/content/events.js';
import { INTRO } from '../game/src/content/intro.js';
import { LAYOUTS, ROOM_NAMES } from '../game/src/content/layouts.js';
import { MISSIONS, MISSION_OFFER_LIMIT, MISSION_UNLOCK_CHAPTER } from '../game/src/content/missions.js';
import { NOTEBOOK, NOTEBOOK_GOALS } from '../game/src/content/notebook.js';
import { QUIRKS } from '../game/src/content/quirks.js';
import { REGIONS } from '../game/src/content/regions.js';
import { RELICS } from '../game/src/content/relics.js';
import { RULEBOOK } from '../game/src/content/rulebook.js';
import * as tempo from '../game/src/content/tempo.js';
import { LARGE, WILD } from '../game/src/content/wild.js';
import { BLESS } from '../game/src/engine/awakenings.js';
import { enemyBeats, heirloomSkill } from '../game/src/engine/bridge.js';
import { ELEMENT, GRADE } from '../game/src/engine/roster.js';
import { coreBundle } from '../game/tools/core-bundle.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('changes-review.html', import.meta.url);
const pageName = 'relaymare-changes-review';
const game = 'card_pixel/game';
const content = (file, key, id) => `${game}/src/content/${file}.js:${key}${id === undefined ? '' : ':' + id}`;
const engine = (file, fn) => `${game}/src/engine/${file}.js:${fn}`;
const original = (file, key, id) => `${game}/core/${file}.js:${key}:${id}`;

const NEW = '새로 생김';
const CHANGED = '원본 값을 바꿈';
const REUSED = '원본 그대로를 다른 곳에서 씀';
const join = values => values.join(' · ');
const percent = n => Number((n * 100).toFixed(4)) + '%';
const types = { phy: '물리', mag: '마법', sup: '보조', rest: '휴식' };
const pair = ([hp, attack]) => `HP ×${hp} · 공격력·마법공격력 ×${attack}`;
const statText = ({ hp, atk, matk, def, mdef }) => `HP ${hp} · 공격력 ${atk} · 마법공격력 ${matk} · 방어력 ${def} · 마법방어력 ${mdef}`;
const dungeonName = id => DUNGEONS[id]?.name ?? id;
const roomName = id => id === 'risk' ? '위험 몽마' : ROOM_NAMES[id];
const dungeonEntries = Object.entries(DUNGEONS);
const locations = list => join(list.map(dungeonName));
const mainDungeons = dungeonEntries.filter(([, value]) => value.layout === 'expedition');
const layoutLocations = layout => locations(dungeonEntries.filter(([, value]) => value.layout === layout).map(([id]) => id));
const roomLocations = type => Object.entries(LAYOUTS).flatMap(([id, floors]) =>
  floors.flatMap((rooms, index) => rooms.some(room => room.type === type) ? [`${id === 'intro' ? '새벽의 숲' : '본편'} ${index + 1}층`] : []));

function loadCore() {
  const sandbox = { console, Math };
  sandbox.window = sandbox;
  vm.runInNewContext(coreBundle(repoRoot), sandbox);
  return sandbox.RelayCore;
}

function makeRow(key, name, where, effect, relation, sources, details = []) {
  return { key, name, where, effect, relation, sources: [sources].flat(), details };
}

const ruleCategories = {
  battle: '전투 규칙 추가', awakenings: '깨우기·제단', recruitment: '영입·동행·봉인',
  economy: '결정·보상', save: '저장'
};

const ruleLocations = {
  'boss-countdown': '보스 문과 전투 중 적 행동 예고',
  'enemy-intent': '모든 전투 · 플레이어 턴 시작 / 후퇴 미리보기',
  'enemy-relay': '적이 2명 이상인 전투 · 적 처치 직후',
  retreat: '전투 중 행동 선택 · 뒤에 동료가 있을 때',
  heirloom: '동료 사망 직후 및 이후 전투',
  'last-stand': '2명 이상 출전한 전투 · 사망 또는 후퇴 직후',
  'quirk-roll': '본편 2층 / 오늘의 균열 6층 · 위험 문',
  'affix-roll': '2층 위험 문 · 6층 정예 · 악몽 전투 · 균열 6층 위험 문',
  'region-triggers': '5개 테마 지역과 창조의 탑 · 전투 중',
  'three-beat': '템포 v2 · 본편의 보스 외 전투',
  'start-mp': '템포 v2 · 전투 시작',
  reinforcement: '템포 v2 · 본편 1·2·6층 전투 승리',
  'roster-limit': '템포 v2 · 동료 합류와 전투 편성',
  'battle-blessing': '템포 v2 · 본편 전투 문과 편성',
  'first-main-assist': '본편 쉬움 또는 일반 첫 생환 전 · 문지기·보스',
  'lesson-transfer': '예행 v1 · 본편 2·6층',
  'wild-shadows': '몽마 문 · 6층 정예 · 잿불 계승 지역',
  'fall-and-wipe': '원정 전투 정산',
  'opening-awakening': '본편 출발 전 · 새벽의 숲 2층',
  'awakening-rates': '소환의 샘 · 본편 3·7층, 새벽의 숲 4층',
  'spring-pick': '예행 v1 · 본편 3·7층 소환의 샘',
  'altar-blessing': '본편 3·7층 혼돈의 제단 · 제단 사건 · 균열 5층',
  'recruit-after-clear': '생환 후 정산',
  'failed-run-shard': '패배 후 정산 · 다음 원정 첫 깨우기',
  companions: '수첩 1·2·4·5장 · 출발 준비 · 첫 유료 선택 깨우기',
  seals: '일반·악몽 생환 뒤 해당 던전 출발 준비',
  'crystal-economy': '본편 출발 · 전투 정산',
  'gate-reward': '본편 4층 문지기·6층 정예·5층 보물방 · 입문 4층 보물방',
  'event-next-battle': '사건 선택 뒤 다음 전투',
  'save-recovery': '본편 이어하기 · 균열 기록 · 설정의 백업·복원'
};

function ruleRows(group) {
  const originalRules = {
    'start-mp': original('logic', 'GAME_CONSTANTS', 'MAX_MP'),
    'awakening-rates': original('logic', 'GACHA_RATES', 'default'),
    'altar-blessing': 'card/game/rpg_features.js:applyChaosBlessing',
    'crystal-economy': 'card/game/rpg_features.js:winBattle',
    'fall-and-wipe': 'card/game/rpg_features.js:handlePermadeath'
  };
  return RULEBOOK.filter(rule => rule.group === group).map(({ id, name, rule, where, since }) =>
    makeRow(id, name, ruleLocations[id], rule, id === 'awakening-rates' ? REUSED : originalRules[id] ? CHANGED : NEW,
      [content('rulebook', 'RULEBOOK', id), where, ...(originalRules[id] ? [originalRules[id]] : [])], [`도입 기준 · ${since}`]));
}

function regions() {
  const effects = {
    ember_carry: '적 처치 뒤 다음 적이 들어오면 직전 적의 작열을 최대 2스택 그대로 넘깁니다. 이 규칙이 적용되는 일반 몽마 문에는 기본 2명이 나오며 야생 몽마의 HP·공격력·마법공격력에 ×0.65가 추가됩니다.',
    twilight_bell: '전투 전체 기준 3·6·9턴의 플레이어 턴 시작에 현재 적에게 디바인 2스택을 부여합니다. 실제 증가량은 원본 디바인 상한과 유물의 영향을 받습니다.',
    starlit_sky: '일반 원정에서 전투 문이 둘이면 두 번째 문, 하나면 50% 확률로 태양의축복·스타파우더 2종을 켜고 시작합니다. 빈 하늘 내기를 걸면 지역 시작 효과가 비워집니다. 균열은 전투마다 50% 확률을 날짜 시드로 정합니다.',
    tide_cycle: '보스 외 적의 등장 후 4턴 주기입니다. 템포 v2는 물리 1배 → 물리 0.75배 → 마법 2.5배 → 휴식 순서이며, 4번째 턴에는 적이 받는 피해가 1.5배입니다. 예행은 일부 턴을 바꿉니다. 템포 v1의 3번째 턴에는 적의 가장 강한 마법 위력에 2.5를 곱합니다.',
    arena_charge: '일반 공격 피해를 2회 주면 다음 공격 기술의 피해가 2배입니다. 전투당 1회이며, 이미 예약된 지연 공격의 발동은 충전을 소모하지 않습니다.'
  };
  const hooks = {
    ember_carry: engine('bridge', 'nextEnemy'), twilight_bell: engine('bridge', 'B.onStartPlayerTurn'),
    starlit_sky: engine('rooms', 'makeBattleDoor'), tide_cycle: engine('bridge', 'decide'),
    arena_charge: engine('bridge', 'B.onCalc')
  };
  return Object.entries(REGIONS).map(([id, rule]) => {
    const linked = dungeonEntries.filter(([, dungeon]) => dungeon.region?.id === id).map(([key]) => key);
    const tower = DUNGEONS.creation_tower.region;
    const inTower = [...tower.first, ...tower.second].some(region => region.id === id);
    const where = [locations(linked), inTower && '창조의 탑 · 시작 지역 1개 또는 5층의 교체 후보 2개', '오늘의 균열 · 해당 테마의 전투'];
    return makeRow(id, rule.name, where.filter(Boolean).join(' / '), effects[id], NEW, [
      content('regions', 'REGIONS', id), ...linked.map(key => content('dungeons', 'DUNGEONS', key)),
      ...(inTower ? [content('dungeons', 'DUNGEONS', 'creation_tower')] : []), hooks[id]
    ], [`자료 문구 · ${rule.desc}`]);
  });
}

function eventRows(core, names) {
  const { card, buff, relic } = names;
  const stacks = values => join(Object.entries(values).map(([id, count]) => `${buff(id)} ${count}스택`));
  const candidate = op => op.random ? '무작위 깨우기 확률로 후보 1명' : join(op.ids.map(card));
  const gradeBlessings = join(Object.entries(BLESS).map(([grade, bonus]) => `${GRADE[grade]} ${percent(bonus)}`));
  const betConditions = {
    delayed_on_time: () => '다음 전투에서 지연 공격이 예약된 턴에 피해를 주고 승리',
    empty_sky: () => '다음 전투를 처음부터 끝까지 필드 효과 0개로 유지하고 승리',
    same_grade_full: () => '다음 전투의 3자리를 같은 등급으로 편성하고 승리',
    kill_on_turn: op => `다음 전투 ${op.turn}턴에 적을 1명 이상 처치하고 승리`
  };
  const betEligibility = {
    delayed_on_time: '즉시화 특성이 없고 지연 공격 기술이나 유품이 있는 동료 필요',
    empty_sky: '질풍노도와 예약된 시작 필드 효과가 없어야 함',
    same_grade_full: '같은 등급의 원정 동료가 3명 이상이어야 함',
    kill_on_turn: '원정 동료 1명 이상 필요'
  };
  const operations = {
    crystals: op => `꿈의 결정 +${op.amount}`,
    firstSurvivalPay: op => `${card(op.id)}의 첫 출전에서 살아서 승리하면 결정 +${op.amount}`,
    join: op => `${candidate(op)} 합류. 깨울 수 있는 대상이어야 하며, 템포 v${tempo.TEMPO_VERSION}의 ${tempo.ROSTER_LIMIT}명 한도를 넘는 만큼 기존 동료를 보냄`,
    release: op => '선택한 동료를 보내고 등급에 따라 결정 획득(노멀 1 · 레어 2 · 에픽 3 · 전설 묶음 4)'
      + (op.randomReplacement ? ' 후 무작위 1명 합류' : ''),
    bless: op => `${op.all ? '원정 동료 전원' : '선택한 동료 1명'}의 원정 축복을 ${op.multiplier === 'grade' ? gradeBlessings : percent(op.multiplier)}로 교체`,
    altar: () => '혼돈의 제단을 엶. 결정 0개로 최대 3번 굴려 마지막 축복을 확정',
    relic: op => {
      if (op.id === 'offered') return '이 사건에서 제안된 유물 1개 획득';
      const effect = `${relic(op.id).name} 1개 ${op.temporary ? '다음 전투에만 사용(임시 유물 슬롯과 보유 유물 칸이 비어 있어야 함)' : '획득(4칸이 차면 교체)'}`;
      return `${effect}. ${relic(op.id).desc}`;
    },
    field: op => `다음 전투 시작에 필드 효과 ${op.ids.length}종 적용(${join(op.ids.map(buff))})`,
    start: op => `다음 전투의 첫 적에게 ${stacks(op.enemyDebuffs)} 부여`,
    bet: op => `${betConditions[op.kind](op)}하면 ${op.reward.relic ? `유물 ${relic(op.reward.relic).name} 1개` : `결정 +${op.reward.crystals}`}. ${betEligibility[op.kind]}. 동시에 내기 1개만 가능`,
    heirloom: op => {
      const giver = core.GameUtils.getCardById(op.from);
      const skill = heirloomSkill(giver, op.name);
      if (skill?.name !== op.name) throw new Error(`사건 유품 기술 확인 필요: ${op.from}/${op.name}`);
      return `${card(op.to) || '선택한 동료 1명'}에게 ${giver.name}의 ‘${op.name}’을 유품으로 부여. MP 0 · 전투당 1회 · ${core.SkillDisplay.body(skill, { entity: giver })}`;
    }
  };
  function describeChoice(choice) {
    const target = choice.target === 'release' ? '동료 2명 이상일 때 대표 외 1명 선택. '
      : choice.target === 'bench' ? '원정 동료 1명 선택. ' : '';
    return `${choice.text} [결정 ${choice.cost ?? 0}개] — ${target}${choice.ops.map(op => {
      if (!operations[op.type]) throw new Error(`사건 효과 확인 필요: ${op.type}`);
      return operations[op.type](op);
    }).join(' / ')}`;
  }
  return EVENTS.map(event => {
    const allowed = event.dungeons ?? mainDungeons.map(([id]) => id);
    const floors = Object.entries(LAYOUTS).flatMap(([layout, levels]) => levels.flatMap((doors, index) =>
      doors.some(door => door.type === 'event') && allowed.some(id => DUNGEONS[id].layout === layout) ? [index + 1] : []));
    const present = event.requires.present?.map(card) ?? [];
    const bench = event.requires.bench?.map(card) ?? [];
    const dailyEvent = daily.EVENTS.includes(event.id);
    const where = [
      `${locations(allowed)} / ${floors.join('·')}층 사건 문 / 쉬움·일반·악몽`,
      event.minTempoVersion ? `템포 v${event.minTempoVersion} 이상` : '템포 v1·v2',
      present.length && `출현 풀 또는 원정 명단에 ${present.join('·')} 전원 필요(사망·방출 제외)`,
      bench.length && `현재 원정 명단에 ${bench.join('·')} 전원 필요`,
      dailyEvent && '오늘의 균열 3층 날짜별 사건에도 등장(인물 조건 생략)'
    ].filter(Boolean).join(' / ');
    const variants = [];
    const prior = new Map(event.choices.map(choice => [choice.id, JSON.stringify(choice)]));
    for (const floor of floors) {
      const version = eventForRun(event, { floor, lessonVersion: LESSON_VERSION });
      const changed = version.choices.filter(choice => prior.get(choice.id) !== JSON.stringify(choice)).map(describeChoice);
      if (changed.length) variants.push(...changed.map(line => `예행 v${LESSON_VERSION} · ${floor}층 — ${line}`));
    }
    const choiceLines = event.choices.map(describeChoice);
    if (event.id === 'mimic_paybox') {
      choiceLines.push('미믹의 반복 일당은 루터 보상입니다. 미믹을 포함한 루터가 1명 이상 출전 생존한 승리마다 결정 +1을 받습니다.');
    }
    return makeRow(event.id, event.name, where, `“${event.text}”`, NEW, [
      content('events', 'EVENTS', event.id), engine('rooms', 'resolveEvent'),
      ...(variants.length ? [content('events', 'eventForRun', event.id)] : [])
    ], [...choiceLines, ...variants]);
  });
}

function relicRows(names) {
  const traits = {
    deathDamage: '사망 시 적 피해를 주는 특성',
    normalAttack: '원정 동료 1명 이상',
    support: 'MP를 소모하는 보조 기술',
    critOrEvade: '치명타·회피 특성 또는 기본 수치가 0보다 높음'
  };
  return Object.entries(RELICS).map(([id, { fits }]) => {
    const { name, desc } = names.relic(id);
    const conditions = Object.entries(fits).map(([key, value]) => {
      if (key === 'element') return `${ELEMENT[value]} 속성 동료 또는 만능 속성 조커`;
      if (key === 'relic') return `${names.relic(value).name} 보유`;
      if (key === 'grades') return `${join(value.map(grade => GRADE[grade]))} 동료`;
      if (key === 'attack') return value === 'any' ? '물리 또는 마법 공격 기술' : `${types[value]} 공격 기술`;
      if (key === 'debuff') return `${names.buff(value)} 부여 기술·특성`;
      if (key === 'fieldSources') return `서로 다른 필드 효과 원천 ${value}종 이상 또는 무작위 필드 효과 기술(지역·다음 전투·기술에서 계산)`;
      if (key === 'field') return `${names.buff(value)}를 참조하는 기술`;
      if (traits[key]) return traits[key];
      throw new Error(`유물 제안 조건 확인 필요: ${key}`);
    });
    const priority = conditions.join(fits.relic || fits.field ? ' 또는 ' : ' 및 ');
    const events = EVENTS.filter(event => event.choices.some(choice => choice.ops.some(op => op.id === id || op.reward?.relic === id)));
    const where = '본편 4층 문지기·6층 정예·5층 보물방 · 입문 4층 보물방 · 대상인의 거래'
      + (events.length ? ` / 지정 사건 ${events.map(event => event.name).join('·')}` : '');
    return makeRow(id, name, where, desc, REUSED, [
      content('relics', 'RELICS', id), original('logic', 'ARTIFACT_LIST', id), engine('rooms', 'fitsRelic')
    ], [`제안 우선 조건 · ${priority}. 보유하지 않은 유물 중 조건에 맞는 후보를 먼저 뽑습니다. 조건에 맞는 유물이 없으면 미보유 목록 전체에서 뽑습니다.`]);
  });
}

function bossRows(core) {
  return Object.entries(BOSSES).map(([id, { stats, note }]) => {
    const boss = core.ENEMIES.find(enemy => enemy.id === id);
    const where = dungeonEntries.flatMap(([dungeon, info]) => [
      ...(info.boss === id ? [`${info.name} ${info.floors}층${info.hiddenBosses.length ? ' 쉬움·일반' : ' 모든 난이도'}`] : []),
      ...(info.hiddenBosses.includes(id) ? [`${info.name} ${info.floors}층 악몽`] : []),
      ...(info.boss === id && daily.REGIONS.includes(dungeon) ? ['오늘의 균열 7층 · 해당 테마 날짜'] : [])
    ]).join(' / ');
    const actions = enemyBeats(core, boss, 'bossScript').map(({ turn, name, type, power }) =>
      `${turn}턴 · ${name}${type === 'rest' ? '' : ` (${types[type]} 위력 ${power}배)`}`);
    const skills = Array.from(boss.skills, skill => {
      const { name, type, rate } = skill;
      return `${name} (${types[type]}) · ${core.SkillDisplay.body(skill, { entity: boss, enemy: true })}`
        + (rate > 0 ? ` 일반 행동 선택 확률 ${percent(id === 'creator_god' ? 0.3 : rate)}.` : '');
    });
    if (id === 'creator_god') skills.push('첫 1턴 일반 공격, 2턴 저지먼트. 충전 중이 아닌 3턴 이후 충전 20%, 일반 공격 50%. 16턴부터 홀리레이 자리의 30%는 저지먼트로 바뀝니다.');
    if (id === 'gray') skills.push('4의 배수 턴마다 영혼절단과 차원절단이 각각 50%입니다.');
    return makeRow(id, boss.name, where, `원본 ${statText(boss.stats)} → RELAYMARE 기준 ${statText(stats)}. 문 예고 · ${note}`, CHANGED, [
      content('bosses', 'BOSSES', id), original('data', 'ENEMIES', id),
      original('logic', 'Logic.decideEnemyAction', id), engine('bridge', 'enemyBeats')
    ], [
      `문에서 보는 행동표(첫 ${tempo.BOSS_PREVIEW_TURNS}턴) · ${join(actions)}`,
      '아래 기술의 행동 규칙은 원본을 사용합니다. 표에 없는 일반 행동은 기술 추첨 또는 물리 일반 공격 1배입니다.',
      ...skills
    ]);
  });
}

function lessonRows(core, names) {
  return Object.keys(BOSSES).flatMap(id => [2, 6].flatMap(floor => {
    const first = makeBossLesson(id, floor, 0);
    if (!first) return [];
    const last = makeBossLesson(id, floor, 1 - Number.EPSILON);
    const variants = first.variant === last.variant ? [first] : [first, last];
    const dungeon = dungeonEntries.find(([, info]) => info.boss === id || info.hiddenBosses.includes(id))[1];
    const difficulty = dungeon.hiddenBosses.includes(id) ? '악몽' : dungeon.hiddenBosses.length ? '쉬움·일반' : '모든 난이도';
    const steps = variants.flatMap(lesson => lesson.steps.map((step, index) => {
      const prefix = `${lesson.variant === 'fixed' ? '' : types[lesson.variant] + ' 분기 · '}${index + 1}턴`;
      if (!step) return `${prefix} · 문 기본 행동`;
      const notes = {
        charge: () => '1턴 충전, 다음 턴 충전 일격',
        charged_hit: () => '충전이 남아 있을 때 발동 후 충전 해제',
        mana_drain: () => `선봉 MP ${step.drainFlat} 감소(최소 0)`,
        retaliation: () => `해당 턴에 피해를 받았으면 위력 ${step.hitPower}배`,
        cleanse: () => '자신의 디버프 전부 해제',
        defense_protocol: () => `이번 턴 피격 유형의 방어력 ${percent(step.bonus)} 증가`,
        alternating_defense: () => `${step.stat === 'def' ? '물리' : '마법'} 방어력 ${percent(step.bonus)} 증가`,
        lesson_guard: () => `다음 플레이어 턴에 받는 피해 ${percent(step.reduction)} 감소`,
        swap_stats: () => '명중 시 자신의 공·마공과 물방·마방을 각각 교환',
        front_hit: () => '현재 선두 동료 공격',
        magic_followup: () => '현재 선두 동료 공격',
        cleave: () => '현재 선두 동료 공격'
      };
      const attack = ['phy', 'mag'].includes(step.type) ? ` · ${types[step.type]} 위력 ${step.val}배` : '';
      return `${prefix} · ${step.name}${attack}${step.rule ? ` · ${notes[step.rule]()}` : ''}`;
    }));
    const prep = [
      first.armor && `예행 문 적 방어력·마법방어력 · ${join(Object.entries(first.armor).map(([key, scale]) =>
        `${key === 'all' ? '모든 적' : WILD[key.replace(/^wild_/, '')].name} ×${scale}`))}`,
      first.startDebuffs && `예행 적의 시작 디버프 · ${join(Object.entries(first.startDebuffs).map(([key, count]) => `${names.buff(key)} ${count}스택`))}`,
      first.tideAfter && `조류 문에서는 ${first.steps.length + 1}턴에 ${first.tideAfter.name}(${types[first.tideAfter.type]} ${first.tideAfter.val}배)`
    ].filter(Boolean);
    return [makeRow(`${id}-${floor}`, `${core.ENEMIES.find(enemy => enemy.id === id).name} 예행 · ${floor}층`,
      `${dungeon.name} ${floor}층 전투 문 · ${difficulty} · 예행 v1 본편`,
      `첫 적이 자기 ${first.transferBeforeLocalTurn}턴 예고 전에 쓰러지면 다음 적에게 최대 ${first.maxUsesPerRoom}회 넘어갑니다.`, NEW,
      [content('boss-lessons', 'makeBossLesson', `${id}:${floor}`), engine('bridge', 'teachesLesson')], [...prep, ...steps])];
  }));
}

function dungeonRows(core, names) {
  const unlocks = {
    initial: '처음부터 열림', intro_clear: '새벽의 숲 생환',
    early_region_clear: '홍련 화산 또는 황혼 성당 생환',
    region_clear_count: count => `서로 다른 테마 지역 ${count}곳 생환`
  };
  return dungeonEntries.map(([id, dungeon]) => {
    const { name, floors, layout, pool, tiers, wild, boss, hiddenBosses, nightmareRule, region, unlock } = dungeon;
    const set = core.BASIC_CARD_SETS.find(cards => cards.id === pool.set);
    const unlockText = unlock.count ? unlocks[unlock.kind](unlock.count) : unlocks[unlock.kind];
    const migration = region?.first ? '시작 지역 1개 추첨. 5층에는 나머지 지역 중 2개를 문에 배정하고 선택한 규칙으로 교체'
      : region ? REGIONS[region.id].name : '지역 규칙 없음';
    const poolText = set ? `원본 기본 세트 ‘${set.name}’의 전투 스프라이트 보유 동료`
      : pool.all ? '전투 스프라이트가 있는 전체 동료' : `${pool.ids.length}명(${join(pool.ids.map(names.card))})`;
    return makeRow(id, name, unlockText, `${floors}층 · ${layout === 'intro' ? '입문' : '본편'} 구성 · 최종 적 ${names.enemy(boss)}`, NEW,
      [content('dungeons', 'DUNGEONS', id), content('layouts', 'LAYOUTS', layout),
        ...(set ? [original('data', 'BASIC_CARD_SETS', set.id)] : [])], [
        `출현 풀 · ${poolText}${pool.spriteFallback ? ` / 스프라이트 보완 후보 ${join(pool.spriteFallback.map(names.card))}` : ''}`,
        `층 기본 배율 · ${join(tiers.map((tier, index) => `${index + 1}층 ×${tier}`))}`,
        `야생 몽마 · ${join(wild.map(key => WILD[key].name))}`,
        `지역 효과 · ${migration}`,
        nightmareRule ? `쉬움·일반으로 진입 가능. 이 지역 일반 생환 시 악몽 해금. 악몽 배율 ×${nightmareRule.scale}, 첫 적 접두사 +1. 악몽 보스 ${join((hiddenBosses.length ? hiddenBosses : [boss]).map(names.enemy))}.`
          : '입문은 일반 난이도 1종.'
      ]);
  });
}

function layoutRows() {
  return Object.entries(LAYOUTS).flatMap(([layout, floors]) => floors.map((doors, index) => {
    const floor = index + 1;
    return makeRow(`${layout}-${floor}`, `${layout === 'intro' ? '입문' : '본편'} ${floor}층`,
      layoutLocations(layout), `선택 문 ${doors.length}개`, NEW, content('layouts', 'LAYOUTS', `${layout}:${index}`),
      doors.map(({ type, risk, reward, creature, intent, final }, door) => join([
        `${door + 1}번 문 ${ROOM_NAMES[type]}${risk ? ' (위험)' : ''}${final ? ' (최종전)' : ''}`,
        creature && WILD[creature].name, intent && `${types[intent]} 예고`,
        reward != null && `승리 시 기본 결정 ${reward}개`
      ].filter(Boolean))));
  }));
}

function introRows(names) {
  const [lead, ...allies] = INTRO.party.map(names.card);
  return [
    makeRow('borrowed', '대여 전투와 유품 안내', '새벽의 숲 1층 · 대여 전투',
      `고정 출전 ${join([lead, ...allies])}. ${lead}는 HP ${INTRO.start.allyStart[0].hp}·MP ${INTRO.start.allyStart[0].mp}, ${WILD[INTRO.creature].name}은 HP ${INTRO.enemyHp}. 전투 시드는 ${INTRO.seed}입니다.`,
      NEW, [content('intro', 'INTRO', 'start'), engine('rooms', 'makeBattleDoor')], [INTRO.relayHint]),
    makeRow('awakening', '첫 깨우기와 입문 유품', '새벽의 숲 2층 · 첫 깨우기',
      '대여전에서 생존한 동료에게 후보 우선권을 주고 이때 받은 유품도 이어집니다. 템포 v2에서는 생존 선봉 또는 그 유품의 수령자가 우선 합류하고 1명을 더 선택합니다. 우선 합류자가 없으면 2명을 선택합니다. 이후 최대 3명을 무작위로 깨웁니다.',
      NEW, [content('layouts', 'LAYOUTS', 'intro:1'), engine('run', 'chooseDoor'), engine('run', 'settleBattle')]),
    makeRow('first-wild', '물리와 마법 몽마 선택', '새벽의 숲 3층 · 몽마 문',
      `물리 ${WILD.emerald_beetle.name} 또는 마법 ${WILD.gold_moth.name} 중 1개 문을 고릅니다. 템포 v2에서는 예고와 맞는 공격 기술 → 일반 공격 1배 → 물리 약공 0.55배 순서입니다. 승리 시 결정 1개를 받습니다.`,
      NEW, [content('layouts', 'LAYOUTS', 'intro:2'), engine('bridge', 'patternActions')]),
    makeRow('rest', '첫 샘과 보물방', '새벽의 숲 4층 · 소환의 샘 / 보물방',
      '두 문 중 1개를 고릅니다. 샘에서는 결정 1개 무작위 깨우기 또는 3개 선택 깨우기를, 보물방에서는 유물 1개를 얻습니다.',
      NEW, [content('layouts', 'LAYOUTS', 'intro:3'), engine('run', 'takeTreasure')]),
    makeRow('finale', INTRO.boss.name, '새벽의 숲 5층 · 최종 문지기',
      `${INTRO.boss.note}. 첫 적은 예약 후보를 우선하며 두 번째는 ${join(INTRO.finaleGrades.map(grade => GRADE[grade]))} 그림자입니다. 첫 생환 전 패배하면 동료 손실이나 결정 변화 없이 같은 전투를 다시 준비합니다.`,
      NEW, [content('intro', 'INTRO', 'boss'), content('intro', 'INTRO', 'finaleGrades'), engine('run', 'introFinaleDoor'), engine('run', 'settleBattle')])
  ];
}

function contractRows() {
  return Object.entries(CONTRACTS).map(([id, contract]) => {
    const legacy = {
      rescue: 'v1에서는 들어온 동료도 생존해야 합니다.',
      heirloom: 'v1에서는 6층 전투의 유품 처치도 인정했습니다.'
    }[id];
    return makeRow(id, contract.name, '해당 던전 일반 생환 후 악몽 출발 준비 · 선택 계약 1개', contract.rule, NEW, [
      content('contracts', 'CONTRACTS', id), content('contracts', 'CONTRACT_ESCROW'), content('contracts', 'CONTRACT_PAYOUT'),
      engine('run', 'settleContract'), engine('meta', 'applyRunEnd')
    ], [
      `현행 v${CONTRACT_RULE_VERSION} · 4층 문지기 승리 시 결정 ${CONTRACT_ESCROW}개 예치. 조건을 채우고 6층 전투에서 전멸 없이 승리하면 결정 ${CONTRACT_PAYOUT}개 지급. 악몽 원정 생환 시 해당 지역·계약의 첫 도장 기록.`,
      ...(legacy ? [`저장된 v${LEGACY_CONTRACT_RULE_VERSION} 계약 · ${legacy}`] : [])
    ]);
  });
}

function notebookRows() {
  const conditions = {
    1: '새벽의 숲 5층 최종 문지기를 이기고 생환 정산',
    2: '이미 영입한 대표로 입문 외 원정에 출발',
    3: '본편 4층 문지기 승리 · 원정 최종 결과와 무관',
    4: '본편 원정 첫 생환 · 난이도 무관',
    5: '수첩 2장을 연 첫 대표와 다른 영입 대표가 문지기전을 생존하고 원정 생환',
    6: `아직 생환하지 않은 테마 지역을 포함해 서로 다른 ${DUNGEONS.creation_tower.unlock.count}곳 생환`,
    7: '창조의 탑 8층 보스 격파 및 생환 정산'
  };
  return NOTEBOOK.map(({ id, title }) => makeRow(id, `수첩 ${id}장 · ${title}`, conditions[id],
    NOTEBOOK_GOALS[id].reward, NEW, [content('notebook', 'NOTEBOOK', id), content('notebook', 'NOTEBOOK_GOALS', id),
      engine('meta', id === 2 || id === 3 ? 'recordRunProgress' : 'applyRunEnd')]));
}

function missionRows() {
  return Object.entries(MISSIONS).map(([id, { target, grades }]) => makeRow(id,
    id === 'weekly' ? '주간 영입 임무' : '월간 영입 임무',
    `수첩 ${MISSION_UNLOCK_CHAPTER}장 이후 · ${id === 'weekly' ? '월요일부터 일요일' : '매월 1일부터 말일'} · 기기 날짜 기준`,
    id === 'weekly' ? `본편 원정에서 4층 문지기 격파를 ${target}번 정산합니다. 최종 생환은 필요하지 않습니다.`
      : `한 달에 서로 다른 테마 지역 ${target}곳에서 생환합니다.`, NEW,
    [content('missions', 'MISSIONS', id), engine('meta', 'creditMissions'), engine('meta', 'missionCandidates')], [
      `열린 지역 풀에서 미영입 동료를 최대 ${MISSION_OFFER_LIMIT}명 제안하고 1명을 영입합니다. ${join(grades.map(grade => GRADE[grade]))} 후보가 있으면 그 등급에서 먼저 제안합니다.`
    ]));
}

function dailyRows(names) {
  const where = `수첩 ${MISSION_UNLOCK_CHAPTER}장 이후 · 오늘의 균열`;
  const rift = (id, name, location, effect, details = [], source = engine('daily-rift', 'specFor')) =>
    makeRow(id, name, `${where} · ${location}`, effect, NEW, [content('daily-rift', id), source], details);
  return [
    rift('RULE_VERSION', '날짜별 규칙과 공식 도전', '기기 현지 날짜 기준',
      `규칙 v${daily.RULE_VERSION}. 날짜 숫자(YYYYMMDD)가 시드입니다. 당일 공식 1회가 정산된 뒤 같은 구성으로 연습할 수 있으며 연습 최고 기록은 별도 집계합니다.`,
      ['기록은 승리 > 패배 > 포기 순입니다. 승리는 생존자 수가 많은 쪽, 동률이면 총 턴이 적은 쪽이 우선입니다. 패배는 더 높은 도달 층이 우선입니다.',
        '템포 v2·보스 예행·본편 영입은 적용하지 않습니다. 대여 동료 5명은 노멀·레어·전설·레어·에픽 순입니다. 앞 2명과 뒤 2명은 유품 공격 유형이 각각 같고 두 조의 유형은 서로 다릅니다.'],
      engine('daily-store', 'create')),
    rift('REGIONS', '균열 테마 순환', '날짜별 테마 1개',
      `${daily.REGIONS.length}개 테마가 날짜 순서로 반복됩니다. ${locations(daily.REGIONS)}. 테마의 일반 보스가 최종 적입니다.`),
    rift('EVENTS', '균열 사건 풀', '3층 사건 문',
      `${daily.EVENTS.length}개 사건 중 날짜별 1개(${join(daily.EVENTS.map(id => EVENTS.find(event => event.id === id).name))}). 방문 인물은 대여·문지기 후보에서 제외됩니다.`),
    rift('QUIRKS', '균열 위험 문의 변덕', '6층 오른쪽 위험 문',
      `변덕 후보 ${daily.QUIRKS.length}종(${join(daily.QUIRKS.map(id => QUIRKS[id].name))})과 접두사 후보 ${daily.AFFIXES.length}종을 합쳐 날짜별 1개를 고릅니다.`),
    rift('AFFIXES', '균열 위험 문의 접두사', '6층 오른쪽 위험 문의 첫 적',
      `접두사 후보 ${daily.AFFIXES.length}종(${join(daily.AFFIXES.map(id => AFFIXES[id].name))}). 해당 날짜에 접두사가 뽑히면 첫 적 1명에 붙습니다.`),
    rift('SKY', '균열의 별빛 하늘', '별빛 정원 테마의 1·4·6·7층 전투',
      `각 전투에서 50% 확률로 필드 효과 ${daily.SKY.length}종(${join(daily.SKY.map(names.buff))})을 적용합니다.`),
    rift('SCALE', '균열 층별 배율', '1·4·6·7층 전투',
      join(Object.entries(daily.SCALE).map(([floor, scale]) => `${floor}층 ×${scale}`)) + '. 화산 1·6층 야생 몽마에는 ×0.65가 추가됩니다.', [], engine('daily-rift', 'doorsFor')),
    rift('FLOORS', '균열 문 구성과 보상', '전용 원정',
      `${daily.FLOORS}층 · 전투 4번. 전투에는 생존 대여 동료가 3명 이상이면 3명, 그보다 적으면 생존자 전원이 출전합니다.`, [
        '1층 몽마 / 2층 보물방 2개 중 1개 / 3층 사건 / 4층 문지기(레어·에픽 그림자 각 1명)',
        '5층 보물방 또는 혼돈의 제단 / 6층 일반 몽마 또는 유물 1개가 걸린 위험 문 / 7층 보스',
      '대여 조합에 따라 서포트부스트·프로즌바디·리버스 후보를 더해 유물 4개를 미리 뽑고 2·5·6층 문에 배정합니다. 본편 전투 결정·증원·문지기 보상은 지급하지 않습니다.'
      ], engine('daily-rift', 'doorsFor'))
  ];
}

function tempoRows() {
  const where = '템포 v2 · 입문 및 본편';
  const row = (key, name, location, effect, relation = NEW, id, details) => makeRow(
    [key, id].filter(value => value !== undefined).join('-'), name, location, effect, relation, content('tempo', key, id), details
  );
  const scales = [
    ['ROOM_MULTIPLIERS', '기본', tempo.ROOM_MULTIPLIERS],
    ['REGION_MULTIPLIERS', '지역', tempo.REGION_MULTIPLIERS],
    ['NIGHTMARE_MULTIPLIERS', '악몽', tempo.NIGHTMARE_MULTIPLIERS],
    ['LESSON_NIGHTMARE_MULTIPLIERS', '예행 v1 악몽', tempo.LESSON_NIGHTMARE_MULTIPLIERS],
    ['FIRST_MAIN_ASSIST', '첫 본편 완충', tempo.FIRST_MAIN_ASSIST],
    ['INTRO_MULTIPLIERS', '입문', tempo.INTRO_MULTIPLIERS]
  ];
  const scaleRows = scales.flatMap(([key, label, values]) => Object.entries(values).flatMap(([id, value]) => {
    if (Array.isArray(value)) {
      const place = key === 'INTRO_MULTIPLIERS' ? `${id}층` : roomName(id);
      return [row(key, `${label} · ${place}`, key === 'INTRO_MULTIPLIERS' ? '새벽의 숲' : '본편',
        pair(value), CHANGED, id)];
    }
    return Object.entries(value).map(([room, factor]) => row(key, `${label} · ${dungeonName(id)} · ${roomName(room)}`,
      `${dungeonName(id)} · ${roomName(room)}`, pair(factor), CHANGED, `${id}:${room}`));
  }));
  const beats = steps => join(steps.map(({ name, type, signature, power, vulnerable }, index) => `${index + 1}박 ${signature ? '첫 공격 기술 위력' : name + ' ' + types[type]} ×${power}${vulnerable ? `(받는 피해 ×${vulnerable})` : ''}`));
  const hex = number => '0x' + number.toString(16);
  return [
    row('TEMPO_VERSION', '템포 버전', where, `현행 v${tempo.TEMPO_VERSION}. 적용 버전이 다른 원정과 균열에는 해당 배율·행동표를 생략합니다.`),
    row('EASY_ENEMY_ATTACK', '쉬움 적 공격력 배율', '본편 쉬움', `적 공격력·마법공격력 ×${tempo.EASY_ENEMY_ATTACK}`, CHANGED),
    row('START_MP', '시작 MP', '본편 전투 시작', `출전 동료는 MP ${tempo.START_MP}로 시작. 마나 폭주는 자체 초기값 적용.`, CHANGED),
    row('REINFORCE_FLOORS', '증원 층', '본편 전투 승리', `${tempo.REINFORCE_FLOORS.join('·')}층에 무료 증원 기회`),
    row('ROSTER_LIMIT', '동료 한도', '본편 및 입문 깨우기·증원', `${tempo.ROSTER_LIMIT}명`),
    row('REINFORCE_CHOICES', '증원 후보 수', '무료 증원', `최대 ${tempo.REINFORCE_CHOICES}명`),
    ...Object.entries(tempo.BLESSING_MULTIPLIERS).map(([grade, scale]) =>
      row('BLESSING_MULTIPLIERS', `${GRADE[grade]} 전투 축복`, '본편 전투 축복에 뽑힌 동료', `기준 배율 ×${scale}`, NEW, grade)),
    ...scaleRows,
    row('THREE_BEAT', '세 박자 배율', '본편 일반 행동표', beats(tempo.THREE_BEAT)),
    row('STRONG_BEAT', '세 박자 강공', '본편 일반 행동표', `${tempo.STRONG_BEAT}번째 행동을 강공 예고`),
    row('TIDE_BEATS', '심야의 조류 배율', '심야의 조류가 적용된 보스 외 전투', beats(tempo.TIDE_BEATS)),
    row('TIDE_STRONG_BEAT', '조류 강공', '심야의 조류 행동표', `${tempo.TIDE_STRONG_BEAT}번째 행동을 강공 예고`),
    row('BOSS_PREVIEW_TURNS', '보스 행동표 범위', '보스 문', `첫 ${tempo.BOSS_PREVIEW_TURNS}턴을 확인해 고정 행동과 예정 분기를 표시`),
    row('FLOOR_SEED_STEP', '층별 추첨 시드 상수', '전투 축복·증원·예행 분기', `층과 섞는 고정 상수 ${hex(tempo.FLOOR_SEED_STEP)}`),
    ...Object.entries(tempo.TEMPO_SEEDS).map(([id, value]) => {
      const name = id === 'blessing' ? '전투 축복' : '증원';
      return row('TEMPO_SEEDS', `${name}의 추첨 시드 상수`, `층별 ${name} 추첨`, `원정 시드와 층을 섞을 때 고정 구분값 ${hex(value)} 사용`, NEW, id);
    })
  ];
}

export function createCategories() {
  const core = loadCore();
  const artifacts = new Map(Array.from(core.ARTIFACT_LIST, artifact => [artifact.id, artifact]));
  const names = {
    card: id => core.GameUtils.getCardById(id)?.name ?? id,
    buff: id => core.BUFF_NAMES[id] ?? id,
    relic: id => {
      if (!artifacts.has(id)) throw new Error(`원본 ARTIFACT_LIST에 없는 유물: ${id}`);
      return artifacts.get(id);
    },
    enemy: id => id === INTRO.boss.id ? INTRO.boss.name : core.ENEMIES.find(enemy => enemy.id === id)?.name ?? id
  };
  const risk = '본편 2층 위험 문';
  const descriptionNotes = {
    overheat: ['기본 치명타 피해 배율이 3으로 바뀝니다. 치명타율 증가는 20%p입니다.', engine('bridge', 'run')],
    starfall: ['턴 시작에 현재 걸리지 않은 필드 효과 후보 중 1개를 뽑습니다.', engine('bridge', 'B.onStartPlayerTurn')],
    martyr: ['후퇴는 발동 조건에 포함되지 않으며 사망 때마다 살아 남은 출전 동료에게 배율이 누적됩니다.', engine('bridge', 'afterAllyDown')],
    echo: ['실제 효과는 즉시 시전한 3티어 이상 공격으로 피해를 주고 적이 살아 있으면 직전 피해의 50%를 추가로 적용하는 것입니다.', engine('bridge', 'B.onSkill')],
    leech: ['자신의 행동 동안 줄어든 아군 HP 합계에서 50%를 내림하여 회복합니다. 최대 HP가 상한입니다.', engine('bridge', 'B.onEndEnemyTurn')]
  };
  const fromDescriptions = (entries, file, key, where) => Object.entries(entries).map(([id, info]) => {
    const [note, source] = descriptionNotes[id] ?? [];
    return makeRow(id, info.name, where(id), info.desc, NEW,
      [content(file, key, id), ...(source ? [source] : [])], note ? [note] : []);
  });
  const sections = [
    ['battle', ruleCategories.battle, ruleRows(ruleCategories.battle)],
    ['quirks', '꿈의 변덕', fromDescriptions(QUIRKS, 'quirks', 'QUIRKS', id =>
      risk + (daily.QUIRKS.includes(id) ? ' / 오늘의 균열 6층 위험 문' : ''))],
    ['affixes', '적 접두사', fromDescriptions(AFFIXES, 'affixes', 'AFFIXES', id =>
      `${risk} · 6층 정예 · 악몽 전투의 첫 적` + (daily.AFFIXES.includes(id) ? ' / 오늘의 균열 6층 위험 문' : ''))],
    ['regions', '지역 규칙', regions()],
    ['events', '사건', eventRows(core, names)],
    ['relics', '유물', relicRows(names)],
    ['bosses', '보스', bossRows(core)],
    ['lessons', '보스 예행 전투', lessonRows(core, names)],
    ['wild', '야생 몽마', Object.entries(WILD).map(([id, beast]) => makeRow(id, beast.name,
      locations(dungeonEntries.filter(([, dungeon]) => dungeon.wild.includes(id)).map(([key]) => key)),
      `${ELEMENT[beast.element]} 속성 · ${{ small: '소형', medium: '중형', large: '대형' }[beast.size]} · ${statText(beast.stats)}. ${beast.skill[0]}(${types[beast.skill[1]]} 위력 ${beast.skill[2]}배).`,
      NEW, content('wild', 'WILD', id), LARGE.includes(id) ? ['정예 문에서 야생을 뽑을 때 대형 몽마를 우선합니다.'] : []))],
    ['dungeons', '던전 구성', dungeonRows(core, names)],
    ['floors', '층별 문 구성', layoutRows()],
    ['room-names', '방 이름', Object.entries(ROOM_NAMES).map(([id, name]) => makeRow(id, name,
      roomLocations(id).join(' / '), `문에 표시하는 방 유형 · ${name}. 층별 문 구성에 보상과 선택지 수를 표시합니다.`, NEW,
      content('layouts', 'ROOM_NAMES', id)))],
    ['intro', '입문', introRows(names)],
    ['contracts', '계약(악몽)', contractRows()],
    ['notebook', '수첩', notebookRows()],
    ['missions', '임무', missionRows()],
    ['daily', '오늘의 균열', dailyRows(names)],
    ['tempo', '템포 수치', tempoRows()],
    ...Object.entries(ruleCategories).filter(([id]) => id !== 'battle').map(([id, name]) => [id, name, ruleRows(name)])
  ];
  return sections.map(([id, name, rows]) => ({
    id, name, rows: rows.map(({ key, ...data }) => ({ id: `${id}/${key}`, ...data }))
  }));
}

const statuses = [
  ['unreviewed', '미검수'], ['confirmed', '확인'], ['needs-fix', '수정 필요'], ['question', '질문']
];

function browserReview(page, validStatuses) {
  const rows = new Map();
  const storageKey = id => page + ':' + id;
  const empty = () => ({ status: 'unreviewed', memo: '' });
  const statusMessage = document.querySelector('#message');
  const count = document.querySelector('#matches');
  const search = document.querySelector('#search');
  const filters = document.querySelector('#filters');
  const sections = [...document.querySelectorAll('main section')];
  const normalize = value => value.normalize('NFC').toLocaleLowerCase('ko');
  let storageAvailable = true;

  function validRecord(record) {
    return record && validStatuses.includes(record.status) && typeof record.memo === 'string' && !/[\r\n]/.test(record.memo);
  }

  function read(id) {
    try {
      const record = JSON.parse(localStorage.getItem(storageKey(id)));
      return validRecord(record) ? record : empty();
    } catch (error) {
      if (!(error instanceof SyntaxError)) storageAvailable = false;
      return empty();
    }
  }

  function update(row, record) {
    row.status.value = record.status;
    row.memo.value = record.memo;
    row.record = record;
    try {
      if (record.status === 'unreviewed' && !record.memo) localStorage.removeItem(storageKey(row.id));
      else localStorage.setItem(storageKey(row.id), JSON.stringify(record));
    } catch {
      storageAvailable = false;
    }
  }

  function showMessage(message = '') {
    statusMessage.textContent = [message, storageAvailable ? '' : '이 브라우저에서 검수 기록을 저장하거나 불러올 수 없습니다. 현재 기록은 JSON으로 내보낼 수 있습니다.'].filter(Boolean).join(' ');
  }

  function applyFilters() {
    const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    const selected = filters.querySelector('input:checked').value;
    let visible = 0;
    let reviewed = 0;
    for (const { card, searchable, record } of rows.values()) {
      const matches = (selected === 'all' || record.status === selected) && terms.every(term => searchable.includes(term));
      card.hidden = !matches;
      if (matches) visible++;
      if (record.status !== 'unreviewed') reviewed++;
    }
    // While searching or filtering, categories with no match fold away so the matches sit together.
    const filtering = terms.length > 0 || selected !== 'all';
    for (const section of sections) {
      const shown = section.querySelectorAll('.card:not([hidden])').length;
      section.querySelector('.section-count').textContent = shown + ' / ' + section.dataset.total;
      section.querySelector('.empty').hidden = shown !== 0 || filtering;
      section.hidden = filtering && shown === 0;
    }
    count.textContent = '표시 ' + visible + ' / ' + rows.size + '개 · 판정 완료 ' + reviewed + '개';
    document.querySelector('#no-results').hidden = visible !== 0;
  }

  for (const card of document.querySelectorAll('.card')) {
    const { item: id } = card.dataset;
    const status = card.querySelector('select');
    const memo = card.querySelector('input');
    const record = read(id);
    status.value = record.status;
    memo.value = record.memo;
    const searchable = normalize([...card.querySelectorAll('.searchable')].map(element => element.textContent).join(' '));
    const row = { id, card, status, memo, record, searchable };
    rows.set(id, row);
    status.addEventListener('change', () => {
      update(row, { status: status.value, memo: memo.value });
      showMessage();
      applyFilters();
    });
    memo.addEventListener('input', () => {
      update(row, { status: status.value, memo: memo.value });
      showMessage();
    });
  }

  document.querySelector('#export').addEventListener('click', () => {
    const records = Object.fromEntries([...rows.values()]
      .filter(({ record }) => record.status !== 'unreviewed' || record.memo)
      .map(({ id, record }) => [id, record]));
    const file = new Blob([JSON.stringify({ page, version: 1, records }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = page + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage('판정 기록 ' + Object.keys(records).length + '개를 내보냈습니다.');
  });

  document.querySelector('#import').addEventListener('change', async event => {
    const input = event.currentTarget;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.page !== page || data.version !== 1 || !data.records
        || typeof data.records !== 'object' || Array.isArray(data.records)) throw new Error('invalid format');
      const entries = Object.entries(data.records);
      if (!entries.every(([, record]) => validRecord(record))) throw new Error('invalid record');
      const known = entries.filter(([id]) => rows.has(id));
      for (const [id, record] of known) update(rows.get(id), { status: record.status, memo: record.memo });
      showMessage('판정 기록 ' + known.length + '개를 가져왔습니다.'
        + (known.length < entries.length ? ' 현재 페이지에 없는 항목 ' + (entries.length - known.length) + '개를 건너뛰었습니다.' : ''));
      applyFilters();
    } catch {
      showMessage('가져오기에 실패했습니다. 이 페이지에서 내보낸 판정 기록 JSON을 선택하세요.');
    }
  });

  window.addEventListener('storage', event => {
    if (event.key !== null && !event.key.startsWith(page + ':')) return;
    const affected = event.key === null ? [...rows.values()] : [rows.get(event.key.slice(page.length + 1))].filter(Boolean);
    for (const row of affected) {
      row.record = read(row.id);
      row.status.value = row.record.status;
      row.memo.value = row.record.memo;
    }
    applyFilters();
  });
  search.addEventListener('input', applyFilters);
  filters.addEventListener('change', applyFilters);
  showMessage();
  applyFilters();
}

const escape = value => String(value).replace(/[&<>"']/g, symbol =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[symbol]);
const statusOptions = statuses.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

function renderRow({ id, name, where, effect, relation, sources, details }) {
  const field = (label, value, classes = '') => `<div class="${classes}"><dt>${label}</dt><dd>${value}</dd></div>`;
  const linkedSources = sources.map(source => `<code>${escape(source)}</code>`).join('');
  const lines = details.length ? `<ul>${details.map(detail => `<li>${escape(detail)}</li>`).join('')}</ul>` : '';
  return `<article class="card" data-item="${escape(id)}">
  <dl>
    ${field('이름', `<h3>${escape(name)}</h3>`, 'searchable')}
    ${field('어디서 나오나', escape(where), 'searchable')}
    ${field('효과', escape(effect) + lines, 'searchable effect')}
    ${field('원본과의 관계', escape(relation))}
    ${field('자료 위치', linkedSources, 'searchable sources')}
  </dl>
  <div class="review">
    <label>판정<select aria-label="${escape(name)} 판정">${statusOptions}</select></label>
    <label>메모<input type="text" aria-label="${escape(name)} 메모"></label>
  </div>
</article>`;
}

export function renderPage(categories, { generatedAt, commit }) {
  const total = categories.reduce((sum, { rows }) => sum + rows.length, 0);
  const nav = categories.map(({ id, name, rows }) =>
    `<a href="#${id}">${escape(name)} <strong>${rows.length}</strong></a>`).join('\n');
  const sections = categories.map(({ id, name, rows }) => `<section id="${id}" data-total="${rows.length}">
    <h2>${escape(name)} <small class="section-count">${rows.length} / ${rows.length}</small></h2>
    <p class="empty" hidden>조건에 맞는 항목이 없습니다.</p>
    ${rows.map(renderRow).join('\n')}
  </section>`).join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RELAYMARE 변경점 검수</title>
  <style>
    :root { --navy: #29266a; --aqua: #1fc6c1; color: var(--navy); background: #f1f3f9; font: 16px/1.55 system-ui, sans-serif; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; overflow-wrap: anywhere; }
    h1, h2, h3, p, dl, dd, fieldset { margin: 0; }
    header { background: var(--navy); color: #fff; }
    .wrap { width: min(100% - 2rem, 88rem); margin-inline: auto; }
    header .wrap { padding-block: 1.5rem; }
    header p { margin-top: .4rem; }
    h1 { font-size: clamp(1.55rem, 4vw, 2.4rem); line-height: 1.2; }
    h2 { font-size: 1.35rem; margin-bottom: .55rem; }
    h3 { font-size: 1rem; }
    header code, .section-count { font-size: .875rem; }
    .section-count { vertical-align: middle; margin-inline-start: .25rem; }
    nav { display: flex; flex-wrap: wrap; gap: .45rem; padding-block: 1rem; }
    nav a, button, .file { background: #fff; border: 2px solid var(--navy); color: inherit; padding: .38rem .65rem; text-decoration: none; }
    nav strong { margin-inline-start: .2rem; background: var(--aqua); padding: .03rem .32rem; }
    nav a:hover, button:hover, .file:hover { background: var(--aqua); }
    .controls { background: #fff; border: 2px solid var(--navy); padding: 1rem; display: grid; gap: .75rem; }
    .search, .review label { display: grid; gap: .2rem; min-width: 0; font-weight: 650; }
    input, select, button { font: inherit; color: inherit; border-radius: 0; }
    input[type="search"], input[type="text"], select { width: 100%; min-width: 0; border: 1px solid var(--navy); background: #fff; padding: .3rem .45rem; }
    input[type="radio"] { accent-color: var(--navy); }
    fieldset { border: 0; min-width: 0; padding: 0; }
    legend { padding: 0; font-weight: 650; }
    .actions, .filters { display: flex; flex-wrap: wrap; gap: .45rem .85rem; align-items: center; }
    button, .file { cursor: pointer; font-weight: 650; }
    .file { position: relative; }
    .file input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
    :focus-visible, .file:focus-within { outline: 3px solid var(--aqua); outline-offset: 2px; }
    #message:empty { display: none; }
    #matches { font-weight: 700; }
    main { padding-block: .75rem 2rem; }
    section { margin-block: 1.35rem 2rem; scroll-margin-block-start: 1rem; }
    .card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 12rem); background: #fff; border: 2px solid var(--navy); margin-bottom: .65rem; }
    .card:focus-within { box-shadow: inset .25rem 0 var(--aqua); }
    dl { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.15fr) minmax(0, 2.6fr) minmax(0, .85fr) minmax(0, 1.2fr); gap: .8rem; padding: .8rem; }
    dl > div, .review { min-width: 0; }
    dt { color: #504b82; font-size: .8rem; font-weight: 700; margin-bottom: .28rem; }
    dd { font-size: .92rem; }
    dd ul { margin: .35rem 0 0; padding-inline-start: 1.15rem; }
    dd li + li { margin-top: .32rem; }
    .sources code { display: block; font-size: .8rem; }
    .sources code + code { margin-top: .32rem; }
    .review { display: grid; align-content: start; gap: .5rem; background: #e8f9f9; padding: .8rem; border-inline-start: 1px solid var(--navy); font-size: .88rem; }
    .empty, #no-results { padding: .65rem; }
    @media (max-width: 70rem) {
      dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .effect { grid-column: 1 / -1; }
    }
    @media (max-width: 40rem) {
      .wrap { width: calc(100% - 1.25rem); }
      .card { grid-template-columns: minmax(0, 1fr); }
      dl { grid-template-columns: minmax(0, 1fr); }
      .review { grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); border-inline-start: 0; border-block-start: 1px solid var(--navy); }
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>RELAYMARE 변경점 검수</h1>
      <p>생성 시각 <time datetime="${escape(generatedAt)}">${escape(generatedAt)} (UTC)</time> · Git <code>${escape(commit)}</code> · 총 ${total}개</p>
      <p>다시 만들기 <code>node card_pixel/plan/build-changes-review.mjs</code></p>
    </div>
  </header>
  <div class="wrap">
    <nav aria-label="검수 범주">
      ${nav}
    </nav>
    <div class="controls">
      <label class="search">검수 항목 검색<input id="search" type="search" placeholder="이름, 효과, 등장 조건, 자료 위치"></label>
      <fieldset id="filters">
        <legend>판정 필터</legend>
        <div class="filters">
          <label><input type="radio" name="filter" value="all" checked> 모두 보기</label>
          <label><input type="radio" name="filter" value="needs-fix"> 수정 필요만 보기</label>
          <label><input type="radio" name="filter" value="unreviewed"> 미검수만 보기</label>
        </div>
      </fieldset>
      <div class="actions">
        <button id="export" type="button">판정 기록 내보내기</button>
        <label class="file">판정 기록 가져오기<input id="import" type="file" accept=".json,application/json" aria-describedby="import-help"></label>
      </div>
      <p id="import-help">판정과 메모는 이 브라우저에 저장합니다. JSON을 가져오면 같은 항목의 기록을 덮어씁니다.</p>
      <p id="message" role="status"></p>
      <p id="matches" aria-live="polite">표시 ${total} / ${total}개</p>
    </div>
    <main>
      <p id="no-results" hidden>검색과 판정 조건에 맞는 항목이 없습니다.</p>
      ${sections}
    </main>
  </div>
  <script>
    (${browserReview.toString()})(${JSON.stringify(pageName)}, ${JSON.stringify(statuses.map(([value]) => value))});
  </script>
</body>
</html>
`;
}

function readGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // Managed workspaces can allow reads while blocking Node from spawning git.
    const read = file => {
      try {
        return readFileSync(file, 'utf8').trim();
      } catch (error) {
        if (error.code === 'ENOENT') return '';
        throw error;
      }
    };
    const entry = resolve(repoRoot, '.git');
    const dir = statSync(entry).isDirectory() ? entry : resolve(repoRoot, read(entry).replace(/^gitdir:\s*/, ''));
    const head = read(resolve(dir, 'HEAD'));
    if (!head.startsWith('ref: ')) {
      if (head) return head;
      throw new Error('Git HEAD를 읽을 수 없습니다.');
    }
    const ref = head.slice('ref: '.length);
    const common = resolve(dir, read(resolve(dir, 'commondir')));
    const loose = read(resolve(dir, ref)) || read(resolve(common, ref));
    if (loose) return loose;
    const packed = read(resolve(common, 'packed-refs')).split(/\r?\n/).find(line => line.endsWith(' ' + ref));
    if (packed) return packed.split(' ')[0];
    throw new Error(`Git HEAD 참조를 읽을 수 없습니다: ${ref}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const commit = readGitCommit();
  const categories = createCategories();
  const html = renderPage(categories, { generatedAt: new Date().toISOString(), commit });
  writeFileSync(output, html, 'utf8');
  console.log(`changes-review.html · ${Buffer.byteLength(html).toLocaleString('en-US')} bytes · ${categories.reduce((sum, { rows }) => sum + rows.length, 0)}개`);
  for (const { name, rows } of categories) console.log(`${name} · ${rows.length}`);
}
