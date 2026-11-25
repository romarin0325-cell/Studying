# 카드 동료 UR 필살기 에셋 (2026-11-25)

빅토리아(기적의증명)·사쿠라(폭염부) 필살기 시퀀스에 쓰는 공용 키트 4. 연출 코드는 `src/combat/ur-vfx.js`(`KIT4`, 카드 동료 구역), 만드는 절차는 [VFX_SEQUENCE_GUIDE.md](../../VFX_SEQUENCE_GUIDE.md).

왜: 소유자가 시험판에서 두 필살기가 기존 UR보다 지나치게 단조롭다고 했다(판 가운데 문양 하나와 코드 선 몇 개). 빅토리아는 다른 버프 캐릭터 수준으로, 사쿠라는 스킬 개념(가장 밀집한 반경 150 한 곳)에 맞는 단일 공격으로 다시 만들었다.

| 아틀라스 | 크기 | 내용 | 합성 |
|---|---|---|---|
| `assets/merge/ur-kit4.webp` | 1024×512 (256칸 4×2, 6칸 사용) | 빛 4칸: 벚꽃 봉인진, 월계관, 벚꽃 한 송이, 강화 화살표(흰색, 알파 = 밝기). 물체 2칸: 부적, 승리의 깃발(회색 음영, 생성기의 투명 배경 알파) | 실행 중 색 지도(`RAMPS`: sakura, sakuraFire, paper, gold, holy, victory)로 색을 입힌다 |

## 생성

- 도구: GPT 이미지(Codex CLI 내장 image_gen, `codex exec -s read-only -c model_reasoning_effort=low -i <참조>`). 모델 버전 문자열은 도구가 알려 주지 않는다. Codex에는 셸·파일 쓰기를 금지하고 `~/.codex/generated_images/<세션>/`에서 직접 꺼냈다.
- 시트 두 종류, 각각 후보 3장(a·b·c)을 동시에 돌렸다. 빛 시트 a는 다른 후보가 충분해 기다리지 않았다(보관하지 않음).
  - `kitL4`(빛 4칸, 2×2, 검은 바탕): 참조 1은 1차 키트 스타일 판(`style-ref.png`), 참조 2·3은 `motif-sakura.png`·`motif-victoria.png`(정면 SD, 기존 필살기·일반 공격 문양).
  - `kitO4`(물체 2칸, 2×1, 투명 배경, 흑백 음영): 참조는 같은 두 motif.
- 프롬프트: `kitL4.prompt.txt`, `kitO4.prompt.txt`. 후보 원본은 픽셀이 같은 무손실 WebP(`gpt-kit*4-?.webp`).

## 칸 선택과 패킹

`node defense/scripts/art/pack-pick-sheet.mjs defense/docs/art/card-ur-vfx-20261125/kit4-pack.json defense/docs/art/card-ur-vfx-20261125/kit4-packing.json`

- 봉인진 b(두 고리와 부적 띠가 또렷함), 월계관 b(리본 매듭), 벚꽃 c(빛 번짐이 부드러움), 화살표 b(겹 화살촉과 꼬리), 부적 b(테두리 장식과 벚꽃 매듭), 깃발 b(가운데 선 기둥, 받침이 바닥에 닿음 — `anchor: bottom`).
- 배포본은 `node defense/scripts/art/add-optimized.mjs`로 새 항목만 추가했다.

## 확인

- 비교 페이지 `docs/review/card-ur-vfx-20261125/index.html`(왼쪽 지금 시험판, 오른쪽 이번 변경, 컷인 띠는 실제 발동 순간에)에서 빅토리아 발동·5초 차지, 사쿠라 아래쪽 길·위쪽 길을 봤다.
- 확인하지 못한 것: 실제 휴대폰 화면·FPS, 소리.
