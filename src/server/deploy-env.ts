import { parseErp5WriteApproval } from '../shared/erp5-write-approval';
import { parseAdminCutoverApproval, type AdminCutoverStage } from '../shared/freepass-data-admin-cutover';

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

  /* 로그인 — 프리패스 공용 신원(IDENTITY-AND-ACCESS 계약).
     비밀번호는 Firebase Auth 가, 승인·grant 는 프리패스 데이터가 든다. 이 앱은 둘 다 저장하지 않는다.
     ★웹 설정 셋은 비밀이 아니다 — 공개 배포물에 실린다. 없으면 로그인 화면이 서지 않는다. */
  for (const k of ['IDENTITY_FIREBASE_WEB_API_KEY', 'IDENTITY_FIREBASE_AUTH_DOMAIN', 'IDENTITY_FIREBASE_PROJECT_ID'] as const) {
    if (!set(env, k)) err(k, '공용 로그인 화면에 필요합니다'); else ok(k, '설정됨');
  }
  /* 서버 검증용 — 따로 안 넣었으면 업무 자격증명을 쓴다(같은 프로젝트일 때만 맞는다) */
  if (set(env, 'IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON')) ok('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', '설정됨');
  else if (set(env, 'ERP5_FIREBASE_SERVICE_ACCOUNT_JSON')) {
    warn('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', '미설정 — ERP5 서비스계정으로 ID 토큰을 검증합니다. 계정이 다른 프로젝트에 있으면 로그인이 전부 실패합니다');
  } else err('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', 'ID 토큰 서버 검증에 필요합니다');
  const apiKey = env.IDENTITY_FIREBASE_WEB_API_KEY?.trim() ?? '';
  if (apiKey && !apiKey.startsWith('AIza')) warn('IDENTITY_FIREBASE_WEB_API_KEY', 'Firebase 웹 API 키 꼴(AIza…)이 아닙니다');
  for (const k of ['SESSION_SECRET', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_WORKSPACE_DOMAIN'] as const) {
    if (set(env, k)) warn(k, '더 이상 읽지 않습니다 — 구글 OAuth 문은 공용 신원으로 바뀌었습니다. 지우세요');
  }

  /* FreePass Data (Firestore freepasserp5) */
  const raw = env.ERP5_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  let serviceAccountEmail: string | null = null;
  if (!raw) err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', '서비스계정 JSON 전체가 필요합니다');
  else {
    try {
      const sa = JSON.parse(raw) as Record<string, unknown>;
      const email = String(sa.client_email ?? '').trim();
      serviceAccountEmail = email || null;
      if (!email || !sa.private_key) err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', 'client_email · private_key 가 없습니다');
      else if (sa.project_id !== ERP5_PROJECT_ID) err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', `project_id 가 ${ERP5_PROJECT_ID} 가 아닙니다`);
      else if (!email.endsWith(`@${ERP5_PROJECT_ID}.iam.gserviceaccount.com`)) {
        err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', `client_email 이 ${ERP5_PROJECT_ID} 서비스계정이 아닙니다`);
      } else ok('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', `${ERP5_PROJECT_ID} 서비스계정`);
    } catch { err('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', 'JSON 으로 읽히지 않습니다(따옴표·줄바꿈 확인)'); }
  }
  if (set(env, 'ERP5_SERVICE_ACCOUNT_PATH')) warn('ERP5_SERVICE_ACCOUNT_PATH', '배포에서는 파일 경로가 아니라 JSON 값을 씁니다');

  /* 쓰기 · 전자계약 · 카탈로그 */
  const write = env.ERP5_WRITE?.trim() || 'off';
  if (write !== 'on' && write !== 'off') {
    err('ERP5_WRITE', 'on 또는 off');
  } else if (write === 'on') {
    const approval = parseErp5WriteApproval(env.ERP5_WRITE_APPROVAL_JSON);
    if (!approval.ok) {
      err('ERP5_WRITE_APPROVAL_JSON', `운영 쓰기 승인 증거가 불완전합니다 — ${approval.reason}`);
    } else {
      const appOrigin = originOf(env.APP_BASE_URL?.trim() ?? '');
      if (!serviceAccountEmail || approval.value.serviceAccountEmail !== serviceAccountEmail) {
        err('ERP5_WRITE_APPROVAL_JSON', '승인 serviceAccountEmail과 실제 배포 서비스계정이 다릅니다');
      } else if (!appOrigin || approval.value.productionOrigin !== appOrigin) {
        err('ERP5_WRITE_APPROVAL_JSON', '승인 productionOrigin과 APP_BASE_URL이 다릅니다');
      } else {
        ok('ERP5_WRITE', `on — IAM/backup-restore 승인 ${approval.value.approvalRef}`);
      }
    }
  } else {
    ok('ERP5_WRITE', 'off (조회 전용)');
  }
  if (env.ESIGN_ENABLED?.trim() === 'on') warn('ESIGN_ENABLED', 'on — 전자계약은 운영 개시 범위 밖입니다(DEC-2026-09-25-05)');
  else ok('ESIGN_ENABLED', 'off (전자계약 닫힘)');
  const mode = (env.FREEPASS_DATA_ADMIN_CATALOG_READ_MODE?.trim() || 'OBSERVE') as AdminCutoverStage;
  if (mode === 'OBSERVE') {
    ok('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', 'OBSERVE');
  } else if (mode === 'SHADOW_READ' || mode === 'PARITY_VERIFIED' || mode === 'FREEPASS_DATA_READ') {
    const cutover = parseAdminCutoverApproval(env.FREEPASS_DATA_ADMIN_CUTOVER_JSON, env, mode);
    if (!cutover.ok) {
      err('FREEPASS_DATA_ADMIN_CUTOVER_JSON', `${mode} 승인 증거가 불완전합니다 — ${cutover.reason}`);
    } else {
      ok('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', `${mode} · 승인 ${cutover.approval.approvalRef}`);
    }
  } else {
    err('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', `${mode} — 운영에서는 OBSERVE 또는 증거가 승인된 전진 단계만 허용합니다`);
  }

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
  for (const k of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'IDENTITY_FIREBASE_AUTH_EMULATOR_HOST', 'FPA_DATA_DIR']) {
    if (set(env, k)) err(k, '운영 환경에 두면 안 됩니다');
  }
  if (env.FPA_DEMO?.trim() === 'on') {
    err('FPA_DEMO', '가상 데이터는 개발/미리보기 전용입니다 — 운영 환경에서는 제거해야 합니다');
  }
  if (env.ADMIN_AUTH?.trim() === 'off') warn('ADMIN_AUTH', '운영에서는 무시되지만 혼동을 막기 위해 지웁니다');
  return out;
}
