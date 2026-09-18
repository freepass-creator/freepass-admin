/**
 * **어드민 로그인 — freepasserp5 계정 · 관리자만.**
 *
 * ★대표 2026-09-18 「어드민 로그인 붙이는거는 우리 기존 로그인 화면 있지??」
 *   기존(erp4 app/login)과 «같은 방식» — Firebase 이메일·비밀번호. 다만 erp4 는 freepasserp3 에 붙어 있고,
 *   정본은 freepasserp5 다(계정 185 · 실측 2026-09-18). 그래서 freepasserp5 로 붙는다.
 *
 * ── 누가 들어오나
 *   ERP5 `user` 문서의 role === 'admin' 이고 막히지 않은 사람만 (실측: admin 4 · agent 146 · provider 16 · agent_admin 1).
 *   ★영업자·공급사 계정은 비밀번호가 맞아도 못 들어온다 — 원장을 고치는 화면이다.
 *
 * ── 어떻게
 *   ① 이메일·비밀번호 → Firebase Auth REST(signInWithPassword) → idToken      (브라우저에 Firebase SDK 를 안 싣는다)
 *   ② idToken 검증 → 관리자인지 ERP5 에서 확인 → 세션 쿠키(5일 · httpOnly · secure · sameSite=lax)
 *   ③ 요청마다 proxy.ts 가 쿠키를 검증(취소된 세션도 거른다) · 관리자 판정은 60초 들고 있는다
 *
 * ── 켜고 끄기
 *   배포(NODE_ENV=production)에서는 «늘 켜짐» — 끌 수 없다(끄는 칸을 두면 언젠가 꺼진 채 나간다).
 *   개발에서는 ADMIN_AUTH=on 일 때만 — 화면을 만지는 동안 매번 로그인하지 않게.
 *
 * ★비밀번호는 저장·기록하지 않는다. 오류는 «무엇이 틀렸는지» 를 가르지 않는다(계정이 있는지 새지 않게).
 * ★RTDB 없음.
 */
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import { erp5 } from '../adapters/erp5/firestore';

export const AUTH_COOKIE = 'fpa_session';
export const SESSION_MS = 5 * 24 * 3600_000;

export const authEnforced = () =>
  process.env.NODE_ENV === 'production' || process.env.ADMIN_AUTH?.trim() === 'on';

const adminAuth = () => {
  erp5();   // 앱을 세운다(freepasserp5 가 아니면 여기서 던진다)
  return getAuth(getApps().find((a) => a.name === 'freepass-admin-erp5')!);
};

export interface AdminUser { uid: string; name: string; role: 'admin' }

const cache = new Map<string, { at: number; user: AdminUser | null }>();

/** ERP5 user 문서에서 관리자인지 — ★role 이 admin 이고 막히지 않았을 때만 */
export async function adminOf(uid: string): Promise<AdminUser | null> {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit.user;
  const db = erp5();
  let doc: FirebaseFirestore.DocumentData | undefined = (await db.collection('user').where('uid', '==', uid).limit(1).get()).docs[0]?.data();
  if (!doc) { const d = await db.collection('user').doc(uid).get(); doc = d.exists ? d.data() : undefined; }
  const active = doc && doc.is_active !== false && doc._deleted !== true && !/비활성|정지|탈퇴|거절/.test(String(doc.status ?? ''));
  const user = doc && active && String(doc.role) === 'admin'
    ? { uid, name: String(doc.name ?? doc.user_name ?? doc.display_name ?? '관리자'), role: 'admin' as const }
    : null;
  cache.set(uid, { at: Date.now(), user });
  return user;
}

const FAIL = '이메일 또는 비밀번호가 맞지 않거나, 관리자 계정이 아닙니다';

/** 로그인 → 세션 쿠키 값. ★실패 까닭을 가르지 않는다 */
export async function signIn(email: string, password: string): Promise<{ ok: true; cookie: string; user: AdminUser } | { ok: false; error: string }> {
  const key = process.env.FIREBASE_WEB_API_KEY?.trim();
  if (!key) return { ok: false, error: '로그인 설정(FIREBASE_WEB_API_KEY)이 없습니다 — 관리자에게 알려 주세요' };
  if (!email.trim() || !password) return { ok: false, error: '이메일과 비밀번호를 넣어 주세요' };
  let idToken: string, uid: string;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json() as { idToken?: string; localId?: string; error?: { message?: string } };
    if (!r.ok || !j.idToken || !j.localId) {
      if (String(j.error?.message ?? '').startsWith('TOO_MANY_ATTEMPTS')) return { ok: false, error: '여러 번 틀려 잠시 막혔습니다 — 잠시 뒤 다시 해 주세요' };
      return { ok: false, error: FAIL };
    }
    idToken = j.idToken; uid = j.localId;
  } catch {
    return { ok: false, error: '지금 로그인할 수 없습니다 — 잠시 뒤 다시 해 주세요' };
  }
  const user = await adminOf(uid);
  if (!user) return { ok: false, error: FAIL };
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MS });
  return { ok: true, cookie, user };
}

/** 쿠키 → 관리자. ★취소된 세션(비밀번호 바꿈·강제 로그아웃)도 거른다 */
export async function verifySession(cookie: string | undefined): Promise<AdminUser | null> {
  if (!cookie) return null;
  try {
    const d = await adminAuth().verifySessionCookie(cookie, true);
    return await adminOf(d.uid);
  } catch { return null; }
}

/** 로그아웃 — 그 사람의 세션을 모두 끊는다(다른 기기 포함) */
export async function signOut(cookie: string | undefined): Promise<void> {
  if (!cookie) return;
  try { const d = await adminAuth().verifySessionCookie(cookie); await adminAuth().revokeRefreshTokens(d.uid); } catch { /* 이미 끊겼다 */ }
}

/** 로그인 없이 열리는 길 — 청구 링크 · 사진 · 로그인 자체 · Next 내부 */
export function isPublicPath(path: string): boolean {
  return path === '/login' || path.startsWith('/c/') || path.startsWith('/api/img')
    || path.startsWith('/_next/') || path === '/favicon.ico' || /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(path);
}
