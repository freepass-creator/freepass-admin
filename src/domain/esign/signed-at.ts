/**
 * 전자서명 시각 — 봉인 문서에 찍히는 글자이므로 Node/ICU 버전에 맡기지 않는다.
 * (Node 22 ICU 78.2 는 "PM 2:30", Node 24 ICU 78.3 은 "오후 2:30" 을 낸다.)
 * Node 24 운영 출력과 같은 모양으로 KST(UTC+9, 서머타임 없음)를 직접 만든다.
 */
export function formatKstSignedAt(epochMs: number) {
  const kst = new Date(Number(epochMs) + 9 * 60 * 60 * 1000);
  const hour = kst.getUTCHours();
  const ampm = hour < 12 ? '오전' : '오후';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return kst.getUTCFullYear() + '. ' + (kst.getUTCMonth() + 1) + '. ' + kst.getUTCDate() + '. '
    + ampm + ' ' + h12 + ':' + String(kst.getUTCMinutes()).padStart(2, '0');
}
