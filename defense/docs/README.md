# ASTRA Confluence 유지보수 시작점

현재 활성 Defense는 PR #546에서 도입한 21인·6명 편성·5×5 보드의 합성 디펜스다. 실행 코드는 `defense/merge/`에 있고, PR #546 직전의 STARWARD/V2 구현과 문서는 `defense_legacy/`에 보존되어 있다. 레거시 규칙이나 테스트를 현재 게임의 계약으로 사용하지 않는다.

| 영역 | 현재 파일 |
| --- | --- |
| 콘텐츠·영웅·유물·출시 에셋 | `merge/content.js` |
| 결정론적 전투·합성·상점·저장 직렬화 | `merge/engine.js` |
| UI와 저장·입력·화면 전환 | `merge/main.js` |
| 캔버스와 이펙트 | `merge/render.js` |
| 소리 | `merge/audio.js` |
| 화면 스타일 | `merge/style.css` |
| 이미지 추정 기준점 | `docs/art/ANATOMICAL_LANDMARKS.json` |
| 단일 파일 생성 | `scripts/build_defense_local.mjs` |

## 먼저 읽을 문서

- [현재 게임 기획과 시스템](CONFLUENCE_DESIGN.md)
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
├─ assets/merge/          21명 방향 아틀라스와 정원 배경
├─ assets/moonlit/        현재 게임이 재사용하는 적·보스 아틀라스 2개
├─ dist-local/            생성된 단일 HTML 배포본
├─ docs/                  Confluence 전용 기획·아트·검수 자료
├─ merge/                 현재 런타임 전체
├─ tests/                 Confluence 전용 unit/integration 테스트
├─ index.html             HTTP 개발 진입점
└─ README.md              실행 방법과 프로젝트 요약

defense_legacy/           PR #546 직전 Defense의 보존 스냅샷
```

`defense_legacy/`는 과거 구현 확인용이다. 새 기능, 수정, 빌드 입력, 검증 추가는 `defense/`를 대상으로 한다.
