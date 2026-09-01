// 시크릿 필터 — 저장 전 필수.
// ★ AI 추출을 붙일 때(Phase 1a)는 'AI에 전송하기 전'에도 동일 호출해야 함(보안 발견사항).
export function redact(text) {
  if (text == null) return { clean: text, hits: 0 };
  let clean = String(text);
  let hits = 0;
  const sub = (re, rep) => {
    clean = clean.replace(re, (...a) => { hits++; return typeof rep === 'function' ? rep(...a) : rep; });
  };
  sub(/sk-[A-Za-z0-9_\-]{16,}/g, '[REDACTED:api-key]');
  sub(/AKIA[0-9A-Z]{16}/g, '[REDACTED:aws-key]');
  sub(/ghp_[A-Za-z0-9]{20,}/g, '[REDACTED:github-token]');
  sub(/AIza[0-9A-Za-z_\-]{20,}/g, '[REDACTED:google-key]');
  sub(/\bBearer\s+[A-Za-z0-9._\-]{8,}/gi, '[REDACTED:bearer]');
  sub(/-----BEGIN[\s\S]*?-----END[\s\S]*?-----/g, '[REDACTED:private-key]');
  // SNAKE_CASE 변수명(DATABASE_PASSWORD 등)도 잡도록 키워드가 식별자 중간에 있어도 매칭
  // (밑줄은 정규식 \w에 포함돼 \b가 밑줄 앞뒤에서는 안 끊기므로, 키워드 앞뒤에 \b 대신
  // [A-Za-z0-9_]*를 둬서 접두/접미가 있어도 통과시킴).
  sub(/\b([A-Za-z0-9_]*(?:password|passwd|pwd|pass|secret|token|api[_-]?key)[A-Za-z0-9_]*)\s*[:=]\s*\S+/gi, (m, k) => `${k}=[REDACTED]`);
  return { clean, hits };
}
