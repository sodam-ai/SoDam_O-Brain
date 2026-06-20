---
description: O-Brain 대시보드를 브라우저로 띄웁니다 (서버 자동 시작)
---

사용자가 O-Brain 대시보드 화면을 보려고 합니다. 서버가 켜져 있는지 확인하고(꺼져 있으면 켠 뒤), 기본 브라우저로 대시보드를 엽니다.

아래 PowerShell을 실행하세요:

```
try {
  Invoke-RestMethod "http://127.0.0.1:7740/api/health" -TimeoutSec 3 | Out-Null
} catch {
  Start-Process node -ArgumentList "src/server.mjs" -WorkingDirectory "D:\AI_Dev_Work\2026y\26y_06m_21d_O-Brain\app" -WindowStyle Hidden
  Start-Sleep -Seconds 5
}
Start-Process "http://127.0.0.1:7740/"
```

실행 후 사용자에게 한국어로 이렇게 알려주세요:
"O-Brain 대시보드를 띄웠습니다 — 브라우저 창을 확인하세요 (http://127.0.0.1:7740/). 다음부터는 이 주소를 즐겨찾기에 추가하면 클릭 한 번으로 다시 열 수 있어요."
