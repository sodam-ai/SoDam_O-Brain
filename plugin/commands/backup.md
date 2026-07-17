---
description: O-Brain 기억을 지금 즉시 백업(안전 스냅샷)합니다
---

사용자가 O-Brain 기억을 백업하려고 합니다. 아래 명령을 실행하고, 저장된 백업 파일 위치를 **쉬운 한국어**로 알려주세요.

```
node "${CLAUDE_PLUGIN_ROOT}/../app/src/backup-cli.mjs"
```

백업은 `app/data/backup/` 폴더에 안전 스냅샷으로 저장되며, 최신 7개가 자동 보관됩니다.
