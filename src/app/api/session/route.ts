import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from '../../../server/auth';
import { SESSION_MS, identityReady, resolveSession, revokeSessions, sessionCookieFrom } from '../../../server/identity';

/**
 * 로그인 마무리 — 공용 로그인 화면이 Firebase 로 사람을 확인한 «뒤» 그 ID 토큰을 여기로 보낸다.
 * ★브라우저에서만 본 것은 검증이 아니다(계약 §2). 여기서 서버가 다시 보고, 권한까지 풀고 나서야 쿠키를 준다.
 * ★쿠키는 Firebase 가 만든다 — 우리가 토큰을 만들지 않는다.
 * 실패 까닭은 «승인 대기»만 가른다. 그 밖은 뭉뚱그린다.
 */
export async function POST(req: NextRequest) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: '로그인이 끊겼습니다 — 다시 해 주세요' }, { status: 400 });
  }

  if (!identityReady()) {
    console.error('[admin-session] IDENTITY_NOT_CONFIGURED');
    return NextResponse.json({ error: 'IDENTITY_NOT_CONFIGURED' }, { status: 503 });
  }

  let cookie: string;
  try {
    cookie = await sessionCookieFrom(idToken);
  } catch {
    return NextResponse.json({ error: '로그인이 끊겼습니다 — 다시 해 주세요' }, { status: 401 });
  }

  /* ★쿠키를 내주기 «전에» 권한을 푼다 — 승인 안 된 사람에게 들어온 표를 쥐여 주지 않는다 */
  const resolved = await resolveSession(cookie);
  if ('denied' in resolved) {
    await revokeSessions(cookie).catch(() => {});
    /* ★메일 인증과 승인은 다른 사건이다. 합쳐서 말하면 메일만 누르면 될 사람이
       오지 않을 승인을 기다리며 영영 막힌다. */
    return NextResponse.json({ error: resolved.denied }, { status: 403 });
  }
  const who = resolved.who;

  const res = NextResponse.json({ ok: true, name: who.name });
  res.cookies.set(AUTH_COOKIE, cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    maxAge: Math.floor(SESSION_MS / 1000),
  });
  return res;
}

/** 로그아웃 — Firebase 쪽 세션까지 끊는다(다른 기기 포함) */
export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie) await revokeSessions(cookie).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: AUTH_COOKIE, path: '/' });
  return res;
}
