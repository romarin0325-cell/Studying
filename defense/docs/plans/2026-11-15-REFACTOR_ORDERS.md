# 디펜스 출시 전 리팩토링 지시서 (2026-11-15)

이 문서는 Star Garden(`defense/`)의 출시 전 리팩토링을 다른 AI 코딩 도구가 순서대로 수행하도록 쓴 지시서다.
작성: Claude. 기준 커밋: `398dc7c` (main). 줄 번호는 이 커밋 기준이고 앞 단계에서 밀리므로, 위치는 줄 번호가 아니라 **인용한 코드 문자열**로 찾는다.

## 0. 먼저 읽을 것

### 이 작업의 목적
출시 뒤에 밸런스와 콘텐츠를 계속 고칠 때 사고가 나지 않게 하는 것이다. 코드를 보기 좋게 만드는 작업이 아니다. 구체적으로 세 가지만 한다.

1. 업데이트 뒤 진행 중이던 전투 때문에 세이브 전체가 열리지 않게 되는 문제를 막는다(1단계, 유일한 동작 변경).
2. 같은 규칙 숫자가 실제 전투 코드와 설명 문구 코드에 따로 적혀 있는 곳을 한 함수로 합친다(2·3단계, 동작 변경 없음).
3. 아무도 쓰지 않는 내보내기 네 개를 지운다(4단계).

### 이미 확인된 것
2026-11-15에 이 문서의 "찾기/바꾸기" 문자열을 문서에서 그대로 읽어 저장소에 임시로 전부 적용해 보았고(1~4단계, 49곳), 결과는 다음과 같았다. 확인 뒤 되돌렸으므로 저장소는 아직 고쳐지지 않은 상태다.
- 기준선: main에서 `npm ci` 후 `node --test defense/tests/*.test.mjs`는 433개 전부 통과.
- 적용 후: 438개 중 437개 통과. 실패 1개는 2장에 적은 "빌드 결과가 소스보다 오래됨" 검사이고 5단계의 빌드로 없어진다(빌드 뒤의 결과는 확인하지 않았다).
- 적용 후: 전투 동일성 검사(2장)가 전부 `IDENTICAL`, 보고서 확인 `PASS`.
- 1단계의 새 테스트 5개는 수정 전 3개 실패, 수정 후 5개 통과.
- 변경량: `engine.js` 추가 46줄·삭제 29줄, `profile.js` 추가 6줄·삭제 3줄, 나머지 네 파일은 1~2줄.

그러니 이 문서대로 했는데 검사가 실패하면 저장소가 문서 작성 이후 바뀌었거나 옮겨 적다 틀린 것이다. 고쳐 보려 하지 말고 되돌린 뒤 멈춰서 보고한다(1장의 멈춤 규칙).

### 이 코드의 특징
- 한 줄이 수백 자인 줄이 많다. 일부러 그렇게 쓴 것이므로 줄을 나누거나 정렬하지 않는다.
- 이 체크아웃의 소스 파일 줄 끝은 CRLF다. 여러 줄을 한 번에 찾아 바꾸는 스크립트는 실패하기 쉽다. 편집 도구의 정확한 문자열 치환을 쓰고, 이 문서의 "찾기" 문자열은 모두 한 줄 안에 있다.
- 전투 엔진(`src/combat/engine.js`)은 같은 시드면 같은 결과가 나온다. 2장의 검사가 이 성질을 이용한다.

## 1. 모든 단계에 적용되는 규칙

