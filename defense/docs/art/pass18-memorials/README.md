# 18차 메모리얼 원본 보존

베놈·앤트로피·토피애플·해바라기·언더독·베히모스·조커·큐어마스터의 이전 AVIF·WebP 16개는 PR 기준 커밋 `fce92ff62514a8c9559f64a8e897298435fcbdd2`와 같은 바이트로 기존 경로에 복원했다. 경로와 해시는 [manifest.json](manifest.json)에 고정했다. 이전 PNG 원본은 이 저장소에 없었으므로 복원했다고 주장하지 않는다.

새 그림의 PNG 8개는 `assets/memorial-sources/<id>/<source SHA-256>.png`에 가공 전 바이트 그대로 보관한다. `src/memorial-media.js`의 `sourcePath`, 원본 크기·해상도·해시, 실제 인코더 버전으로 연결한다. 이 PNG들을 다시 인코딩한 AVIF·WebP 16개가 수정 전 PR 카탈로그의 해시와 전부 일치함을 확인했다.

현재 사용하는 AVIF·WebP는 각각 `assets/memorial/replacements/<id>/<output SHA-256>.avif`, `assets/memorial-webp/replacements/<id>/<output SHA-256>.webp`에 있다. 배포 압축본은 대응하는 `assets/optimized/` 경로에 분리했다. 기존 압축본에서 재압축하지 않았으며, 앨범 썸네일의 원본 연결과 `docs/ASSET_OPTIMIZATION.json`, `docs/ASSET_PROVENANCE.json`도 현재 그림을 가리킨다.

`replace-memorials.mjs <png dir> <id>=<file.png> ...`는 전체 배치의 입력과 경로 충돌을 검사한 뒤 원본·인코딩을 배타적 생성(`wx`)으로 보관한다. 같은 경로에 같은 바이트가 있으면 재사용하고, 다른 바이트가 있으면 실패한다. 새 버전으로 교체해도 이전 파일을 덮어쓰거나 삭제하지 않는다. 마지막에 선택한 카탈로그 레코드만 바꾸며 이야기 본문과 `bodySha256`는 유지한다.

인코딩을 다시 재현하려면 잠긴 의존성을 설치한 뒤 카탈로그의 `sourcePath` PNG들을 임시 입력 폴더에 각각 `sourceFilename`으로 복사하고 다음과 같이 실행한다. 임시 루트의 `src/memorial-media.js`는 현재 파일의 복사본이다. 이렇게 하면 재현 결과를 임시 폴더에 만들고 설치된 파일은 그대로 둘 수 있다.

```js
import {replaceMemorials} from '../../../scripts/art/replace-memorials.mjs';
import {MEMORIAL_MEDIA_MANIFEST} from '../../../src/memorial-media.js';

const pairs = Object.entries(MEMORIAL_MEDIA_MANIFEST)
  .filter(([, media]) => media.sourcePath)
  .map(([id, media]) => `${id}=${media.sourceFilename}`);
await replaceMemorials(inputDirectory, pairs, {root: temporaryRoot});
```

`node --test defense/tests/replace-memorials.test.mjs`는 이전 보관본·새 PNG·현재 인코딩의 해시, 반복 실행, 다음 버전 설치 후 이전 버전 보존, 잘못된 배치와 경로 충돌 시 중단을 검사한다.
