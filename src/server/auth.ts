/**
 * **어드민 로그인 — erp4 계정(freepasserp3 Auth) · 관리자만.**
 *
 * ★대표 2026-09-18 「어드민 로그인 붙이는거는 우리 기존 로그인 화면 있지??」
 *            「이거 일단 프리패스erp4 계정을 같이 쓰자」 · 「거기서 관리자만 추려내면 되니까」
 *   ⇒ 로그인은 «erp4 계정» 으로 받는다. 운영 erp4 는 freepasserp3 Auth 로 로그인한다(실측 2026-09-18 —
 *     freepasserp3 = 비밀번호 계정 185 + 익명 448 · 24시간 안 비밀번호 로그인 18명 / freepasserp5 = 185 · 9월 10일 뒤 로그인 0 = 옮겨 놓은 사본).
 *   ⇒ 관리자 판정도 erp4 기록(freepasserp3 Firestore `user`)으로 한다.
 *   ★원장·상품 «데이터» 는 그대로 ERP5(freepasserp5)다. 로그인 문만 erp4 와 같이 쓴다.
 *   ★RTDB 는 읽지 않는다 — 역할은 Firestore `user` 에서만.
 *
 * ── 누가 들어오나
 *   ① erp4 `user` 문서의 role === 'admin' 이고 막히지 않은 사람 (실측: admin 4 · agent 146 · provider 16 · agent_admin 1)
 *   ② ADMIN_EMAILS 에 적힌 이메일 — 대표 2026-09-18 「pyh@teamjpk.com kjs@teamjpk.com 이 두명은 로그인되게 해줘야지」
 *      (pyh 는 Auth 계정은 있는데 ERP5 user 문서가 없다 — 실측). ★ERP5 user 의 role 을 바꾸지 않는다 —
 *      그건 erp4 등 다른 앱의 권한까지 바꾼다. 이 목록은 «이 어드민에만» 통한다.
 *      ★★이메일만으로는 안 연다 — Firebase 는 공개 키로 «아무나 가입» 할 수 있어서, 아직 없는 주소(kjs — 실측 계정 없음)를
 *        남이 먼저 가입하면 관리자가 된다. 그래서 목록의 이메일은 ADMIN_UIDS 에 고정된 계정이거나 이메일 인증을 마친 계정일 때만.
 *   ③ 구글 워크스페이스(teamjpk.com) 사람 — 대표 2026-09-18 「구글 워크스페이스에 있는 사람은 다 들어올 수 있어야지」
 *      구글 로그인으로만(구글이 서명한 hd=teamjpk.com) — src/server/google-login.ts
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
import { readFileSync } from 'node:fs';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { verifyGoogleSession } from './google-login';

export const AUTH_COOKIE = 'fpa_session';
export const SESSION_MS = 5 * 24 * 3600_000;

export const authEnforced = () =>
  process.env.NODE_ENV === 'production' || process.env.ADMIN_AUTH?.trim() === 'on';

/**
 * erp4 로그인 프로젝트 — AUTH_FIREBASE_SERVICE_ACCOUNT_JSON(배포) 또는 AUTH_SERVICE_ACCOUNT_PATH(개발).
 * ★프로젝트가 AUTH_PROJECT_ID(기본 freepasserp3)가 아니면 던진다 — 엉뚱한 계정 창고로 조용히 붙지 않게.
 */
const AUTH_APP = 'freepass-admin-auth';
let authApp: App | null = null;
function erp4App(): App {
  if (authApp) return authApp;
  const hit = getApps().find((a) => a.name === AUTH_APP);
  if (hit) return (authApp = hit);
  const want = (process.env.AUTH_PROJECT_ID ?? 'freepasserp3').trim();
  const raw = process.env.AUTH_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.AUTH_SERVICE_ACCOUNT_PATH?.trim();
  if (!raw && !path) throw new Error('로그인 자격증명이 없다 — AUTH_FIREBASE_SERVICE_ACCOUNT_JSON(배포) 또는 AUTH_SERVICE_ACCOUNT_PATH(개발)');
  const sa = JSON.parse(raw || readFileSync(path!, 'utf8')) as { project_id: string; client_email: string; private_key: string };
  if (sa.project_id !== want) throw new Error(`★로그인 프로젝트가 아니다: ${sa.project_id} (${want} 라야 한다)`);
  return (authApp = initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }), projectId: sa.project_id }, AUTH_APP));
}
const adminAuth = () => getAuth(erp4App());

