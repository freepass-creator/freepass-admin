'use client';
/**
 * 공용 로그인 화면을 이 앱에 «입힌다».
 *   화면 정본 = freepass-data `dashboard/public/login/` → `./shared/` 로 그대로 옮겼다.
 *   ★shared/ 안을 고치지 않는다(SHARED-LOGIN-DESIGN.md §3). 앱이 넘기는 것은 브랜드와 정책뿐이다.
 *   ★Firebase SDK 는 CDN 이 아니라 번들에서 온다 — 제3자에 기대지 않는 것은 글꼴과 같은 이유다.
 */
import { useEffect, useRef, useState } from 'react';
import { mount, type SharedLoginBrand } from './shared/login.js';
import './shared/login.css';

/** 어드민 간판 — 공식 CI(Exo 2 · freepass 600 #1B2A4A + 뒷말 300 #7F93B3) */
const FREEPASS_ADMIN_BRAND: SharedLoginBrand = {
  kind: 'ours',
  label: 'freepass admin',
  color: '#1B2A4A',
  colorHover: '#24365E',
  wordmark: [
    { text: 'freepass', weight: 600 },
    { text: 'admin', weight: 300, color: '#7F93B3' },
  ],
};

export interface WebConfig { apiKey: string; authDomain: string; projectId: string; authEmulatorHost?: string }

export function LoginScreen({ config, next }: { config: WebConfig | null; next: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    if (!config || !host.current) return;
    let alive = true;
    (async () => {
      try {
        const [{ initializeApp, getApps }, auth] = await Promise.all([
          import('firebase/app'),
          import('firebase/auth'),
        ]);
        if (!alive || !host.current) return;
        const { authEmulatorHost, ...appConfig } = config;
        const app = getApps()[0] ?? initializeApp(appConfig);
        const instance = auth.getAuth(app);
        /* 개발·검증 전용 — 에뮬레이터가 없으면 전체 흐름을 돌려볼 길이 없다 */
        if (authEmulatorHost) auth.connectAuthEmulator(instance, `http://${authEmulatorHost}`, { disableWarnings: true });
        await instance.authStateReady?.();
        if (!alive || !host.current) return;
        mount(host.current, {
          brand: FREEPASS_ADMIN_BRAND,
          policy: 'APPROVAL',   /* 어드민은 승인제 — SHARED-LOGIN-DESIGN.md §4 */
          fields: 'basic',      /* 사업자번호·활동유형은 영업 가입에만 */
          consent: false,
          auth: instance,
          firebase: auth,
          /** 화면이 사람을 확인했다. 서버가 «다시» 보고 권한까지 풀어야 들어간다 */
          async onSignedIn() {
            const idToken = await instance.currentUser?.getIdToken(true);
            const res = await fetch('/api/session', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
            if (res.ok) { window.location.assign(next || '/'); return; }
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            await auth.signOut(instance).catch(() => {});
            /* ★메일 인증과 승인을 합쳐서 말하지 않는다 — 할 일이 서로 다르다 */
            const WHY: Record<string, string> = {
              EMAIL_UNVERIFIED: '메일 인증이 아직입니다 — 받으신 인증 메일의 링크를 누른 뒤 다시 로그인해 주세요',
              NOT_APPROVED: '아직 승인되지 않은 계정입니다 — 마스터 승인 뒤에 들어올 수 있습니다',
              NO_SESSION: '로그인이 끈겼습니다 — 다시 해 주세요',
            };
            throw new Error(WHY[body?.error ?? ''] ?? '지금 로그인할 수 없습니다 — 잠시 뒤 다시 해 주세요');
          },
        });
      } catch {
        if (alive) setFatal('로그인 화면을 불러오지 못했습니다 — 새로고침해 주세요');
      }
    })();
    return () => { alive = false; };
  }, [config, next]);

  /* ★설정이 없으면 «다른 문을 내주지 않는다» — 까닭만 적고 닫는다 */
  if (!config) {
    return (
      <main className="fpl"><div className="fpl-page">
        <p className="fpl-msg is-error">로그인 설정이 아직 없습니다 — 관리자에게 알려 주세요</p>
      </div></main>
    );
  }
  return (
    <>
      <div ref={host} />
      {fatal && <p className="fpl-msg is-error">{fatal}</p>}
    </>
  );
}
