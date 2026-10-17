# DREAMWEAVER · Argon Edition (Commercial 2D Mobile RPG UI Remaster)

`card/`의 DREAMWEAVER와 동일한 규칙·데이터·저장 형식을 공유하면서, 모바일 세로 화면(390×844 기준) 전체 플레이 경험과 3종 테마(**드림스카이**, **마법소녀**, **아스트라**)의 미감을 현대 2D 서브컬처 상용 게임(*블루 아카이브*, *스텔라 소라*, *아스트라*) 수준으로 재설계한 빌드입니다.

## 빌드와 검증

```sh
npm ci
node card_claude/build.mjs
node card_claude/tests/smoke.mjs
```

- 산출물: `card_claude/dist/DREAMWEAVER-Claude.html` (약 2.92 MiB 단일 HTML, 외부 CDN 없이 `file://` 독립 실행)
- 폰트: `Noto Sans KR` 가변 서브셋 (`dreamsans-subset.woff2`, 400–900 웨이트)
- 테마 아트 키트:
  - **드림스카이 (`dreamsky`)**: `dreamsky-sanctuary.svg` + `dreamsky-backdrop.svg` 하늘 성소 배경, `dreamsky-mark.svg` 초승달·별 엠블럼, `dreamsky-frame.svg` 장식 프레임, `dreamsky-card.svg` 전용 카드 뒷면
  - **마법소녀 (`strawberry`)**: `magical-sanctuary.webp` + `magical-backdrop.svg` 마법 성소 배경, `magical-mark.svg` 날개 하트·리본 엠블럼, `magical-frame.svg` 크림·로즈 이중 프레임, `card-back-strawberry.webp` 전용 카드 뒷면
  - **아스트라 (`astra`)**: `observatory.webp` 천문대 배경, `astra-mark.svg` 천체 컴퍼스 엠블럼, `astra-frame.svg` 골드·시안 세공 프레임, `astra-card.svg` 전용 카드 뒷면

## 핵심 개선 사항

1. **AI 슬롭 제거 & 3종 테마 정체성 복원**
   - 크로마키 잔상이 남던 AI 생성 로고·배너·배경·`fx.webp`·`Jua` 폰트를 전면 제거하고, 각 테마 고유의 일러스트/벡터 성소 배경·문장(Mark)·장식 프레임·전용 카드 뒷면과 `Noto Sans KR` 타이포그래피를 결합했습니다.
2. **모바일 상단 헤더(`#dw-top`) 클리핑 해결**
   - 로비(`screen-menu`)에서는 브랜드 마크+모드 칩을, 하위 화면에서는 뒤로가기+화면 제목을 배타적으로 표시하여 390px 폭 안에서 우측 도구 버튼이 절대 잘리지 않습니다.
3. **인게임 파티 편성(`#screen-deck`) & 사전 덱 편집(`#modal-bonus-pool-editor`) 4열 고밀도 그리드**
   - 두 화면 모두 4열 카드 그리드와 가로 스크롤 1줄 필터 바를 적용해 390×844 화면에서 **한 번에 8~12장 이상의 카드**를 쾌적하게 비교·선택할 수 있습니다.
   - `선봉`·`중견`·`대장` 역할 배지(좌상단)와 보유 장수 `×2`(우상단)의 위치를 분리해 배지 겹침을 원천 차단했습니다.
4. **도감(`#screen-collection`) 이원화 & 카드 상세(`#modal-card`) 고정 프레임**
   - 매 판 초기화되는 인벤토리에 무의미한 수집률을 표시하던 문제를 고쳐 **`이번 여정`(현재 보유 카드)** 과 **`계정 도감`(보너스·히든·시즌 스페셜·보스 초월 4대 영구 해금 트랙 및 해금 조건)** 으로 명확히 분리했습니다.
   - 카드 상세 모달은 고정 높이 시트(`heightDelta = 0px`)와 상단 헤더 좌우 이동 버튼을 사용해 설명 길이가 다른 카드를 넘겨도 프레임이 흔들리거나 일러스트를 가리지 않습니다.
5. **전투 화면(`#screen-battle`) 여백/로그 균형 & 의미 기반 풀카드 컷인·방향성 이펙트**
   - 무대 높이를 절제하고 전투 로그(`#battle-log`) 영역을 대폭 넓혀 텍스트 가독성을 확보했습니다.
   - 좌측 아군(`from-left`)과 우측 적(`from-right`)의 공격 방향에 맞춘 벡터 참격·마법·치명타·회복 이펙트를 적용했습니다.
   - 단순 30 MP 스킬이 아닌 **자폭·변신·필드/약화 전소모·차징 예고·전마나·치명타/대형 일격·적 위협 패턴**에만 컷인이 발동하며, 캐릭터 얼굴이 잘리지 않도록 **3:5 전체 카드 비율(`background-size: contain`)** 로 연출합니다.
6. **포춘쿠키 알림 점(`.has-dot`) 즉시 해제**
   - 일일 포춘쿠키 사용 및 모달 종료 시 타이틀과 로비의 알림 점이 즉시 사라집니다.
