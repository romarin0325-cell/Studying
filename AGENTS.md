# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Verification policy
검증은 이번 작업에서 바뀐 동작과 직접 관계있는 범위만 수행한다.
- 일반 문서는 제품 검증이 필요 없다.
- 배포 입력을 수정하면 해당 게임을 한 번 빌드한다.
- 동작 확인이 필요하면 가장 가까운 기존 테스트나 짧은 재현을 사용한다.
- 변경하지 않은 게임, 전체 회귀, 여러 브라우저, 장시간 시뮬레이션, 보고서 재생성은 기본 실행하지 않는다.
- 같은 입력에 대한 검증을 반복하지 않는다.
- 실행한 검사와 확인하지 못한 핵심 사항만 간단히 알린다.

## Targets
- `card/`: Card game (`card/dist/DREAMWEAVER.html`)
- `shooter/`: Astral Bloom shooter (`shooter/dist/AstralBloom.html`)
- `idle/`: Astral Companions idle game (`idle/dist/AstralCompanions.html`)
- `defense_test/`: Star Garden defense prototype (`defense_test/dist/StarGardenDefense.html`)
- `survivor/`: Astra Nocturne survivor game (`survivor/dist/AstraNocturne.html`)
- `defense/`: Hero Core Defense (`defense/dist-local/HeroCoreDefense.html`)

`card_legacy/` and `defense_legacy/` are preserved snapshots; do not use them as active sources.

## Core guidelines
- Prefer the smallest diff that restores working behavior.
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.
