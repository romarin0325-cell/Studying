# 필살기 연출 제작 절차 (재사용용, 2026-11-06)

1차(체리프린스·루나·혹한의마녀·하모니어스)와 2차(자스민·여왕·시간의마술사·은하고래·시간의지배자)를 만든 방법을 다음 동료에게 그대로 쓰도록 정리한 문서다. 무엇을 보여 줄지는 [연출 기획서](plans/VFX_DIRECTION_PLAN.md), 왜 이 구조인지는 [제작 파이프라인](plans/VFX_PRODUCTION_PIPELINE.md)에 있다. 코드는 `src/combat/ur-vfx.js` 한 파일이다.

## 1. 먼저 정할 것

1. **정체성 확인.** `src/combat/engine.js` `cast()`에서 그 필살기가 실제로 하는 일을 읽고, 무엇이 주인공인지 정한다. 즉시 전체 타격은 대개 곁가지다.
   - 자스민: 전역 버프와 해제
   - 여왕: 골드
   - 시간의마술사: 변신
   - 은하고래: 끌어당김과 수확
   - 시간의지배자: 되감기와 정지

   스킬 이름, 설명, 자동 전투의 가치 계산(`smart-auto.js` `ultValue`)이 같은 답을 주는지 본다.
2. **읽히는 정보만 보여 준다.**
   - 고정 골드를 적마다 금화로 보여 주면 "적 수만큼 받는다"로 잘못 읽힌다. 여왕은 금화 분수 한 번이다.
   - 전역 버프의 지속시간은 우측 상단 HUD 타이머가 보여 준다. 아군마다 남는 표식은 두지 않고, 발동 순간의 판 전체 분위기에 투자한다.
   - 변신처럼 그 유닛만 바뀌는 것은 형태 자체가 표식이다.
3. **컷인 띠를 계산에 넣는다.** UR 컷인은 판 위쪽 5~31%를 1.6초 가린다(R·SR은 7~29%, 1.1초). 핵심 순간은 띠 아래에 두거나, 띠가 걷히는 1.3~1.7초에 맞춘다. 자스민의 날개가 그 예다.
4. **색 정체성.** 캐릭터 컨셉 색이 판 전체를 물들여야 한다. 흰색은 가장 뜨거운 심에만 쓴다. 은빛은 그것이 컨셉일 때만 쓴다(루나의 보름달, 혹한의마녀의 서리).

## 2. 에셋: 공용 키트를 먼저 본다

| 시트 | 칸 | 쓰는 곳 |
|---|---|---|
| `ur-kit` (1024×768, 4×3, 빛) | 베기 줄, 초승달, 고리, 안개, 파편, 섬광, 벚꽃잎, 얼음 가시 묶음, 가시, 보름달, 서리, 파편 폭발 | 모든 동료의 섬광·파동·조각, 일반 공격 접촉 불꽃 |
| `ur-kit2` (1024×1024, 4×4) | 빛: 마법진, 날개, 깃털, 시계판, 시계바늘, 빛기둥, 별빛 고래, 은하, 톱니, 모래시계. 물체: 유리구두, 장미, 장미 꽃잎, 가시 덩굴, 금화, 왕관 | 성스러운 빛, 시간, 왕실, 우주 |
| `ur-sweets` (칠한 색) | 하모니어스 디저트 | 색을 색 지도로 만들 수 없는 것만 |

- 새 조각은 **키트로 만들 수 없을 때만** 만든다.
  - 균열, 리본, 빛줄기, 궤적처럼 선으로 되는 것은 코드로 그린다.
  - 같은 조각을 회전, 크기, 개수, 시간차, 합성으로 다르게 쓴다(벚꽃잎은 꽃잎 폭풍도 되고 상처의 꽃잎 폭발도 된다).
