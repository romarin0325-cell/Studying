# Azure Archive (remaster_grok)

Card RPG 리마스터. 코드는 이 폴더에서 관리하고, 배포물은 단일 HTML입니다.
카드 초상화는 git에 넣지 않습니다.

```
npm run serve    # 개발 (초상화는 ../card 에서 로드)
npm run build    # dist/AzureArchive.html
npm run verify
```

배포 시 `AzureArchive.html`을 초상화 PNG가 있는 폴더에 두면 됩니다.
레포 안에서는 `../../card/` 경로를 자동으로 시도합니다.
