/**
 * **배포 전 환경변수 점검** — 값은 절대 출력하지 않는다. 있는지 · 꼴이 맞는지만 본다.
 * 운영 개시 결정(DEC-2026-09-25-05): Vercel · 별도 도메인 없음 · 전자계약 off · Workspace 로그인.
 * `npm run deploy:check` (scripts/check-deploy-env.mts) 가 부른다.
 */
export type EnvFinding = { level: 'error' | 'warn' | 'ok'; key: string; message: string };

const ERP5_PROJECT_ID = 'freepasserp5';
const set = (env: Record<string, string | undefined>, k: string) => !!env[k]?.trim();

function originOf(v: string): string | null {
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) return null;
    return u.origin;
  } catch { return null; }
}

export function checkDeployEnv(env: Record<string, string | undefined>): EnvFinding[] {
  const out: EnvFinding[] = [];
  const err = (key: string, message: string) => out.push({ level: 'error', key, message });
  const warn = (key: string, message: string) => out.push({ level: 'warn', key, message });
  const ok = (key: string, message: string) => out.push({ level: 'ok', key, message });

  /* 로그인 — Google Workspace */
  const secret = env.SESSION_SECRET?.trim() ?? '';
  if (secret.length < 32) err('SESSION_SECRET', '32자 이상 무작위 값이 필요합니다');
  else ok('SESSION_SECRET', `설정됨 (${secret.length}자)`);
  for (const k of ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']) {
    if (!set(env, k)) err(k, 'Google Workspace 로그인에 필요합니다'); else ok(k, '설정됨');
  }
  const cid = env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';
  if (cid && !cid.endsWith('.apps.googleusercontent.com')) warn('GOOGLE_OAUTH_CLIENT_ID', 'Google 웹 OAuth 클라이언트 ID 꼴(…apps.googleusercontent.com)이 아닙니다');
  const domain = env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  ok('GOOGLE_WORKSPACE_DOMAIN', domain ? `${domain} 구성원만 로그인` : '미설정 → 기본값 teamjpk.com');

  /* FreePass Data (Firestore freepasserp5) */
  const raw = env.ERP5_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', '서비스계정 JSON 전체가 필요합니다');
  else {
    try {
      const sa = JSON.parse(raw) as Record<string, unknown>;
      if (!sa.client_email || !sa.private_key) err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', 'client_email · private_key 가 없습니다');
      else if (sa.project_id !== ERP5_PROJECT_ID) err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', `project_id 가 ${ERP5_PROJECT_ID} 가 아닙니다`);
      else ok('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', `${ERP5_PROJECT_ID} 서비스계정`);
    } catch { err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', 'JSON 으로 읽히지 않습니다(따옴표·줄바꿈 확인)'); }
  }
  if (set(env, 'ERP5_SERVICE_ACCOUNT_PATH')) warn('ERP5_SERVICE_ACCOUNT_PATH', '배포에서는 파일 경로가 아니라 JSON 값을 씁니다');

  /* 쓰기 · 전자계약 · 카탈로그 */
  const write = env.ERP5_WRITE?.trim() || 'off';
  if (write !== 'on' && write !== 'off') err('ERP5_WRITE', 'on 또는 off');
  else if (write === 'on') warn('ERP5_WRITE', 'on — 첫 배포는 off 로 조회 확인 후 켭니다(OPERATIONS-FIRST-USE.md)');
  else ok('ERP5_WRITE', 'off (조회 전용)');
  if (env.ESIGN_ENABLED?.trim() === 'on') warn('ESIGN_ENABLED', 'on — 전자계약은 운영 개시 범위 밖입니다(DEC-2026-09-25-05)');
  else ok('ESIGN_ENABLED', 'off (전자계약 닫힘)');
  const mode = env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE?.trim();
  if (mode && mode !== 'OBSERVE') warn('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', `${mode} — 승인된 모드는 OBSERVE 입니다`);
  else ok('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', 'OBSERVE');

  /* 주소 — 도메인 없이 Vercel production *.vercel.app */
  const urls = ['APP_BASE_URL', 'PUBLIC_BASE_URL', 'CLAIM_LINK_BASE'] as const;
  const origins = new Set<string>();
  for (const k of urls) {
    const v = env[k]?.trim();
    if (!v) { warn(k, '미설정 — 첫 배포 뒤 production 주소(https://<프로젝트>.vercel.app)를 넣고 재배포합니다'); continue; }
    const o = originOf(v);
    if (!o) { err(k, 'https://호스트 꼴의 주소여야 합니다(경로·쿼리 없이)'); continue; }
    origins.add(o);
    if (/-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app$/.test(new URL(o).host)) warn(k, '배포마다 바뀌는 preview 주소로 보입니다 — production 주소를 씁니다');
    else ok(k, o);
  }
  if (origins.size > 1) err('APP_BASE_URL', 'APP_BASE_URL · PUBLIC_BASE_URL · CLAIM_LINK_BASE 가 같은 주소여야 합니다');

  /* 운영에 있으면 안 되는 것 */
  for (const k of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'FPA_DATA_DIR']) {
    if (set(env, k)) err(k, '운영 환경에 두면 안 됩니다');
  }
  if (env.ADMIN_AUTH?.trim() === 'off') warn('ADMIN_AUTH', '운영에서는 무시되지만 혼동을 막기 위해 지웁니다');
  return out;
}
