// Host 헤더 허용목록 — DNS 리바인딩 방어(PRD 08 §2: 타 프로세스·외부의 무단 호출 차단).
// 서버는 127.0.0.1에만 열려 있지만, 악성 웹페이지가 자기 도메인을 127.0.0.1로 되돌리는 'DNS 리바인딩'을 쓰면
// 브라우저는 이 서버를 같은 출처로 보고 Origin 없이 GET을 보낸다(그때 Host는 공격자 도메인). 토큰이 박힌 '/'를 읽히지 않도록
// 허용한 이름·포트가 아닌 Host는 거부한다.
export function isAllowedHost(hostHeader, port) {
  if (typeof hostHeader !== 'string') return false; // 없음(HTTP/1.0)·비정상 값
  const h = hostHeader.trim().toLowerCase();
  if (h === `127.0.0.1:${port}` || h === `localhost:${port}`) return true;
  return Number(port) === 80 && (h === '127.0.0.1' || h === 'localhost'); // 브라우저는 80번 포트를 Host에서 생략
}
