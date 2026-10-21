// 시크릿 필터 — 저장 전 필수.
// ★ AI 추출을 붙일 때(Phase 1a)는 'AI에 전송하기 전'에도 동일 호출해야 함(보안 발견사항).
//
// 범위와 한계(2026-10-20 M69): "모양이 알려진 시크릿"과 "키워드 뒤에 붙은 값"을 가린다.
// 키워드 없이 적힌 임의의 문자열, 숫자·기호가 없는 영단어 비밀번호, 한글 비밀번호는 못 잡는다 — 완벽 보장은 불가능하다.
// 새 정규식은 접두 리터럴로 시작하거나 길이 상한을 둬서, 대화 20MB를 훑어도 선형 시간을 유지한다
// (2026-10-21: 상한이 없던 kv 규칙과 PEM 규칙이 반복 입력에서 제곱 시간이던 것을 독립 검토에서 재현해 상한을 붙였다).
// 남은 한계: URL 비밀번호에 '/'나 '@'가 들어 있으면 일부만 가려지거나 못 가린다('/'를 허용하면 `host:8080/@scope/pkg` 같은 주소를
// 잘못 지운다), 끝(END)이 없이 잘린 PEM 개인키, 한글 비밀번호.

// 한글 키워드 + 값("비밀번호는 Zx9k…"). "토큰"은 이 프로젝트에서 LLM 토큰 뜻으로 흔해 뺐다(진짜 토큰은 접두 패턴이 잡는다).
// 공백은 {0,20}으로 제한(무제한 \s*를 두 번 이으면 긴 공백 런에서 시간이 제곱으로 늘어난다).
const KO_SECRET = /(비밀번호|비번|패스워드|암호|시크릿\s?키|시크릿|비밀\s?키|인증\s?키|API\s?키)(\s{0,20}(?:[:=：]|은|는|이|가|을|를|도|만|으로|로)?\s{0,20}["'`]?)([A-Za-z0-9!@#$%^&*_+=~.\-]{8,128})/gi;

export function redact(text) {
  if (text == null) return { clean: text, hits: 0 };
  let clean = String(text);
  let hits = 0;
  const sub = (re, rep) => {
    clean = clean.replace(re, (...a) => { hits++; return typeof rep === 'function' ? rep(...a) : rep; });
  };
  // 앞 글자가 영숫자면 키가 아니다 — "task-management-dashboard"·"disk-encryption-configuration" 같은 하이픈 단어가
  // "ta[REDACTED]"로 영구 훼손되던 오탐(2026-10-21 독립 검토에서 재현)을 막는다. 진짜 키는 공백·따옴표·=·: 뒤에 온다.
  sub(/(?<![A-Za-z0-9])sk-[A-Za-z0-9_\-]{16,}/g, '[REDACTED:api-key]');
  sub(/AKIA[0-9A-Z]{16}/g, '[REDACTED:aws-key]');
  sub(/gh[pousr]_[A-Za-z0-9]{20,}/g, '[REDACTED:github-token]'); // ghp_(개인) gho_(OAuth) ghu_ ghs_ ghr_
  sub(/github_pat_[A-Za-z0-9_]{20,}/g, '[REDACTED:github-token]');
  sub(/AIza[0-9A-Za-z_\-]{20,}/g, '[REDACTED:google-key]');
  // 접두 리터럴이 뚜렷한 토큰(2026-10-21 추가) — 앞 글자가 영숫자면 다른 단어의 일부라서 건너뛴다.
  sub(/(?<![A-Za-z0-9])npm_[A-Za-z0-9]{30,}/g, '[REDACTED:npm-token]');
  sub(/(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}/g, '[REDACTED:hf-token]');
  sub(/(?<![A-Za-z0-9])glpat-[A-Za-z0-9_\-]{20,}/g, '[REDACTED:gitlab-token]');
  sub(/(?<![A-Za-z0-9])SG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}/g, '[REDACTED:sendgrid-key]');
  // Slack 토큰은 접두 뒤가 항상 숫자(팀 ID)로 시작한다 — "xoxo-hugs-and-kisses" 같은 글자를 지우지 않기 위해 숫자를 요구.
  sub(/\b(?:xox[abprs]|xapp)-\d[A-Za-z0-9-]{9,}/g, '[REDACTED:slack-token]');
  sub(/\b(?:[sr]k_(?:live|test)|whsec)_[A-Za-z0-9]{16,}/g, '[REDACTED:stripe-key]');
  // JWT: 머리(eyJ…)는 짧아서 상한을 둔다 — 상한이 없으면 "eyJ"가 반복되는 긴 입력에서 시작점마다 끝까지 훑는다.
  sub(/\beyJ[A-Za-z0-9_-]{5,100}\.eyJ[A-Za-z0-9_-]{5,4096}\.[A-Za-z0-9_-]{0,1024}/g, '[REDACTED:jwt]');
  // URL 속 계정:비밀번호@ — 비밀번호만 가리고 스킴·계정·호스트는 남긴다(어느 DB를 말하는지는 기억에 유용).
  // 비밀번호 문자에서 '['를 빼서, 이미 가려진 글자를 다시 처리해도 깨지지 않는다(멱등).
  // "://"가 없는 텍스트(대부분)에서는 단어 경계마다 시도하는 비용을 아예 건너뛴다.
  if (clean.includes('://')) sub(/\b([a-z][a-z0-9+.\-]{0,19}:\/\/[^\s:@\/'"<>]{0,64}:)[^\s@\/'"<>[\]]{1,128}(?=@)/gi, (m, pre) => `${pre}[REDACTED:url-password]`);
  sub(/\bBearer\s+[A-Za-z0-9._\-]{8,}/gi, '[REDACTED:bearer]');
  // Basic/Token/Digest 인증 헤더 — "Basic configuration" 같은 일반 문장을 지우지 않도록 반드시 "Authorization:" 뒤에서만.
  sub(/\bAuthorization\s{0,5}:\s{0,5}(?:Basic|Token|Digest)\s+[^\s'"]{8,}/gi, 'Authorization: [REDACTED:auth]');
  // 명령줄 옵션 "--password 값" — 값에 숫자·기호가 있을 때만(설명 문장 "--password prompt"를 지우지 않기 위해). "--password=값"은 아래 kv 규칙이 잡는다.
  sub(/(--(?:password|passwd|pwd|secret|token|api[_-]?key))[ \t]+(?!-)(?=[^\s'"]*[0-9!@#$%^&*+=~])[^\s'"]{6,}/gi, (m, flag) => `${flag} [REDACTED]`);
  // 길이 상한(8KB) — 상한이 없으면 END가 없는 "-----BEGIN"이 반복되는 입력에서 시작점마다 끝까지 훑어 제곱 시간이 된다.
  // RSA-4096 개인키가 약 3.3KB, RSA-8192가 약 6.4KB라 실제 키는 상한 안에 들어간다.
  sub(/-----BEGIN[\s\S]{0,8192}?-----END[\s\S]{0,200}?-----/g, '[REDACTED:private-key]');
  // SNAKE_CASE 변수명(DATABASE_PASSWORD 등)도 잡도록 키워드가 식별자 중간에 있어도 매칭
  // (밑줄은 정규식 \w에 포함돼 \b가 밑줄 앞뒤에서는 안 끊기므로, 키워드 앞뒤에 \b 대신
  // [A-Za-z0-9_]*를 둬서 접두/접미가 있어도 통과시킴).
  // [2026-10-21] ① 키 이름 뒤 따옴표 허용 — JSON `{"password": "…"}`가 통째로 새던 미탐 ② 식별자·공백에 상한 — 무제한 `[A-Za-z0-9_]*`/`\s*`는
  // "pass"·"token_"이 길게 반복되는 입력(4만 번 → 2.8~5.7초)에서 시간이 제곱으로 늘었다. 40자를 넘는 식별자의 앞쪽 꼬리는 이 규칙이 못 잡는다(한계).
  sub(/\b([A-Za-z0-9_]{0,40}(?:password|passwd|pwd|pass|secret|token|api[_-]?key)[A-Za-z0-9_]{0,40})(["']?)\s{0,20}[:=]\s{0,20}\S+/gi, (m, k, q) => `${k}${q}=[REDACTED]`);
  // 값은 ASCII 8자 이상 + 숫자·기호 포함일 때만 가린다 — "비밀번호는 bcrypt로 해시", "API 키는 .env.local에 둔다" 같은
  // 설명 문장을 지우지 않기 위해서다(저장 시점에 원문이 사라지면 복구 불가). 날짜(2024-10-20)도 비밀번호가 아니다.
  // 조건을 못 넘기면 원문 그대로 두고 hits도 올리지 않는다(sub()는 무조건 올리므로 직접 처리).
  clean = clean.replace(KO_SECRET, (m, kw, mid, val) => {
    if (!/[0-9!@#$%^&*+=~]/.test(val) || /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(val)) return m;
    hits++;
    return `${kw}${mid}[REDACTED:password]`;
  });
  return { clean, hits };
}
