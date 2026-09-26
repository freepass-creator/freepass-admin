export type Erp5WriteApproval = {
  projectId: string;
  iamVerified: boolean;
  iamRef: string;
  backupRestoreVerified: boolean;
  backupRestoreRef: string;
  approvalRef: string;
  approvedAt: string;
};

export type Erp5WriteGate = {
  enabled: boolean;
  mode: 'OFF' | 'DEMO' | 'EMULATOR' | 'LOCAL' | 'PRODUCTION_APPROVED' | 'HOLD';
  reason: string;
  approval?: Erp5WriteApproval;
};

const PROJECT_ID = 'freepasserp5';

export function parseErp5WriteApproval(
  raw: string | undefined,
  now = Date.now(),
): { ok: true; value: Erp5WriteApproval } | { ok: false; reason: string } {
  if (!raw?.trim()) return { ok: false, reason: 'ERP5_WRITE_APPROVAL_JSON이 없습니다' };
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return { ok: false, reason: 'ERP5_WRITE_APPROVAL_JSON이 JSON이 아닙니다' }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'ERP5_WRITE_APPROVAL_JSON은 객체여야 합니다' };
  }
  const v = value as Record<string, unknown>;
  const projectId = String(v.projectId ?? '').trim();
  const iamRef = String(v.iamRef ?? '').trim();
  const backupRestoreRef = String(v.backupRestoreRef ?? '').trim();
  const approvalRef = String(v.approvalRef ?? '').trim();
  const approvedAt = String(v.approvedAt ?? '').trim();
  if (projectId !== PROJECT_ID) return { ok: false, reason: `승인 projectId는 ${PROJECT_ID}여야 합니다` };
  if (v.iamVerified !== true) return { ok: false, reason: 'IAM 최소권한 검증이 확인되지 않았습니다' };
  if (iamRef.length < 4) return { ok: false, reason: 'IAM 검증 참조(iamRef)가 없습니다' };
  if (v.backupRestoreVerified !== true) return { ok: false, reason: 'backup/restore 검증이 확인되지 않았습니다' };
  if (backupRestoreRef.length < 4) return { ok: false, reason: 'backup/restore 검증 참조(backupRestoreRef)가 없습니다' };
  if (approvalRef.length < 4) return { ok: false, reason: 'approvalRef가 없습니다' };
  const approvedMs = Date.parse(approvedAt);
  if (!Number.isFinite(approvedMs)) return { ok: false, reason: 'approvedAt이 ISO 날짜가 아닙니다' };
  if (approvedMs > now + 5 * 60_000) return { ok: false, reason: 'approvedAt이 미래 시각입니다' };
  return {
    ok: true,
    value: {
      projectId,
      iamVerified: true,
      iamRef,
      backupRestoreVerified: true,
      backupRestoreRef,
      approvalRef,
      approvedAt,
    },
  };
}

export function erp5WriteGate(
  env: Record<string, string | undefined>,
  demo: boolean,
  now = Date.now(),
): Erp5WriteGate {
  if (env.ERP5_WRITE?.trim() !== 'on') {
    return { enabled: false, mode: 'OFF', reason: 'ERP5_WRITE가 off입니다' };
  }
  if (demo) {
    return { enabled: false, mode: 'DEMO', reason: '데모 모드는 읽기 전용입니다' };
  }
  if (env.FIRESTORE_EMULATOR_HOST?.trim()) {
    return { enabled: true, mode: 'EMULATOR', reason: 'Firestore emulator 격리 쓰기' };
  }

  const onVercel = env.VERCEL?.trim() === '1' || !!env.VERCEL_ENV?.trim();
  if (onVercel && env.VERCEL_ENV?.trim() !== 'production') {
    return { enabled: false, mode: 'HOLD', reason: 'Vercel preview/development 배포에는 운영 쓰기를 열지 않습니다' };
  }

  const production = onVercel
    ? env.VERCEL_ENV?.trim() === 'production'
    : env.NODE_ENV?.trim() === 'production';

  if (!production) {
    return { enabled: true, mode: 'LOCAL', reason: '비운영 로컬 환경의 명시적 ERP5_WRITE=on' };
  }

  const approval = parseErp5WriteApproval(env.ERP5_WRITE_APPROVAL_JSON, now);
  if (!approval.ok) {
    return { enabled: false, mode: 'HOLD', reason: approval.reason };
  }
  return {
    enabled: true,
    mode: 'PRODUCTION_APPROVED',
    reason: `운영 쓰기 승인 ${approval.value.approvalRef}`,
    approval: approval.value,
  };
}