1. **순서대로, 한 번에 한 단계.** 단계 하나가 커밋 하나다(3단계는 캐릭터 하나가 커밋 하나). 단계의 통과 조건을 모두 확인한 뒤에만 커밋하고 다음으로 간다.
2. **이 문서에 적힌 곳만 고친다.** 눈에 띄는 다른 개선점은 고치지 말고 마지막 보고에 적는다. 특히 `src/app.js`, `src/style.css`, `src/theme-bright.css`, `assets/`, `dist/`, `dist-test/`는 5단계의 빌드 외에는 건드리지 않는다.
3. **숫자, 문구, 동작을 바꾸지 않는다.** 1단계만 예외이고 그 범위는 1단계에 적힌 것이 전부다.
4. **포맷을 바꾸지 않는다.** 자동 정렬 도구(Prettier 등)를 돌리지 않는다. 공백, 줄바꿈, 따옴표를 그대로 둔다.
5. **"찾기" 문자열은 파일 안에 정확히 한 번 있어야 한다.** 0번이거나 2번 이상이면 치환하지 말고 멈춘다.
6. **검사를 통과시키려고 검사 쪽을 고치지 않는다.** 기존 테스트의 기대값, `golden-replay.mjs`, 저장해 둔 기준 파일을 수정하지 않는다.
7. **멈춤 규칙.** 통과 조건이 하나라도 실패하면 그 단계의 변경을 `git checkout -- <파일>`로 되돌리고, 어느 단계의 어느 검사가 어떻게 실패했는지(출력 포함) 적어서 멈춘다. 원인을 추측해 다른 수정을 덧붙이지 않는다.
8. **커밋 메시지**는 영어 한 줄로 쓴다. 각 단계에 예시가 있다.

## 2. 검사 명령 (저장소 루트 `Studying/`에서 실행)

| 이름 | 명령 | 통과 기준 |
|---|---|---|
| 단위 테스트 | `node --test defense/tests/*.test.mjs` | 아래 "단위 테스트의 통과 기준" |
| 전투 동일성 | `node defense/scripts/golden-replay.mjs --compare defense/test-results/golden-before.json` | 마지막 줄 `IDENTICAL to ...` |
| 보고서 확인 | `node defense/scripts/generated-reports.mjs --check` | `PASS` |

**단위 테스트의 통과 기준.**
- 0단계(아무것도 고치기 전)와 5단계의 빌드 뒤: 출력 끝이 `fail 0`.
- 1~4단계: 실패가 **정확히 1개**이고 그것이 `defense/tests/build.test.mjs`의 `CI creates fresh temporary variants without image encoding and still checks release artifacts`이며 출력에 `is stale; rebuild and commit both release skins`가 있어야 한다. 소스를 고쳤는데 `dist/`를 아직 다시 만들지 않아서 나는 정상적인 실패다. 이 실패를 없애려고 중간에 빌드하지 않는다(빌드는 5단계에서 한 번만 한다). 이것 말고 다른 실패가 하나라도 있으면 멈춘다.

전투 동일성 검사는 고정된 전투 10판(동료 42명과 유물 30개가 모두 한 번 이상 나온다)을 같은 시드로 돌려 네 가지를 비교한다: 전투 상태, 화면으로 보내는 이벤트, 전투 중 설명 문구, 저장했다 불러온 상태. 훈련 문구와 동료 정보 문구도 따로 비교한다. 4초쯤 걸린다. 다르면 어느 전투의 무엇이 달라졌는지 출력한다.
- `state` 또는 `events`가 달라짐: 실제 전투 규칙을 바꿨다.
- `text` 또는 `sheet`만 달라짐: 설명 문구에 나오는 숫자를 바꿨다.
- 기준 파일은 같은 PC, 같은 Node 버전에서 만든 것만 비교한다.

## 3. 단계

### 0단계. 준비와 기준선

1. main(`398dc7c` 이후)에서 작업 브랜치를 만든다: `git switch -c refactor/defense-pre-launch`
2. `npm ci`
3. 단위 테스트를 돌린다. 실패가 있으면 아무것도 고치지 말고 멈춘다.
4. 기준 파일을 만든다: `node defense/scripts/golden-replay.mjs --write defense/test-results/golden-before.json` (`defense/test-results/`는 Git이 무시하는 폴더다. 이 파일은 커밋하지 않는다.)
5. 곧바로 전투 동일성 검사를 돌려 `IDENTICAL`이 나오는지 확인한다. 아니면 멈춘다.
6. 아직 커밋되지 않은 두 파일을 커밋한다: `defense/scripts/golden-replay.mjs`, `defense/docs/plans/2026-11-15-REFACTOR_ORDERS.md` (그리고 `defense/docs/README.md`의 색인 한 줄).
   커밋 메시지 예: `chore(defense): add golden replay check and pre-launch refactor orders`

