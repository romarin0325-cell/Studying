# 동료 확장 전투 VFX 출처 기록 (2026-11-23)

신규 16명의 일반 공격과 필살기 중심 심벌은 Codex 내장 `imagegen`으로 제작한 투명 래스터 원본이다. 기존 디펜스 게임의 `effects-*.webp`·`ultimates*.webp`와 같은 제작 방식에 맞추고, `CombatFX`의 Canvas 2D 이동·회전·잔상·합성·전투 영수증과 결합한다. SVG는 생성·변환·런타임 어느 단계에도 사용하지 않는다.

## 생성과 패킹

- 입력: `assets/cast-v2/`의 해당 등급 4명 2×2 캐릭터 아틀라스와 먼저 승인한 UR VFX 아틀라스
- 생성물: 등급별 4열×2행 투명 PNG 1장. 위 행은 일반 공격, 아래 행은 필살기다.
- 원본 규격: 1774×887 RGBA PNG, 실제 알파 범위 0–255
- 런타임 규격: 1024×512 WebP, 4열×2행, 셀당 256×256
- 패킹: `scripts/art/build-expansion-vfx-atlases.mjs`가 일반 공격/필살기 사이의 조용한 행을 분리하고 알파 경계를 계산한 뒤 각 셀에 독립 패킹한다.
- 경계 검수: 각 셀 외곽 8px의 `alpha > 12` 픽셀 비율 0%. 인접 프레임 침범 없음.
- 프롬프트 전문: [PROMPTS.md](PROMPTS.md)

| 등급 | 열 순서 | 보존 원본 | SHA-256 |
|---|---|---|---|
| UR | 에인션트소울, 빅토리아, 심해의주인, 사쿠라 | `sources/ur-source.png` | `dfb502ace42ab54c95d478f5a2e3957b26e5657c1f607afd30b067c1d29a9abf` |
| SR | 대일여래, 구미호, 대천사, 실피드 | `sources/sr-source.png` | `dda1f7866d1cbce21c5a477d9243c580b583b0f003ba818bf8b9fccd9e91eca1` |
| R | 서큐버스, 스컬드래곤, 매드사이언티스트, 수정의무희 | `sources/r-source.png` | `fdcbbc37722c6a14b5ef968e2b52dfc05f8ca8b657ee3a0b93353e855717544d` |
| C | 블레싱테일, 마시멜로, 미믹, 침묵의사서 | `sources/c-source.png` | `c7b8730ebdd76dd05476959e283fc478c60bf683c80f8d46d4c26a6311a9b096` |

## 런타임 자산

| 경로 | SHA-256 |
|---|---|
| `assets/merge/effects-card-expansion-ur.webp` | `b0441124438ffab3ff85b78277ae88bdb96b36e6e4cee76721a9e50b5046471f` |
| `assets/merge/effects-card-expansion-sr.webp` | `54717f2452b61e55c9a5ec67296da763d9b9b844ad37441019535ed860af8f98` |
| `assets/merge/effects-card-expansion-r.webp` | `c13063233f89421a552fc64c380c0413612e4ed199345ee4142c9f7d4b0b34d0` |
| `assets/merge/effects-card-expansion-c.webp` | `52cca072bb891590fd2bafc46992860d2cb7065dbb970e9e2a88592d5d8ecd6e` |

`assets/optimized/merge/`에는 공식 이미지 최적화 파이프라인이 만든 배포용 사본이 있다. 원본 PNG는 재패킹·재검수할 수 있도록 삭제하지 않고 이 디렉터리에 보존한다.

## 시각 검수 기준

- 위 행 16개는 전진 방향과 잔상이 분명한 서로 다른 공격 실루엣이다.
- 아래 행 16개는 캐릭터의 카드 콘셉트와 장비·색을 반영한 서로 다른 필살기 문양이다.
- 64–96px 축소에서도 핵심 코어와 외곽 실루엣이 남는다.
- 야간/밝은 테마 모두 `source-over` 중심 심벌과 Canvas 발광·궤적이 분리되어 과노출되지 않는다.
- 코드 폴백은 로드 실패 시에만 쓰며, 정상 production 경로는 래스터 아틀라스를 우선한다.
