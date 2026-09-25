import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * **FreePass Data의 Firestore 기술 Adapter.**
 *   Admin/UI가 이 파일을 직접 부르지 않는다. 공식 진입점은 `src/server/freepass-data.ts`다.
 *   `freepasserp5`는 FreePass Data가 사용하는 Firebase project id다.
 *
 * ★`src/ports/repositories.ts` 가 예고해 둔 그 순간이다 —
 *   「독립 Firestore 자격증명이 아직 없다 … 자격증명이 오면 «문 뒤만» 갈아 끼운다」
 *   문(포트)은 안 바뀐다. 파일 어댑터도 안 지운다(시험이 그걸 쓴다). 문 뒤가 하나 늘 뿐이다.
 *
 * ★★**틀리면 즉시 죽는다.** 자격증명이 freepasserp5 가 아니면 던진다.
 *   상품·정산이 걸린 자리에서 「빈 화면」 보다 나쁜 것이 «다른 회사 값이 든 화면» 이다.
 *   (같은 규율을 erp4 `lib/server/erp5-firestore-app.ts` 가 먼저 세웠다 — 그걸 따른다)
 *
 * ★RTDB 는 쓰지 않는다 (2026-09-14 폐기 확정). 여기는 Firestore 뿐이다.
 */
export const ERP5_PROJECT_ID = 'freepasserp5';
const APP_NAME = 'freepass-admin-erp5';

type Sa = { project_id: string; client_email: string; private_key: string };

/**
 * 자격증명을 찾는 차례 — 배포는 JSON 문자열, 개발은 파일 경로.
 * ⚠ 둘 다 없으면 지어내지 않고 «무엇을 채워야 하는지 이름을 대고» 던진다.
 */
function credential(): Sa {
  const raw = process.env.ERP5_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const path = process.env.ERP5_SERVICE_ACCOUNT_PATH?.trim();
  let parsed: Partial<Sa>;
  if (raw) {
    try { parsed = JSON.parse(raw) as Partial<Sa>; }
    catch { throw new Error('ERP5_FIREBASE_SERVICE_ACCOUNT_JSON 이 JSON 이 아니다.'); }
  } else if (path) {
    try { parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<Sa>; }
    catch { throw new Error(`ERP5_SERVICE_ACCOUNT_PATH 를 못 읽었다: ${path}`); }
  } else {
    throw new Error(
      'ERP5 자격증명이 없다 — ERP5_FIREBASE_SERVICE_ACCOUNT_JSON(배포) 또는 '
      + 'ERP5_SERVICE_ACCOUNT_PATH(개발) 중 하나를 채워야 한다.',
    );
  }
  const project_id = String(parsed.project_id ?? '').trim();
  const client_email = String(parsed.client_email ?? '').trim();
  const private_key = String(parsed.private_key ?? '');
  if (!project_id || !client_email || !private_key) {
    throw new Error('ERP5 자격증명에 project_id · client_email · private_key 가 다 있어야 한다.');
  }
  /** ★★안전장치 — 다른 프로젝트 키로 조용히 도는 일을 막는다. */
  if (project_id !== ERP5_PROJECT_ID) {
    throw new Error(`★ERP5 가 아니다: ${project_id} (${ERP5_PROJECT_ID} 라야 한다)`);
  }
  return { project_id, client_email, private_key };
}

let app: App | null = null;

function ensureErp5App(): App {
  if (!app) {
    app = getApps().find((a) => a.name === APP_NAME) ?? null;
  }
  if (!app) {
    // Firebase Admin automatically routes Firestore traffic to the emulator when
    // FIRESTORE_EMULATOR_HOST is set. In that isolated mode, never require or
    // load a production service-account credential.
    if (process.env.FIRESTORE_EMULATOR_HOST?.trim()) {
      app = initializeApp({ projectId: ERP5_PROJECT_ID }, APP_NAME);
    } else {
      const sa = credential();
      app = initializeApp({
        credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
        projectId: sa.project_id,
      }, APP_NAME);
    }
  }
  return app;
}

/** ERP5 Admin app — Firestore와 Storage가 반드시 같은 자격증명/프로젝트를 공유한다. */
export function erp5App(): App {
  return ensureErp5App();
}

/** FreePass Data Firestore transport. 읽기/쓰기는 상위 repository가 통제한다. */
export function erp5(): Firestore {
  return getFirestore(ensureErp5App());
}

/** 붙었나 — 화면·상태줄이 「어디를 보고 있나」 를 말할 수 있게. */
export function erp5Ready(): { ok: true; project: string } | { ok: false; project: string; why: string } {
  try { erp5(); return { ok: true, project: ERP5_PROJECT_ID }; }
  catch (e) { return { ok: false, project: ERP5_PROJECT_ID, why: (e as Error).message }; }
}