### 1단계. 불러올 수 없는 전투 저장 때문에 세이브 전체가 잠기지 않게 한다

**무엇이 문제인가.** 지금은 진행 중이던 전투 저장(`active.run`)을 복원하지 못하면 프로필 전체를 무효로 본다(`validateProfile`의 `if(a.run!==null&&!resumeBattle(p))return false;`). 그러면 플레이어는 "저장 데이터가 손상되었습니다. 백업을 불러오세요."만 보고 아무 동작도 할 수 없다. 전투 저장은 업데이트로 성장 공식이나 전투 상태 형식이 바뀌면 복원되지 않는다. 즉 출시 뒤 밸런스 패치 한 번이 전투 도중에 게임을 닫았던 모든 플레이어의 계정을 잠글 수 있다.

**어떻게 고치나.** 프로필이 무효인 이유가 전투 저장뿐이면 전투 저장만 버린다. `active`(원정 자체, 입장 기록, 시드)는 그대로 두므로 같은 원정이 1웨이브부터 다시 시작된다. `active.run===null`은 원래 있는 정상 상태(원정을 시작하고 아직 저장 전)라서 새 상태를 만드는 것이 아니다.

**고칠 파일: `defense/src/profile.js`** (네 곳)

1. 함수 서명.
   - 찾기: `export function parseProfile(raw){`
   - 바꾸기: `export function parseProfile(raw,notes){`
   - 그리고 이 줄 **바로 위에** 주석 두 줄을 새로 넣는다:
     ```js
     // A battle checkpoint that no longer restores (an update changed combat or growth numbers) must not lock the whole
     // save: the sortie is kept and restarts from wave 1. notes.runDropped tells the caller that this happened.
     ```
2. 함수 끝.
   - 찾기: `return validateProfile(p)?p:null;}catch{return null;}}`
   - 바꾸기: `if(validateProfile(p))return p;if(p?.active&&typeof p.active==='object'&&typeof p.active.run==='string'){p.active.run=null;if(validateProfile(p)){if(notes)notes.runDropped=true;return p;}}return null;}catch{return null;}}`
3. `ProfileStore` 생성자 첫 줄.
   - 찾기: `this.storage=storage;this.broken=false;this.conflict=false;this.warning='';let raw=null;`
   - 바꾸기: `this.storage=storage;this.broken=false;this.conflict=false;this.warning='';this.restarted=false;let raw=null;`
4. `ProfileStore` 생성자 둘째 줄 안.
   - 찾기: `this.value=raw?parseProfile(raw):createProfile(now);`
   - 바꾸기: `const notes={};this.value=raw?parseProfile(raw,notes):createProfile(now);this.restarted=notes.runDropped===true;`

`validateProfile`, `resumeBattle`, `engine.restore`는 고치지 않는다. 화면 쪽(`app.js`)도 이 단계에서 고치지 않는다(`store.restarted`를 읽어 안내를 띄우는 일은 화면 확인이 필요해서 따로 한다).

**새 테스트 파일: `defense/tests/save-fallback.test.mjs`** (아래 내용 그대로)

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileStore,SAVE_KEY,createProfile,parseProfile,command} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import * as engine from '../src/combat/engine.js';

const NOW=Date.parse('2026-11-15T03:00:00Z');
// A profile in the middle of a main-stage battle, with its checkpoint saved.
function midBattle(){
  const p=createProfile(NOW);
  assert.equal(command(p,'begin',{mode:'main',stage:1},NOW).ok,true);
  p.active.run=engine.serialize(createBattle(p));
  return p;
}
// What an update that changes a permanent growth number does to a saved checkpoint:
// the multiplier recorded in the run no longer equals today's formula.
function outdated(p){
  const run=JSON.parse(p.active.run),first=Object.keys(run.meta)[0];
  run.meta[first].power=Number((run.meta[first].power*1.01).toFixed(6));
  p.active.run=JSON.stringify(run);
  return p;
}