- 색은 `RAMPS`(색 지도)로 입힌다. 새 캐릭터에는 지도 하나를 더한다. 0 = 어두운 테두리, 0.3~0.55 = 채도 높은 컨셉 색, 0.78 = 밝은 색, 0.93 이상 = 흰 심.
  - 빛 조각은 밝기에 톤 곡선(`TONE`, 제곱)을 걸어 몸통을 컨셉 색 구간으로 옮긴다.
  - 물체 조각은 회색 음영으로 지도를 읽는다.
- 원본 크기와 디코딩 메모리는 시트 단위로 잰다. 2차 키트는 배포본 213KB, 디코딩 4MiB다.

## 3. 생성 (GPT 이미지, Codex)

폴더마다 `prompt.txt`와 참조(`style-ref.png`, 선택 `character.png`)를 두고 실행한다. 후보는 시트당 3장, 동시에 돌린다(장당 약 2~5분).

```bash
codex exec --skip-git-repo-check -s workspace-write -c model_reasoning_effort=low -C <폴더> -i style-ref.png -i character.png -o last.txt "$(cat prompt.txt)" < /dev/null
```

- **빛 조각**: 검은 바탕에 흰색·회색으로만("luminance maps", 색 금지). 칸 수와 배치, 여백 10%, 글자·사람 금지를 적는다. 참조 1은 기존 이펙트 스타일 판, 참조 2는 그 캐릭터의 기존 엠블럼을 모은 판이다.
- **물체**: "투명 배경 옵션을 켜라"고 적고, 회색 음영만 쓰게 한다. 결과 PNG에 실제 알파가 있는지, 색 픽셀이 0인지 확인한다. 검은 바탕을 지워 만든 물체는 밝은 바탕에서 검은 테두리가 남는다.
- 문구 견본은 `docs/art/ur-vfx2-20261106/kit{L,O,C}.prompt.txt`에 있다. 후보는 무손실 WebP(`exact`)로 출처 폴더에 보관한다.

## 4. 칸 고르기와 패킹

```bash
node defense/scripts/art/pack-pick-sheet.mjs <pack.json> <packing.json>
```

- spec 형식은 `docs/art/ur-vfx2-20261106/kit2-pack.json`을 보면 된다.
  - 모드 `kit`(빛과 물체 혼합), `luma`(빛만), `alpha`(칠한 색)
  - 칸마다 `source: light|object`, 땅에 서는 조각은 `anchor: bottom`, 반짝이 제거는 `solo: true`
- 칸 경계 경고(`edge!`)가 나오면 미리보기에서 잘림을 직접 본다.
- 회전축이 있는 조각(시계바늘)은 패킹 후 축 위치를 재서 상수로 둔다.
- 배포본 추가: `node defense/scripts/art/add-optimized.mjs`. 새 항목만 압축하고 기존 압축본은 건드리지 않는다. 먼저 `--dry-run`으로 본다.
- `src/data.js` `ASSET_PATHS`에 등록하고, `tests/assets.test.mjs`의 개수와 크기 목록을 고친다. `node defense/scripts/generated-reports.mjs`로 `ASSET_PROVENANCE.json`을 갱신한다.

## 5. 코드: 시퀀스 하나

`ur-vfx.js`에 객체 하나를 쓰고 `UR_SPECS`·`NEEDS`에 등록한다. 그 영웅의 아틀라스가 하나라도 없으면 이전 연출로 돌아간다.

| 항목 | 역할 |
|---|---|
| `life(skill)` | 연출 길이(초) |
| `plan(fx, skill)` | 시전 이벤트를 받아 `skill.ur`을 만들고, 적 uid → 화면상 타격 시각 `Map`을 돌려준다. 렌더러가 숫자·사망·체력바를 그 시각까지 보류한다. `skill.ur.moves`(적이 길을 따라 미끄러지는 표시), `skill.ur.gold`(HUD 골드 보류)도 여기서 넣는다 |
| `field` / `over` | 유닛 아래 / 위에 그리는 층 |
| `body` | 시전자의 몸 동작(dy, angle, squash, alpha, `form`) |
| `unitBody` | 시전자 외에 이름이 오른 모든 유닛의 몸 동작(변신 전까지 `form:null`) |
| `persistent` / `persistentOver` | 지속 효과(서리 길, 트라우마 아래 빛) |
| `formChange` | 형태가 바뀐 순간(변신 해제) |
| `finisher` | 지연 일격의 엔진 임팩트를 받는다(체리프린스) |

