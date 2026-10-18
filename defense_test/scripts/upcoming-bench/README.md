# 추가 예정 동료 밸런스 벤치 (버리는 코드)

`defense_test/docs/UPCOMING_BALANCE.md`(pass 9 브랜치)의 측정을 만든 도구와 설정, 결과입니다. 이 브랜치(`claude/upcoming-dummy-bench`)의 엔진에는 **더미 동료 일곱 명**(조커, 언더독, 토피애플, 앤트로피, 애쉬, 큐어마스터, 베놈)과 `UPCOMING` 조정표가 들어 있습니다. 실제 에셋이 없는 임시 구현이므로 메인에 합치지 않습니다. 정식 구현 때는 이 브랜치의 `src/combat/engine.js`, `src/smart-auto.js`, `tests/upcoming-dummy.test.mjs`를 참고만 합니다.

## 준비

- 저장소 루트에서 `npm ci`(엔진 자체는 외부 패키지를 쓰지 않습니다). Node 20 이상.
- 모든 스크립트는 `node --import ./preload.mjs <스크립트>`로 실행합니다. `preload.mjs`가 `UP_SET` 환경 변수로 받은 수치를 엔진에 덮어씁니다.

```
UP_SET='{"hero":{"joker":{"damage":22,"skill.cost":50}},"upcoming":{"joker":{"fixed":"red"}}}'
```

- `hero.<id>.<경로>`는 동료 시트(`damage`, `interval`, `skill.cost` …), `upcoming.<id>.<키>`는 `UPCOMING` 조정표입니다.
- 병렬 도구(`psweep.mjs`, `pult.mjs`, `pdecks.mjs`)는 설정 파일의 한 항목마다 자식 프로세스를 하나 띄웁니다. 항목의 `label`에 `|`를 쓰지 마세요(결과 표 파싱이 어긋납니다).

## 도구

| 파일 | 하는 일 | 예 |
|---|---|---|
| `contrib.mjs` | 기여도 지수(노멀 6명 평균 = 1.0). 시나리오 4개 × 성급 × 무작위 팀 | `node --import ./preload.mjs contrib.mjs --heroes ash --ranks 1,3,5 --teams 10` |
| `psweep.mjs` | 위 도구를 설정 파일 항목마다 병렬로 | `node psweep.mjs configs/ash-contrib.json --jobs 8` |
| `ultroll.mjs` | 필살기 가치. 실제 스테이지 도중 상태를 저장해 쏜 경우/안 쏜 경우를 굴림 | `UP_DECKS="ash,star_boy,snow_rabbit,night_rabbit,siren" node --import ./preload.mjs ultroll.mjs --heroes ash` |
| `pult.mjs` | 위 도구를 설정 파일 항목마다 병렬로 | `node pult.mjs configs/final-ult.json --jobs 8` |
| `play.mjs` | 스테이지 한 판(스마트 오토) 공용 함수와 추적(행동불능, 폭탄 폭발, 시전 횟수) | 다른 스크립트가 가져다 씀 |
| `compare-decks.mjs` | 덱 여럿의 스테이지 승률 표 | `node --import ./preload.mjs compare-decks.mjs --decks "a,b,c,d,e;f,g,h,i,j" --stages 3,9,15 --seeds 10` |
| `pdecks.mjs` | 위 도구를 설정 파일 항목마다 병렬로. 승률순 정렬 | `node pdecks.mjs configs/fifth.json --jobs 12 --out fifth.out.json` |
| `bombs.mjs` | 토피애플 폭탄 폭발 통계(생존 적, 위치, 피해). 강제 시전 정책 | `node --import ./preload.mjs bombs.mjs --policy eager --seeds 8` |
| `gauge.mjs` | 후보가 전투 중 벌어들이는 별빛(경제 점검) | `node --import ./preload.mjs gauge.mjs --heroes joker,silver_rabbit` |
| `joker-study.mjs` | 조커 색별·순서별 기여도 | `node joker-study.mjs --set '{"hero":{"joker":{"damage":22}}}'` |
| `perf.mjs` | 독·화상이 많은 팀의 한 스텝 시간 | `node --import ./preload.mjs perf.mjs --seconds 60 --runs 5` |
| `make-ultroll.cjs` | `../ult-rollout.mjs`에서 `ultroll.mjs`를 다시 만듦(덱을 `UP_DECKS`로 받도록 고침) | `node make-ultroll.cjs` |
| `mk*.cjs` | 설정 파일 생성기(문서의 각 표를 만든 변형 목록) | `node mkash3.cjs` |

보호 연구는 `UP_NODODGE=1`을 환경에 두면 오토가 보스 패턴을 피하지 않습니다(설정 항목의 `env`로 넘김).

## 설정과 결과

- `configs/`: 입력 설정. `mkXXX.cjs`가 만든 것과 같습니다.
- `results/`: 출력. `*.out.json`은 도구가 쓴 결과, `*.txt`는 콘솔 표입니다.

| 문서 표 | 설정 | 결과 |
|---|---|---|
| 3장 초안 상태 | `draft-contrib.json`, `ult1.json` | `draft-contrib.out.json`, `ult1.out.json` |
| 4.1 조커 | `joker-sweep1.json`, `joker-check.json` | `joker-sweep1.out.json`, `joker-check.out.json` |
| 4.2 언더독 | `ud-sweep*.json`, `ud-search4.json`, `ud5-*.json`, `ud6.json` | 같은 이름의 `.out.json` |
| 4.3 토피애플 | `toffee*-contrib.json`, `toffee*-ult.json` | 같은 이름의 `.out.json`, `bombs-*.txt` |
| 4.4 앤트로피 | `ant-decks.json` | `ant-decks.out.json` |
| 4.5 애쉬 | `ash-contrib.json`, `ash-ult.json`, `ash-decks.json`, `ash-decks2.json` | 같은 이름의 `.out.json` |
| 4.6 큐어마스터 | `cure-contrib.json`, `cure-study.json`, `cure2.json`, `cure3.json`(스테이지 1~9, 너무 쉬움), `cure3b.json`(10~18) | 같은 이름의 `.out.json` |
| 4.7 베놈 | `venom-ch*.txt`(콘솔 표), `perf.mjs` | `results/venom-ch*.txt` |
| 6장 5번째 칸 | `fifth.json`, `ladder.json` | `fifth.out.json`, `ladder.out.json` |
| 제안 수치 전체 | `final-set.json`, `final-contrib.json`, `final-ult.json` | `final-contrib.out.json`, `final-ult.out.json` |

`final-set.json`이 문서의 "제안" 열과 같은 수치를 `UP_SET` 형식으로 담고 있습니다.

## 알아 둘 것

- 수치 해석에 필요한 주의는 문서 2.3과 5.6에 있습니다. 특히 기여도 지수는 ±0.1 흔들리고, 애쉬처럼 아군을 소모하는 필살기는 기여도에서 약하게 나옵니다.
- 측정은 CPU를 많이 씁니다. 병렬 12개 기준으로 스테이지 판 52개(20판 × 5스테이지)에 20분 안팎 걸렸습니다. 성능 측정(`perf.mjs`)은 다른 작업을 끄고 돌립니다.
- Windows에서 절대 경로를 `--import`에 넘길 때는 `file://` URL이어야 합니다(`pdecks.mjs`가 처리).