test('an unchanged battle checkpoint is kept as it is',()=>{
  const p=midBattle(),notes={},back=parseProfile(JSON.stringify(p),notes);
  assert.ok(back);assert.equal(back.active.run,p.active.run);assert.equal(notes.runDropped,undefined);
});

test('a checkpoint that no longer restores restarts the sortie instead of locking the save',()=>{
  const p=outdated(midBattle()),notes={},back=parseProfile(JSON.stringify(p),notes);
  assert.ok(back,'the profile stays readable');
  assert.equal(back.active.run,null,'the battle restarts from wave 1');
  assert.equal(back.active.token,p.active.token,'the same sortie, not a new entry');
  assert.equal(back.active.seed,p.active.seed);
  assert.equal(back.dreams,p.dreams);assert.equal(back.cleared,p.cleared);
  assert.equal(notes.runDropped,true);
  assert.ok(createBattle(back),'the sortie can start again');
});

test('a checkpoint from another status revision is dropped the same way',()=>{
  const p=midBattle(),run=JSON.parse(p.active.run);run.statusRevision=engine.STATUS_REVISION+1;p.active.run=JSON.stringify(run);
  const back=parseProfile(JSON.stringify(p));
  assert.ok(back);assert.equal(back.active.run,null);
});

test('a profile that is wrong for another reason is still refused',()=>{
  const p=outdated(midBattle());p.dreams=-1;
  assert.equal(parseProfile(JSON.stringify(p)),null);
});

