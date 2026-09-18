/**
 * **구글 워크스페이스 로그인 — teamjpk.com 사람은 다 들어온다.**
 *
 * ★대표 2026-09-18 「나랑 똑같은 회사 메일이야. 구글 워크스페이스에 있는 사람은 다 들어올 수 있어야지」
 *
 * ── 왜 «구글 로그인» 인가 (이메일 끝만 보면 안 된다)
 *   Firebase 비밀번호 계정은 공개 키로 «아무 주소나» 가입된다 — 남이 `아무개@teamjpk.com` 으로 가입하면
 *   주소 끝만 보는 문은 그 사람을 들인다. 구글 로그인은 구글이 «이 사람은 teamjpk.com 워크스페이스 구성원» 이라고
 *   서명한 신원표(id_token 의 `hd` 칸)를 준다. ★그 표시가 있을 때만 연다.
 *   ⚠ erp4(freepasserp3) Firebase 에는 구글 로그인이 «꺼져 있다»(실측 2026-09-18 — CONFIGURATION_NOT_FOUND).
 *     erp4 설정을 건드리지 않고, 어드민이 구글 OIDC 를 직접 받는다.
 *
 * ── 흐름 (서버만 — 브라우저에 SDK 안 싣는다)
 *   /login/google            → 구글로 보낸다 (hd=teamjpk.com · state · PKCE · 계정 고르기)
 *   /login/google/callback   → 코드 → 신원표 검증(서명·aud·만료) → hd·email_verified·도메인 → 우리 세션 쿠키
 *
 * ── 우리 세션 (구글 쪽)
 *   `g1.<본문>.<서명>` — HMAC-SHA256(SESSION_SECRET) · 5일. 본문에 uid·이메일·이름·만료.
 *   ★검증할 때 도메인을 «다시» 본다 — GOOGLE_WORKSPACE_DOMAIN 을 바꾸면 옛 세션도 바로 막힌다.
 *
 * 설정: GOOGLE_OAUTH_CLIENT_ID · GOOGLE_OAUTH_CLIENT_SECRET · GOOGLE_WORKSPACE_DOMAIN(기본 teamjpk.com) · SESSION_SECRET(32바이트 이상)
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

export const OAUTH_COOKIE = 'fpa_oauth';
const SESSION_MS = 5 * 24 * 3600_000;
const OAUTH_MS = 10 * 60_000;

export const workspaceDomain = () => (process.env.GOOGLE_WORKSPACE_DOMAIN ?? 'teamjpk.com').trim().toLowerCase();

function secret(): Buffer {
  const s = process.env.SESSION_SECRET?.trim() ?? '';
  if (s.length < 32) throw new Error('SESSION_SECRET 이 없거나 짧다(32자 이상) — 구글 로그인 세션을 못 만든다');
  return Buffer.from(s);
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const sign = (body: string) => createHmac('sha256', secret()).update(body).digest('base64url');
const sameStr = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** 서명한 짧은 봉투 — 세션·로그인 중간 상태 둘 다 이걸 쓴다 */
function seal(prefix: string, payload: Record<string, unknown>): string {
  const body = b64(JSON.stringify(payload));
  return `${prefix}.${body}.${sign(`${prefix}.${body}`)}`;
}
function open<T>(prefix: string, token: string | undefined): T | null {
  if (!token) return null;
  const [p, body, sig] = token.split('.');
  if (p !== prefix || !body || !sig) return null;
  try {
    if (!sameStr(sig, sign(`${p}.${body}`))) return null;
    const x = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: number };
    return x.exp && x.exp > Date.now() ? x : null;
  } catch { return null; }
}

function client(redirectUri: string): OAuth2Client {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim(), sec = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!id || !sec) throw new Error('구글 로그인 설정(GOOGLE_OAUTH_CLIENT_ID · SECRET)이 없다');
  return new OAuth2Client({ clientId: id, clientSecret: sec, redirectUri });
}
export const googleLoginReady = () => !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && (process.env.SESSION_SECRET ?? '').length >= 32);
const redirectOf = (origin: string) => `${(process.env.APP_BASE_URL?.trim() || origin).replace(/\/$/, '')}/login/google/callback`;

/** ① 구글로 보낼 주소 + 잠깐 들고 있을 봉투(state · PKCE · 돌아갈 곳) */
export function startGoogle(origin: string, next: string): { url: string; cookie: string } {
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const url = client(redirectOf(origin)).generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state, prompt: 'select_account', hd: workspaceDomain(),
    code_challenge_method: 'S256' as never, code_challenge: challenge,
  });
  return { url, cookie: seal('o1', { state, verifier, next, exp: Date.now() + OAUTH_MS }) };
}

export interface GoogleUser { uid: string; email: string; name: string }

/** ② 돌아왔다 — 신원표를 검증하고 워크스페이스 사람인지 본다. ★실패 까닭은 사람에게 가르지 않는다 */
export async function finishGoogle(origin: string, q: { code?: string | null; state?: string | null }, oauthCookie: string | undefined):
  Promise<{ ok: true; user: GoogleUser; session: string; next: string } | { ok: false; error: string }> {
  const bag = open<{ state: string; verifier: string; next: string }>('o1', oauthCookie);
  if (!bag || !q.state || !sameStr(q.state, bag.state) || !q.code) return { ok: false, error: '로그인이 끊겼습니다 — 다시 해 주세요' };
  try {
    const c = client(redirectOf(origin));
    const { tokens } = await c.getToken({ code: q.code, codeVerifier: bag.verifier });
    if (!tokens.id_token) return { ok: false, error: '구글 신원을 받지 못했습니다' };
    const t = await c.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim() });
    const p = t.getPayload();
    const domain = workspaceDomain();
    const email = String(p?.email ?? '').toLowerCase();
    /* ★세 가지가 다 맞아야 — 워크스페이스 표시(hd) · 구글이 확인한 이메일 · 그 도메인 주소 */
    if (!p || p.hd?.toLowerCase() !== domain || p.email_verified !== true || !email.endsWith(`@${domain}`)) {
      return { ok: false, error: `${domain} 회사 구글 계정으로만 들어올 수 있습니다` };
    }
    const user = { uid: `google:${p.sub}`, email, name: String(p.name ?? email.split('@')[0]) };
    return { ok: true, user, session: googleSessionOf(user), next: bag.next };
  } catch {
    return { ok: false, error: '구글 로그인에 실패했습니다 — 다시 해 주세요' };
  }
}

/** 우리 세션(구글 쪽) 발급 — 검증을 마친 사람에게만 부른다 */
export const googleSessionOf = (u: GoogleUser, now = Date.now()) => seal('g1', { ...u, exp: now + SESSION_MS });

/** 우리 세션(구글 쪽) 검증 — ★도메인을 다시 본다 */
export function verifyGoogleSession(token: string | undefined): GoogleUser | null {
  const x = open<GoogleUser>('g1', token);
  if (!x) return null;
  return x.email.endsWith(`@${workspaceDomain()}`) ? { uid: x.uid, email: x.email, name: x.name } : null;
}
export const GOOGLE_SESSION_MS = SESSION_MS;
