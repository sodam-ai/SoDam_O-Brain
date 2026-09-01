---
description: O-Brain에 기억이 잘 쌓였는지 상태를 한국어로 보여줍니다
---

사용자가 O-Brain 상태를 확인하려고 합니다. 아래 명령을 실행하고, 그 출력을 **비개발자도 이해할 쉬운 한국어**로 정리해 보여주세요(총 기억 수, 최근 기억, 훅이 작동했는지).

```
node --env-file-if-exists="${CLAUDE_PLUGIN_ROOT}/../app/.env.local" "${CLAUDE_PLUGIN_ROOT}/../app/src/status.mjs"
```

기억이 0건이거나 훅이 아직 안 울렸으면, "대화하고 세션을 종료하면 자동으로 쌓인다"고 안내하세요.
