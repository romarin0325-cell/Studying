# 루미의 별빛 원정 캐릭터·이펙트 방향

이 문서는 PR #546에서 도입한 현재 Defense의 아트 계약만 설명한다. PR #546 직전의 2.5–3등신 idle/attack 아틀라스, 12×16 전장, STARWARD/V2 제작 지침은 `defense_legacy/`에 보존되어 있으며 현재 게임의 기준이 아니다.

## 현재 캐릭터 계약

- 27명과 트라우마 변신형 모두 약 2등신의 compact SD 게임 피스다.
- 각 영웅은 정면, 후면, 좌측, 우측의 네 방향을 별도로 그린다. 네 이미지는 연속 공격 애니메이션이 아니라 동일한 중립 대기 자세의 방향도다.
- 런타임은 적 방향에 맞는 이미지를 선택하고 짧은 anticipation/recoil을 절차적으로 적용한다. 투사체, 이동 궤적, 충돌 이펙트와 사운드가 공격 타이밍을 전달한다.
- 얼굴, 성별, 헤어, 의상, 액세서리와 손잡이는 원본 사이에서 바뀌지 않는다. 좌우 이미지를 새로 그린 방향이라고 주장하며 단순 반전해서는 안 된다.
- 해부학적 머리 크기는 얼굴과 두개부로 비교한다. 귀, 모자, 뿔, 헤일로, 머리카락 부피와 무기는 측정에서 제외한다.
- 캐릭터별 네 방향에는 하나의 배율과 발 기준선을 사용한다. 키 분류는 메타데이터로 보존하되 이번 릴리스에서 전신 확대·축소로 강제하지 않는다. 승인 후 사용자 요청으로 신데렐라만 머리 목표 0.95배의 예외를 두었다. 다른 20명은 바꾸지 않는다.
- 흰 머리, 흰 의상과 하이라이트는 불투명 재료다. 흰색/휘도 제거를 사용하지 않는다. 실제 알파가 없으면 새 이미지를 요청하거나 지정된 마젠타 키 오프라인 가져오기를 사용한다.

세부 제작 절차와 현재 예외는 [Confluence 아트 플레이북](docs/CONFLUENCE_ART_PLAYBOOK.md)을 따른다. 머리 측정 근거와 캐릭터별 좌표는 [교정 조사](docs/art/HEAD_CONSISTENCY_RESEARCH.md), [단일 프로필](docs/art/HEAD_PROFILE.json), [해부 기준점](docs/art/ANATOMICAL_LANDMARKS.json)에 기록되어 있다.

## 아틀라스 계약

`assets/merge/units/`에는 캐릭터별 1024×1024 WebP 아틀라스가 있다. 각 512×512 셀의 순서는 정면, 후면, 좌측, 우측이며 공통 발 앵커는 `(256,480)`이다. `manifest.json`은 원본·출력 SHA-256, 네 발 기준점, 정면 얼굴 중심, 파생 배율과 분할 정보를 기록한다. 초상화 crop 메타데이터는 `merge/art-frames.js`에 있다.

현재 배포 에셋은 다음 39개다.

- 영웅 방향 아틀라스 27개 + 트라우마 1개
- 정원 배경 `assets/merge/garden.webp`
- 적 아틀라스 `assets/moonlit/creatures.webp`
- 보스 아틀라스 `assets/moonlit/realm-bosses.webp`
- 유물 20종 `assets/merge/relics.webp` (5×4, 실제 알파)
- 축복 6종 `assets/merge/blessings.webp` (3×2, 실제 알파)
- SD 타격 효과 21종 `assets/merge/effects.webp` (7×3, 검정 배경 screen 합성)

- 신규 보스 3종 `assets/merge/bosses-expansion.webp` (3×1)
- 신규 공격/지원/보스 효과 `assets/merge/effects-expansion.webp` (4×3)
- 단일 표적 필살기와 변신 효과 `assets/merge/finishers.webp` (4×3)
- 신규 유물 4종 `assets/merge/relics-expansion.webp` (2×2)
- 신규 지역 3곳 `assets/merge/realms-expansion.webp` (3×1)

신규 제작·검수 절차는 [확장 아트 기록](docs/art/expansion/README.md)을 따른다. 체리프린스와 별똥별소년의 필살기는 전장 문양을 사용하지 않고 한 표적의 준비·비행·명중을 표시한다.

배포본은 이 파일들을 단일 HTML에 포함한다. 게임 실행 중 이미지 처리, 픽셀 판독 또는 생성 작업을 하지 않는다.

추가 에셋의 선택·프롬프트·해시는 [에셋 기록](doc/ART_ASSETS.md)에 있다. 기존 효과는 `merge/effects.js`의 21개 고유 motion/frame을 유지한다. 신규 6명은 별도 4×3 비트맵 시트를 사용한다. 참격·단검·도약·용염·발톱·혜성은 목표 방향으로 회전하며 원본 기울기를 offset으로 보정한다. 투사체는 짧고, 명중은 0.3초, 스킬 명중은 0.65초로 끝내고 전장 문양은 1.6초 유지한다. 지원 스킬 문양은 공격받는 적이 아닌 강화받는 동료에 표시한다. 지나친 입자나 사실적인 연기 대신 명확한 2–3색 핵심과 짧은 잔상을 선택한다.

## 모션·전투 가독성

- Idle: 전투를 가리지 않는 아주 작은 호흡 이동만 사용한다.
- Anticipation: 표적 반대쪽으로 90–140ms 움직이고 작은 charge mark를 표시한다.
- Release: 표적 방향으로 복귀하면서 동일한 손/중심 앵커에서 효과를 발사한다.
- Impact: 작은 밝은 중심, 속성 형태와 낮은 밀도의 짧은 파티클을 사용한다.
- Merge: 안쪽으로 모이는 움직임 뒤 바깥쪽 별 파동을 사용한다.
- Skill: 일반 공격과 구분되는 고유 명중 효과와 짧은 사운드, 적 수에 무관한 1.6초 전장 문양/테두리 연출을 사용한다. 기존 21종 SD 효과 아틀라스를 재사용하며 동료·적·위험 예고 밑에 그린다.
- Reduced effects: 화면 흔들림·섬광·선택 파티클만 줄이고 위험 경고와 타이밍은 유지한다.

## 제작·검수

```powershell
node scripts/pack_defense_directions.mjs --source-dir SOURCE_DIRECTORY --landmarks defense/docs/art/ANATOMICAL_LANDMARKS.json --proof-dir PROOF_DIRECTORY
node scripts/export_defense_directions.mjs OUTPUT_DIRECTORY
npm run prepare:defense-art -- --check --force
npm run verify -- --only defense
```

27명과 변신형을 40px와 64px 크기로 밝고 어두운 배경에서 나란히 보고, 25명 전장에서도 얼굴 인식, 머리 배율, 합성 표시, 공격 소유권, 충돌 타이밍과 시각 혼잡을 확인한다. 크기·알파·해시 검사를 통과했다는 사실은 육안 승인이나 실제 휴대전화 성능 인증을 대신하지 않는다.
