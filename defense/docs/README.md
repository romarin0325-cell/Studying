# 루미의 별빛 원정 유지보수 시작점

현재 활성 Defense는 PR #546의 합성 디펜스를 확장한 30인·6명 편성·5×5 보드의 게임이다. 실행 코드는 `defense/merge/`에 있고, 진행·기능 의도·현재 수치·전체 능력은 [doc 문서 시작점](../doc/README.md)에서 읽는다. PR #546 직전의 STARWARD/V2 구현과 문서는 `defense_legacy/`에 보존되어 있다. 레거시 규칙이나 테스트를 현재 게임의 계약으로 사용하지 않는다.

| 영역 | 현재 파일 |
| --- | --- |
| 콘텐츠·영웅·유물·출시 에셋 | `merge/content.js` |
| 결정론적 전투·합성·축복·장판·저장 직렬화 | `merge/engine.js` |
| UI와 저장·입력·화면 전환 | `merge/main.js` |
| 캔버스와 전장 | `merge/render.js` |
| 동료별 투사체·명중·상태 효과 | `merge/effects.js` |
| 소리 | `merge/audio.js` |
| 화면 스타일 | `merge/style.css` |
| 이미지 추정 기준점 | `docs/art/ANATOMICAL_LANDMARKS.json` |
| 단일 파일 생성 | `scripts/build_defense_local.mjs` |

## 먼저 읽을 문서

- [현재 소스 구조와 수정 위치](../doc/SOURCE_DESIGN.md)
- [현재 역할·유물·축복·웨이브·보스 밸런스](../doc/BALANCE.md)
- [동료·변신·보스 능력과 컨셉](../doc/CHARACTERS.md)
- [첫 출시 역할 설계 배경](../doc/BALANCE_DESIGN.md)
- [추가 에셋·생성 프롬프트](../doc/ART_ASSETS.md)
- [PR #546 당시 기획 기록](CONFLUENCE_DESIGN.md)
- [현재 아트·모션 제작 지침](CONFLUENCE_ART_PLAYBOOK.md)
- [두개부 크기 교정 절차](art/HEAD_CONSISTENCY_RESEARCH.md)
- [현재 실행·검증 안내](../README.md)

## 실행과 검증

저장소 루트에서 실행한다.

```powershell
npm run serve:defense
npm run build:defense-local
npm run verify
npm run verify -- --only defense
```

개발 서버는 `http://127.0.0.1:4174/`에서 `defense/index.html`을 연다. 오프라인 배포본은 `defense/dist-local/HeroCoreDefense.html`이며 직접 수정하지 않는다. 루트 검증은 Defense를 자동 실행하지 않고, 전용 `--only defense` 계획이 현재 게임에 필요한 가까운 검사만 선택한다.

## 현재 디렉터리 경계

```text
defense/
├─ assets/merge/          21명 방향도, 정원, 유물·축복·효과 아틀라스
├─ assets/moonlit/        현재 게임이 재사용하는 적·보스 아틀라스 2개
├─ dist-local/            생성된 단일 HTML 배포본
├─ doc/                   현재 소스·밸런스 설계와 추가 에셋 기록
├─ docs/                  기존 Confluence 기획·캐릭터 아트·검수 기록
├─ merge/                 현재 런타임 전체
├─ tests/                 Confluence 전용 unit/integration 테스트
├─ index.html             HTTP 개발 진입점
└─ README.md              실행 방법과 프로젝트 요약

defense_legacy/           PR #546 직전 Defense의 보존 스냅샷
```

`defense_legacy/`는 과거 구현 확인용이다. 새 기능, 수정, 빌드 입력, 검증 추가는 `defense/`를 대상으로 한다.