test('the store opens such a save, reports the restart and accepts commands',()=>{
  const p=outdated(midBattle()),mem=new Map([[SAVE_KEY,JSON.stringify(p)]]);
  const store=new ProfileStore({getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v))},NOW);
  assert.equal(store.broken,false);assert.equal(store.restarted,true);
  assert.equal(store.transact('tick',{},NOW).ok,true);
  const fresh=new ProfileStore({getItem:()=>null,setItem(){}},NOW);
  assert.equal(fresh.restarted,false);
});
```

**순서와 통과 조건.**
1. 테스트 파일을 먼저 만들고 `node --test defense/tests/save-fallback.test.mjs`를 돌린다. 수정 전이므로 5개 중 3개가 실패해야 한다(실패하지 않으면 멈춘다).
2. `profile.js` 네 곳을 고친다.
3. 같은 명령이 5개 모두 통과한다.
4. 단위 테스트 전체가 2장의 기준대로 통과한다(1~4단계에서는 빌드 검사 1개만 실패).
5. 전투 동일성 검사가 `IDENTICAL`.
6. `git status --short`에 `defense/src/profile.js`(수정)와 새 테스트 파일만 나온다.

커밋 메시지 예: `fix(defense): restart the sortie when its checkpoint no longer restores instead of locking the save`

### 2단계. 독 중첩을 고르는 코드를 하나로 합친다

**무엇이 문제인가.** "지금 유효한 독 중첩을 고르는 규칙"(강한 것부터, 최대 `POISON_CAP`)이 전투용 `activePoison()`과 필살기 미리보기 `castPreview()` 안의 `poisonNow`에 똑같이 두 번 적혀 있다. 한쪽만 고치면 미리보기 숫자와 실제 피해가 달라진다.

**고칠 파일: `defense/src/combat/engine.js`**

1. 함수 이름과 인자를 바꾼다.
   - 찾기: `function activePoison(e){`
   - 바꾸기: `function selectPoison(effects){`
   - 이 줄 **바로 위에** 주석 한 줄을 넣는다:
     ```js
     // The poison stacks that count right now: strongest first, POISON_CAP stacks at most. Combat and the ultimate preview both use this.
     ```
2. 그 함수 안에서.
   - 찾기: `return e.statusEffects.filter(effect=>effect.type==='poison').sort(`
   - 바꾸기: `return effects.filter(effect=>effect.type==='poison').sort(`
3. 그 함수가 끝나는 `}` 줄 **바로 아래에** 한 줄을 새로 넣는다:
   ```js
   function activePoison(e){return selectPoison(e.statusEffects);}
   ```
4. `castPreview` 안에서 `    const select=list=>{let remaining=POISON_CAP;`로 시작하는 줄 **한 줄 전체를 지운다**.
5. - 찾기: `return select([{type:'poison',source:'legacy:poison'`
   - 바꾸기: `return selectPoison([{type:'poison',source:'legacy:poison'`
6. - 찾기: `return select(e.statusEffects.filter(effect=>effect.until-s.time>1e-9));`
   - 바꾸기: `return selectPoison(e.statusEffects.filter(effect=>effect.until-s.time>1e-9));`

**통과 조건.** 단위 테스트가 2장의 기준대로 통과, 전투 동일성 `IDENTICAL`, `git diff --stat`에 `engine.js`만 나오고 변경이 10줄 안팎.

커밋 메시지 예: `refactor(defense): share one poison selection between combat and the ultimate preview`

### 3단계. 캐릭터 일곱 명의 규칙 숫자를 한 함수로 합친다

**무엇이 문제인가.** 예를 들어 세이렌의 인접 공격 속도 `0.15 + 훈련레벨 × 0.03`이 다섯 곳에 따로 적혀 있다: 실제 효과(`combatStats`), 훈련 문구(`trainingBonus`), 동료 정보 문구(`scaledTokens`), 전투 중 특성 문구(`liveTraitTokens`), 전투 중 "주는 효과" 문구(`givenEffects`). 밸런스를 바꿀 때 한 곳을 빠뜨리면 설명과 실제가 달라진다.

**어떻게 고치나.** 캐릭터마다 숫자만 받는 작은 함수 하나를 만들고 모든 곳이 그 함수를 부르게 한다. 이 파일에 이미 있는 `stormExecuteChance`, `harmonyStrength`, `queenIncome`과 같은 방식이다.

**주의할 점 두 가지.**
- 곱하는 순서를 바꾸면 소수점 마지막 자리가 달라져 전투 동일성 검사가 실패한다. 아래 함수의 식과 인자 순서를 그대로 쓴다.
- `'15%'`, `'0.7초'` 같은 따옴표 안의 글자는 동료 설명 원문에서 찾아 바꿀 "열쇠"다. 절대 건드리지 않는다.

**먼저 함수 일곱 개를 넣는다.** `defense/src/combat/engine.js`에서
- 찾기: `export function harmonyAt(s,index){`
- 이 줄 **바로 위에** 아래 14줄을 넣는다.

```js
// One formula per rule number: the attack code and every text that shows the number call the same function.
// level = training level, k = enhancement special, sup = rank support, ctl = rank control. Keep the multiplication order.
// Siren's song, adjacent attack speed.
export const sirenAura=(level,k,sup)=>(.15+level*.03)*k*sup;
// Ancient dragon's blessing, adjacent attack.
export const dragonAura=(level,k,sup)=>(.2+level*.03)*k*sup;
// Guardian's third-hit stun, seconds.
export const guardianStun=(level,k,ctl)=>(.7+level*.05)*k*ctl;
// Time magician's extra attack for neighbours, share of attack.
export const magicianEcho=(level,k,sup)=>(.6+level*.05)*sup*k;
// Frost witch's freeze on slowed enemies, seconds.
export const witchFreeze=(level,k,ctl)=>(.6+level*.06)*k*ctl;
// Aurora's phantom shot, share of the hit. Santa's gift bomb, damage factor.
export const auroraEcho=level=>.75+level*.03,santaGift=level=>2+level*.2;
```

이 상태에서 검사 세 개를 돌려 통과하면 커밋한다(함수만 추가, 아직 아무도 부르지 않음).
커밋 메시지 예: `refactor(defense): add shared rule-number functions for seven companions`

**그다음 캐릭터 한 명씩** 아래 치환을 하고, 한 명이 끝날 때마다 검사 세 개를 돌리고 커밋한다. 모든 "찾기"는 `engine.js` 안에 정확히 한 번 있다.
커밋 메시지 예: `refactor(defense): siren aura uses one formula for combat and text`

**① 세이렌 (5곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``siren:`인접 공격 속도 +${15+level*3}%` `` | ``siren:`인접 공격 속도 +${Math.round(sirenAura(level,1,1)*100)}%` `` |
| `siren:[['15%',pctK(.15)]]` | `siren:[['15%',pctK(sirenAura(0,1,1))]]` |
| `siren:[['15%',pctText((.15+level*.03)*k*sup)]]` | `siren:[['15%',pctText(sirenAura(level,k,sup))]]` |
| ``pctText((.15+level*.03)*k*rankSupport(u.rank))}`);`` | ``pctText(sirenAura(level,k,rankSupport(u.rank)))}`);`` |
| `(.15+(s.upgrades.siren\|\|0)*.03)*special(s,'siren')*rankSupport(sirenRank)` | `sirenAura(s.upgrades.siren\|\|0,special(s,'siren'),rankSupport(sirenRank))` |

(표 안의 `\|\|`는 코드에서는 `||`다. 표 문법 때문에 역슬래시가 붙었다. 아래 표도 같다.)

**② 고대 용 (5곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``ancient_dragon:`인접 공격 +${20+level*3}%` `` | ``ancient_dragon:`인접 공격 +${Math.round(dragonAura(level,1,1)*100)}%` `` |
| `ancient_dragon:[['20%',pctK(.2)]]` | `ancient_dragon:[['20%',pctK(dragonAura(0,1,1))]]` |
| `ancient_dragon:[['20%',pctText((.2+level*.03)*k*sup)]]` | `ancient_dragon:[['20%',pctText(dragonAura(level,k,sup))]]` |
| ``pctText((.2+level*.03)*k*rankSupport(u.rank))}`);`` | ``pctText(dragonAura(level,k,rankSupport(u.rank)))}`);`` |
| `(.2+(s.upgrades.ancient_dragon\|\|0)*.03)*special(s,'ancient_dragon')*rankSupport(dragonRank)` | `dragonAura(s.upgrades.ancient_dragon\|\|0,special(s,'ancient_dragon'),rankSupport(dragonRank))` |

**③ 가디언 (5곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``guardian:`세 번째 공격 기절 ${(.7+level*.05).toFixed(2)}초` `` | ``guardian:`세 번째 공격 기절 ${guardianStun(level,1,1).toFixed(2)}초` `` |
| `guardian:[['0.7초',sec(.7)]]` | `guardian:[['0.7초',sec(guardianStun(0,1,1))]]` |
| `guardian:[['0.7초',secText((.7+level*.05)*k*ctl)]]` | `guardian:[['0.7초',secText(guardianStun(level,k,ctl))]]` |
| ``secText((.7+level*.05)*k*rankControl(u.rank))}`);`` | ``secText(guardianStun(level,k,rankControl(u.rank)))}`);`` |
| `(.7+(s.upgrades[hero.id]\|\|0)*.05)*special(s,hero.id)*rankControl(shot.rank)` | `guardianStun(s.upgrades[hero.id]\|\|0,special(s,hero.id),rankControl(shot.rank))` |

**④ 시간의 마술사 (5곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``time_magician:`인접 추가 공격 공격력 ${60+level*5}%` `` | ``time_magician:`인접 추가 공격 공격력 ${Math.round(magicianEcho(level,1,1)*100)}%` `` |
| `time_magician:[['60%',pctK(.6)]]` | `time_magician:[['60%',pctK(magicianEcho(0,1,1))]]` |
| `time_magician:[['60%',pctText((.6+level*.05)*sup*k)]]` | `time_magician:[['60%',pctText(magicianEcho(level,k,sup))]]` |
| ``pctText((.6+level*.05)*rankSupport(u.rank)*k)}`);`` | ``pctText(magicianEcho(level,k,rankSupport(u.rank)))}`);`` |
| `const scale=(.6+(s.upgrades[hero.id]\|\|0)*.05)*rankSupport(shot.rank)*special(s,hero.id);` | `const scale=magicianEcho(s.upgrades[hero.id]\|\|0,special(s,hero.id),rankSupport(shot.rank));` |

**⑤ 서리 마녀의 빙결 (5곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``return `감속 대상 빙결 ${(.6+level*.06).toFixed(2)}초 · 보스 절반`;`` | ``return `감속 대상 빙결 ${witchFreeze(level,1,1).toFixed(2)}초 · 보스 절반`;`` |
| `['0.6초',sec(.6)]` | `['0.6초',sec(witchFreeze(0,1,1))]` |
| `['0.6초',secText((.6+level*.06)*k*ctl)]` | `['0.6초',secText(witchFreeze(level,k,ctl))]` |
| ``secText((.6+level*.06)*k*rankControl(u.rank))}`);`` | ``secText(witchFreeze(level,k,rankControl(u.rank)))}`);`` |
| `(.6+(s.upgrades[hero.id]\|\|0)*.06)*special(s,hero.id)*rankControl(shot.rank)` | `witchFreeze(s.upgrades[hero.id]\|\|0,special(s,hero.id),rankControl(shot.rank))` |

**⑥ 아우로라 (3곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``return `환영탄 공격력 ${75+level*3}%`;`` | ``return `환영탄 공격력 ${Math.round(auroraEcho(level)*100)}%`;`` |
| `aurora:[['75%',pctText(.75+level*.03)]]` | `aurora:[['75%',pctText(auroraEcho(level))]]` |
| `damage:amount*(.75+(s.upgrades[hero.id]\|\|0)*.03)` | `damage:amount*auroraEcho(s.upgrades[hero.id]\|\|0)` |

**⑦ 산타 (3곳)**

| 찾기 | 바꾸기 |
|---|---|
| ``santa:`선물 폭탄 공격력 ${200+level*20}%` `` | ``santa:`선물 폭탄 공격력 ${Math.round(santaGift(level)*100)}%` `` |
| `num(2+level*.2)` | `num(santaGift(level))` |
| `factor*=2+(s.upgrades[hero.id]\|\|0)*.2;` | `factor*=santaGift(s.upgrades[hero.id]\|\|0);` |

**캐릭터마다의 통과 조건.** 단위 테스트가 2장의 기준대로 통과, 전투 동일성 `IDENTICAL`, 보고서 확인 `PASS`, `git diff --stat`에 `engine.js`만.

**이 단계에서 하지 않는 캐릭터.** 눈토끼·시간의 지배자·팬텀·은하고래의 감속, 명탐정의 노출, 하모니어스는 식이 한 줄에 여러 캐릭터가 섞여 있거나 조건이 달라서 이 지시서의 범위가 아니다. 손대지 않는다.

### 4단계. 아무도 쓰지 않는 내보내기 네 개를 지운다

2026-11-15에 `src`, `tests`, `scripts` 전체에서 이름으로 찾아 다른 곳에서 한 번도 쓰이지 않는 것을 확인한 것들이다. 지우기 직전에 각 이름을 `defense/src`, `defense/tests`, `defense/scripts`에서 다시 검색해 정의한 줄 말고는 없는지 확인한다(`defense/docs/review/` 아래의 옛 복사본은 무시한다). 다른 곳에서 나오면 그 항목은 지우지 않고 보고한다.

| 파일 | 지울 것 | 방법 |
|---|---|---|
| `src/beginner.js` | `ftueActive` | `export const ftueActive=p=>ftueNext(p)!==null;` 한 줄을 지운다 |
| `src/tutor.js` | `hasTutor` | `export const hasTutor=()=>!!tutorSettings().key;` 한 줄을 지운다 |
| `src/combat/effects.js` | `distinctAttackCount` | `export const distinctAttackCount=()=>new Set(HEROES.map(h=>FX_PROFILES[h.id]?.motion)).size;` 한 줄을 지운다. 그러면 이 파일에서 `HEROES`를 더 쓰지 않으므로 첫 줄 `import {HERO,HEROES} from '../content.js';`를 `import {HERO} from '../content.js';`로 바꾼다 |
| `src/content.js` | `CHAPTER_STAGES` | `export const PART_STAGES=45,MAIN_STAGES=90,CHAPTER_STAGES=9;`를 `export const PART_STAGES=45,MAIN_STAGES=90;`로 바꾼다 |

**통과 조건.** 단위 테스트가 2장의 기준대로 통과, 전투 동일성 `IDENTICAL`, 보고서 확인 `PASS`.

커밋 메시지 예: `chore(defense): remove four exports nothing uses`

### 5단계. 빌드와 마무리

1. `defense/AGENTS.md`의 "빌드와 에셋 배포"를 읽고 그대로 따른다. 요점: `node defense/scripts/build.mjs` 한 번으로 일반판, Bright, 밸런스 랩이 함께 갱신되고 모두 커밋한다. 밝은 테스트 빌드도 `node defense/scripts/build.mjs --preview`로 다시 만들어 `defense/dist-test/`를 함께 커밋한다.
2. 빌드 뒤 단위 테스트를 한 번 더 돌려 `fail 0`을 확인한다(빌드 결과를 검사하는 테스트가 있다).
3. 가능하면 `node defense/tests/browser.mjs`(Chromium 필요: `npx playwright install chromium`)를 돌린다. 돌리지 못했으면 못 했다고 보고에 적는다.
4. 커밋 메시지 예: `build(defense): rebuild after the pre-launch refactor`
5. PR을 열 수 있으면 준비 상태로 연다. 설명에는 "1단계만 동작 변경(불러올 수 없는 전투 저장은 원정을 1웨이브부터 다시 시작), 나머지는 동작 변경 없음"과 실행한 검사 결과를 적는다.

### 마지막 보고에 적을 것
- 단계별 커밋 해시와, 각 단계에서 실제로 돌린 검사와 결과.
- 돌리지 못한 검사(브라우저 테스트 등).
- 멈춘 곳이 있으면 그 단계, 실패한 검사의 출력.
- 작업 중 눈에 띄었지만 고치지 않은 것.

## 4. 이 지시서에서 일부러 뺀 일

아래는 하지 않는다. 필요하다고 판단되더라도 고치지 말고 보고에만 적는다.

| 뺀 일 | 이유 |
|---|---|
| `app.js`를 화면별 파일로 나누기 | 함수 250개가 파일 수준 변수 수십 개를 함께 쓴다. 나누려면 상태 구조부터 바꿔야 하고, 안전망이 브라우저 테스트뿐이다. 로그 수집에도 필요하지 않다(모든 저장 명령이 `act()` 한 곳을 지난다). |
| `engine.js`를 여러 파일로 나누기 | 위험이 크고 얻는 것이 적다. |
| 세이브 변환 코드(`migrate*`)를 다른 파일로 옮기기 | 프로필은 버전 번호가 아니라 "필드가 없으면 변환"하는 방식이고 호출 순서에 의존한다. 옮기기만 해서는 동작상 이득이 없다. |
| `25`, `9` 같은 숫자를 상수로 바꾸기 | 5×5 판과 9보스 구성은 저장 형식과 그림이 전제하는 값이라 바뀌지 않는다. 또 `Math.min(9,…)`에는 뜻이 다른 두 가지(만난 보스 수, 별길 번호)가 섞여 있어 기계적으로 바꾸면 틀린다. |
| `CLEAR_UNLOCKS`와 `grantClearUnlocks` 지우기 | 지금은 비어 있지만 "스테이지를 깨면 동료가 합류"하는 완성된 경로다. 콘텐츠 리뉴얼에서 다시 쓸지 정한 뒤 결정한다. |
| `continueEndless` 지우기 | 쓰이지 않지만 `endless` 상태가 전투 저장 형식에 들어 있다. 무한 모드를 되살릴지 정한 뒤 결정한다. |
| `cast()`와 `castPreview()` 전체 통합 | 필살기마다 판단이 필요한 작업이다. 2단계의 독 선택만 한다. |
| 세이브 키 이름, 저장 형식 변경 | 기존 세이브가 열리지 않게 된다. |