- **엔진**에는 표시용 정보만 더한다. `look`이나 `marks`에 넣고 판정과 수치는 바꾸지 않는다.
  - 해제된 아군, 맞은 적, 이동 전 위치 `p0`, 거둔 성광 수, 세금과 칙령 금액
- **도구 함수**: `kit`/`kit2`(색 입힌 조각), `kitStanding`(땅에 서는 조각), `disc`(바닥에 누운 원), `clockHand`, `pillar`, `drawGhost`(실제 SD를 물들인 잔상·실루엣, 변신 형태 포함), `wash`, `vignette`, `skyLight`, `stars`, `snow`, `label`.
- **타격감**: `stun(fx, 흔들림, 히트스톱)`은 마지막 타격 한 번에만 크게 준다. 히트스톱은 시뮬레이션만 멈춘다.
- **연출 줄이기**(`fx.reduced`): 파티클·씻기·흔들림을 뺀다. 정보(누가 맞았나, 누가 정지했나)는 남긴다.
- `effects.js`에서 옛 표시를 끄는 곳:
  - 전역 버프 발밑 도장: `quiet`
  - 부분 오라 고리: 트라우마
  - 기절 별: `drawTimeStop`

## 6. 비교 도구와 검수

- 장면: `docs/review/ur-vfx-20261106/scene.js`에 `ENTRIES`(묶음 번호, 순간, 옵션, 의도 설명)와 `ROSTERS`(배치)를 더한다. 옵션이 필요하면 `reviewScene`과 `review.js`·`template.html`의 체크 상자에 넣는다.
- 빌드: `node defense/scripts/review-ur-vfx.mjs [--page <폴더>] [--base origin/main]`. 왼쪽은 main 렌더러, 오른쪽은 이번 렌더러다.
- 자기 검수 캡처:

```bash
node defense/scripts/review-capture.mjs --key queen --times 0.3,0.9,1.4 --only after --scale 0.5 --config "{\"theme\":\"bright\"}"
```

  - 상태 줄에는 보류 중인 숫자·잔상·히트스톱 누적·HUD 보류 골드·미끄러지는 적 수가 나온다.
- 볼 것:
  1. 정체성이 첫눈에 읽히는가
  2. 기존 연출보다 약하지 않은가
  3. 컷인 띠 아래에서 핵심이 보이는가
  4. 휴대폰 크기, Bright·새벽 정원, 연출 줄이기에서 괜찮은가
  5. 유닛 얼굴·체력바·위험 칸을 오래 가리지 않는가(여러 유닛을 동시에 하얗게 만들지 않는다)
  6. 25칸 밀집 일반 공격이 더 화려해지지 않았는가
  7. 색이 컨셉 색으로 읽히는가(비교 도구의 색 전환으로 은빛 v1과 비교)
- 빌드된 게임 확인: 밸런스 랩 모션 스튜디오에서 시전해 콘솔 오류를 본다.

## 7. 마무리

```bash
node defense/scripts/build.mjs
```
```bash
node defense/scripts/build.mjs --preview
```
```bash
node defense/scripts/build.mjs --unlocked
```
```bash
node --test defense/tests/*.test.mjs
```

- `dist-test`(미리보기)는 커밋하고, `--unlocked`는 로컬에만 둔다.
- 기획서 변경 블록, 이 문서, 에셋 출처 README를 고치고 PR을 준비 상태로 연다.
