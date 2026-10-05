# Minimal PR verification

The default verifier proves the behavior changed by a pull request without expanding to untouched games, unnecessary reports, or full regression suites.

## Core policy

1. 변경하지 않았고 실제 배포 의존성도 없는 게임은 검증하지 않는다.
2. 일반 문서와 개발 안내문만 수정하면 제품 테스트·게임 빌드·브라우저 실행을 하지 않는다.
3. 배포 입력을 수정하면 해당 게임의 배포 파일만 한 번 빌드한다.
4. 빌드가 이미 파싱한 파일에 별도 문법 검사를 반복하지 않는다.
5. 기능 확인이 필요하면 바뀐 동작에 직접 대응하는 기존 테스트 또는 짧은 재현만 선택한다.
6. 폴더가 변경됐다는 이유만으로 회귀 테스트 묶음을 추가하지 않는다.
7. 매핑 부재나 dist 단독 변경을 작업 차단 사유로 취급하지 않는다.
8. 요청한 결과를 판단할 만큼 확인했다면 작업을 끝낸다.

## Default selection matrix

| 변경 종류 | 기본 자동 실행 | 직접 필요할 때만 추가 |
| --- | --- | --- |
| 일반 문서·AGENTS 안내문 | 제품 검사 0개 | 없음 |
| CSS·단순 표시 문구 | 해당 게임 빌드 1회 | 변경 화면 확인 |
| 이미지 교체 | 해당 게임 빌드 1회 | 해당 이미지 표시 확인 |
| 수치·콘텐츠 데이터 | 해당 게임 빌드 1회 | 바뀐 계산이나 동작 확인 |
| 전투·자동 모드 로직 | 해당 게임 빌드 1회 | 해당 동작의 기존 테스트 또는 재현 |
| 저장·복원 로직 | 해당 게임 빌드 1회 | 변경한 저장·복원 경로 확인 |
| 가벼운 단위 테스트 파일만 수정 | 수정한 테스트 | 제품 빌드 없음 |
| 분석 보고서 JSON | 제품 검사 0개 | 분석 요청 시 생성 |
| 선택기 실행 코드 | 기존 선택기 테스트 | 실제 게임 실행 없음 |

## Scope & CI

- CI triggers on pull requests with a single unified job (`Defense release gate`) running the minimal selector.
- Untouched games and documentation-only pull requests finish cleanly without runtime tests, builds, or browser runs.
- Browser tests are focused scenarios reserved for explicit UI/flow changes or explicit compatibility requests.
