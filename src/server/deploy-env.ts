import { freepassDataWriteGate } from '../shared/erp5-write-approval';
import { parseAdminCutoverApproval, type AdminCutoverStage } from '../shared/freepass-data-admin-cutover';

export type EnvFinding = { level: 'error' | 'warn' | 'ok'; key: string; message: string };

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

  /* Shared FreePass identity. Business-data Firebase credentials are not a fallback. */
  for (const k of ['IDENTITY_FIREBASE_WEB_API_KEY', 'IDENTITY_FIREBASE_AUTH_DOMAIN', 'IDENTITY_FIREBASE_PROJECT_ID'] as const) {
    if (!set(env, k)) err(k, '공용 로그인 화면에 필요합니다'); else ok(k, '설정됨');
  }
  const identityRaw = env.IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!identityRaw) {
    err('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', 'ID 토큰 서버 검증과 identity_accounts 조회에 필요합니다');
  } else {
    try {
      const sa = JSON.parse(identityRaw) as Record<string, unknown>;
      const projectId = String(sa.project_id ?? '').trim();
      const configuredProject = env.IDENTITY_FIREBASE_PROJECT_ID?.trim() ?? '';
      if (!sa.client_email || !sa.private_key) {
        err('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', 'client_email · private_key 가 없습니다');
      } else if (configuredProject && projectId !== configuredProject) {
        err('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', 'project_id가 IDENTITY_FIREBASE_PROJECT_ID와 다릅니다');
      } else {
        ok('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', '신원 전용 서비스계정 설정됨');
      }
    } catch {
      err('IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON', 'JSON 으로 읽히지 않습니다(따옴표·줄바꿈 확인)');
    }
  }
  const apiKey = env.IDENTITY_FIREBASE_WEB_API_KEY?.trim() ?? '';
  if (apiKey && !apiKey.startsWith('AIza')) warn('IDENTITY_FIREBASE_WEB_API_KEY', 'Firebase 웹 API 키 꼴(AIza…)이 아닙니다');
  for (const k of ['SESSION_SECRET', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_WORKSPACE_DOMAIN'] as const) {
    if (set(env, k)) warn(k, '더 이상 읽지 않습니다 — 공용 FreePass 신원으로 바뀌었습니다. 지우세요');
  }

  /* FreePass Data — Admin must not hold Firebase business-data credentials. */
  for (const k of ['ERP5_FIREBASE_SERVICE_ACCOUNT_JSON', 'ERP5_SERVICE_ACCOUNT_PATH'] as const) {
    if (set(env, k)) err(k, 'Admin 운영 런타임에는 두지 않습니다 — Firebase 업무데이터 접근은 FreePass Data만 소유합니다');
  }
  const dataOrigin = originOf(env.FREEPASS_DATA_BASE_URL?.trim() ?? '');
  if (!dataOrigin) err('FREEPASS_DATA_BASE_URL', '운영 FreePass Data HTTPS origin이 필요합니다');
  else ok('FREEPASS_DATA_BASE_URL', dataOrigin);
  const dataToken = env.FREEPASS_DATA_ADMIN_CATALOG_TOKEN?.trim() ?? '';
  if (dataToken.length < 32) err('FREEPASS_DATA_ADMIN_CATALOG_TOKEN', '32자 이상 consumer token이 필요합니다');
  else ok('FREEPASS_DATA_ADMIN_CATALOG_TOKEN', '설정됨');

  if (env.VERCEL_ENV?.trim() === 'production') {
    for (const k of ['FREEPASS_DATA_GCP_WIF_AUDIENCE', 'FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL'] as const) {
      if (!set(env, k)) err(k, 'private FreePass Data Cloud Run 호출에 필요합니다');
      else ok(k, '설정됨');
    }
    if (set(env, 'FREEPASS_DATA_CLOUD_RUN_ID_TOKEN')) {
      warn('FREEPASS_DATA_CLOUD_RUN_ID_TOKEN', '진단용 호환값입니다 — 운영 정본은 Vercel OIDC → GCP WIF입니다');
    }
  }

  const write = env.ERP5_WRITE?.trim() || 'off';
  if (write !== 'on' && write !== 'off') {
    err('ERP5_WRITE', 'on 또는 off');
  } else if (write === 'on') {
    const gate = freepassDataWriteGate(env, false);
    if (!gate.enabled) err('FREEPASS_DATA_ADMIN_WORKFLOW_WRITE', gate.reason);
    else ok('ERP5_WRITE', `on — ${gate.reason}`);
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
    if (!cutover.ok) err('FREEPASS_DATA_ADMIN_CUTOVER_JSON', `${mode} 승인 증거가 불완전합니다 — ${cutover.reason}`);
    else ok('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', `${mode} · 승인 ${cutover.approval.approvalRef}`);
  } else {
    err('FREEPASS_DATA_ADMIN_CATALOG_READ_MODE', `${mode} — 운영에서는 OBSERVE 또는 증거가 승인된 전진 단계만 허용합니다`);
  }

  const urls = ['APP_BASE_URL', 'PUBLIC_BASE_URL', 'CLAIM_LINK_BASE'] as const;
  const origins = new Set<string>();
  for (const k of urls) {
    const v = env[k]?.trim();
    if (!v) { warn(k, '미설정 — 첫 배포 뒤 production 주소를 넣고 재배포합니다'); continue; }
    const o = originOf(v);
    if (!o) { err(k, 'https://호스트 꼴의 주소여야 합니다(경로·쿼리 없이)'); continue; }
    origins.add(o);
    if (/-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app$/.test(new URL(o).host)) warn(k, '배포마다 바뀌는 preview 주소로 보입니다 — production 주소를 씁니다');
    else ok(k, o);
  }
  if (origins.size > 1) err('APP_BASE_URL', 'APP_BASE_URL · PUBLIC_BASE_URL · CLAIM_LINK_BASE 가 같은 주소여야 합니다');

  for (const k of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'IDENTITY_FIREBASE_AUTH_EMULATOR_HOST', 'FPA_DATA_DIR']) {
    if (set(env, k)) err(k, '운영 환경에 두면 안 됩니다');
  }
  if (env.FPA_DEMO?.trim() === 'on') err('FPA_DEMO', '가상 데이터는 개발/미리보기 전용입니다 — 운영 환경에서는 제거해야 합니다');
  if (env.ADMIN_AUTH?.trim() === 'off') warn('ADMIN_AUTH', '운영에서는 무시되지만 혼동을 막기 위해 지웁니다');
  return out;
}
