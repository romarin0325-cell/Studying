# 필살기 연출 3차 에셋 (2026-11-06)

신데렐라·베놈·둠·루미(꿈의 형태 포함)·레드드래곤·아우로라·별똥별소년 필살기에 쓰는 공용 키트 3. 연출 코드는 `src/combat/ur-vfx.js`(`KIT3`, 3차 구역), 만드는 절차는 [VFX_SEQUENCE_GUIDE.md](../../VFX_SEQUENCE_GUIDE.md).

| 아틀라스 | 크기 | 원본 → 배포본 | 내용 | 합성 |
|---|---|---|---|---|
| `assets/merge/ur-kit3.webp` | 1024×1024 (256칸 4×4, 14칸 사용) | 237KB → 183KB | 빛 10칸: 나비, 불꽃, 불 숨결, 별똥별, 손거울, 유리 균열, 해, 초승달, 별, 종(흰색, 알파 = 밝기). 물체 4칸: 피안화, 봉투, 단검, 뿌리(회색 음영, 생성기의 투명 배경 알파) | 실행 중 색 지도(`RAMPS`)로 색을 입힌다 |

## 생성

- 도구: GPT 이미지(Codex CLI 내장 image_gen, `codex exec -i <참조>`, 추론 노력 low). 모델 버전 문자열은 도구가 알려 주지 않는다.
- 시트 세 종류, 각각 후보 3장(a·b·c):
  - `kitL3`(빛 6칸, 3×2, 검은 바탕): 참조 1은 1차 키트의 스타일 판(`../ur-vfx-20261106/kit-style-ref.png`), 참조 2는 `motif-light3.webp`(베놈 피안화 엠블럼, 레드드래곤 숨결, 별똥별소년 유성, 아우로라 거울).
  - `kitD3`(빛 4칸, 2×2, 검은 바탕): 참조 2는 `motif-dream3.webp`(루미와 신데렐라 엠블럼).
  - `kitO3`(물체 4칸, 2×2, 투명 배경, 흑백 음영): 참조는 `motif-object3.webp`(베놈 엠블럼, 둠 단검). 세 장 모두 실제 알파 채널이고 색이 섞인 픽셀은 0개였다.
- 프롬프트: `kitL3.prompt.txt`, `kitD3.prompt.txt`, `kitO3.prompt.txt`. 후보 원본은 픽셀이 같은 무손실 WebP로 보관했다(`gpt-kit*3-?.webp`).

## 칸 선택과 패킹

`node defense/scripts/art/pack-pick-sheet.mjs defense/docs/art/ur-vfx3-20261106/kit3-pack.json defense/docs/art/ur-vfx3-20261106/kit3-packing.json`

- 모드 `kit`(빛과 물체 혼합). 물체는 `solo`, 땅에 서는 조각(불꽃, 피안화)은 `anchor: bottom`(바닥선은 칸 높이의 0.949, `KIT_FLOOR`).
- 선택:
  - 나비 b(날개 결이 또렷함), 불꽃 a(세 갈래 끝과 불씨), 숨결 b(밝은 심과 말리는 머리), 별똥별 b, 손거울 b, 균열 b(부서진 동심원 둘).
  - 해 b(큰 원반과 길고 짧은 빛살), 초승달 b(무늬와 별), 별 b, 종 b(장식과 소리 곡선).
  - 피안화 a(긴 꽃술이 고르게 퍼짐), 봉투 c(왕관 봉인이 가장 또렷함), 단검 a, 뿌리 a.
- 별똥별 조각의 머리는 칸 중심에서 (+0.40, +0.36), 꼬리 방향은 약 43도다(`starBoy`).
- 배포본은 `node defense/scripts/art/add-optimized.mjs`로 새 항목만 추가했다(기존 압축본은 다시 압축하지 않는다).

## 확인

- 어두운 바탕과 밝은 바탕에서 칸 경계, 잘림, 잡티를 봤다. 경계 경고는 없었다.
- `docs/review/ur-vfx-20261106/index.html`(3차 묶음)과 `scripts/review-sheet.mjs`(20개 필살기 한 장 비교)로 실제 렌더러에서 검수했다.
- 확인하지 못한 것: 실제 휴대폰 화면·FPS, 소리.
