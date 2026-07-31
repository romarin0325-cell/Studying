# 삼중운명: 꿈의 잔향

모바일 브라우저에서 단일 파일로 실행되는 턴제 로그라이크 RPG 프로토타입입니다.

## 실행

`index.html`을 브라우저에서 직접 열면 됩니다. 네트워크 연결이나 별도 서버가 필요하지 않습니다.

## 소스 구조

- `src/data.js`: 클래스, 스킬, 던전, 장비 데이터
- `src/game.js`: 전투, 성장, 저장, 화면 렌더링
- `src/styles.css`: 모바일 우선 인터페이스
- `src/template.html`: 단일 파일 빌드 템플릿
- `assets/루미.png`, `assets/마왕.png`: 원본 전투 이미지

`node scripts/build_class_roguelike.js`를 실행하면 이미지와 모든 소스를 `index.html` 하나에 내장합니다.