export interface AdminUser { uid: string; name: string; role: 'admin' }

const cache = new Map<string, { at: number; user: AdminUser | null }>();

/** ADMIN_EMAILS — 쉼표로 여럿. 대소문자 안 가림 */
export const adminEmails = () => new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
/** ADMIN_UIDS — 목록 이메일의 «바로 그 계정» 고정 */
export const adminUids = () => new Set((process.env.ADMIN_UIDS ?? '').split(',').map((x) => x.trim()).filter(Boolean));

/** 관리자인지 — ERP5 user role=admin 이거나 ADMIN_EMAILS 에 있다 */
export async function adminOf(uid: string, email?: string): Promise<AdminUser | null> {
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit.user;
  if (email && adminEmails().has(email.trim().toLowerCase())) {
    const pinned = adminUids().has(uid);
    const verified = pinned ? true : await adminAuth().getUser(uid).then((u) => u.emailVerified).catch(() => false);
    if (pinned || verified) {
      const user = { uid, name: email.split('@')[0], role: 'admin' as const };
      cache.set(uid, { at: Date.now(), user });
      return user;
    }
  }
  const db = getFirestore(erp4App());
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
  let idToken: string, uid: string, signedEmail: string;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json() as { idToken?: string; localId?: string; email?: string; error?: { message?: string } };
    if (!r.ok || !j.idToken || !j.localId) {
      if (String(j.error?.message ?? '').startsWith('TOO_MANY_ATTEMPTS')) return { ok: false, error: '여러 번 틀려 잠시 막혔습니다 — 잠시 뒤 다시 해 주세요' };
      return { ok: false, error: FAIL };
    }
    idToken = j.idToken; uid = j.localId; signedEmail = j.email ?? email.trim();
  } catch {
    return { ok: false, error: '지금 로그인할 수 없습니다 — 잠시 뒤 다시 해 주세요' };
  }
  const user = await adminOf(uid, signedEmail);
  if (!user) return { ok: false, error: FAIL };
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MS });
  return { ok: true, cookie, user };
}

/** 쿠키 → 관리자. ★취소된 세션(비밀번호 바꿈·강제 로그아웃)도 거른다 */
export async function verifySession(cookie: string | undefined): Promise<AdminUser | null> {
  if (!cookie) return null;
  /* 구글 워크스페이스로 들어온 세션 — 우리가 서명한 것(g1.…) */
  if (cookie.startsWith('g1.')) {
    try { const g = verifyGoogleSession(cookie); return g ? { uid: g.uid, name: g.name, role: 'admin' } : null; } catch { return null; }
  }
  try {
    const d = await adminAuth().verifySessionCookie(cookie, true);
    return await adminOf(d.uid, d.email);
  } catch { return null; }
}

/** 로그아웃 — 그 사람의 세션을 모두 끊는다(다른 기기 포함) */
export async function signOut(cookie: string | undefined): Promise<void> {
  if (!cookie || cookie.startsWith('g1.')) return;   // 구글 쪽 세션은 쿠키를 지우면 끝이다
  try { const d = await adminAuth().verifySessionCookie(cookie); await adminAuth().revokeRefreshTokens(d.uid); } catch { /* 이미 끊겼다 */ }
}

/** 로그인 없이 열리는 길 — 청구 링크 · 사진 · 로그인 자체 · Next 내부 */
export function isPublicPath(path: string): boolean {
  return path === '/login' || path.startsWith('/login/google') || path.startsWith('/c/') || path.startsWith('/api/img')
    || path.startsWith('/sign/') || path.startsWith('/api/esign/public/')
    || path.startsWith('/_next/') || path === '/favicon.ico' || /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(path);
}
