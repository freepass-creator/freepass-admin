/**
 * **로컬 준비** — `.env.local` 을 만든다.
 *
 *   npm run local:setup            에뮬레이터로 «로그인까지» 걸어 보는 설정
 *   npm run local:setup -- --data  로그인 없이 «실제 ERP5 자료»를 보는 설정
 *
 * 로컬에서 둘을 동시에 가질 수는 없다. 신원과 업무자료가 같은 Firestore 를 쓰는데,
 * `FIRESTORE_EMULATOR_HOST` 는 그 둘을 «같이» 에뮬레이터로 보내기 때문이다.
 *   · 로그인 모드 — 계정도 자료도 에뮬레이터. 로그인 흐름을 끝까지 볼 수 있고 목록은 0건이다.
 *   · 자료 모드   — 로그인을 끄고(개발에서만 가능) 실제 freepasserp5 를 «읽기만» 한다.
 *
 * ★이 스크립트는 운영 값을 만들지 않는다. 운영은 Vercel 환경변수로만 들어간다.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const dataMode = process.argv.includes('--data');
const ENV = '.env.local';
const SERVICE_ACCOUNT_PATH = 'C:/Users/admin/Downloads/freepasserp5-e7249ebaa792.json';

if (existsSync(ENV) && !process.argv.includes('--force')) {
  console.error(`${ENV} 이 이미 있습니다. 덮어쓰려면 --force 를 붙이세요.`);
  process.exit(1);
}

/** 에뮬레이터라도 firebase-admin 은 진짜 꼴의 키를 요구한다. 일회용을 만든다 */
const throwaway = () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return JSON.stringify({
    project_id: 'freepasserp5',
    client_email: 'sim@freepasserp5.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  }).replace(/\n/g, '\\n');
};

const shared = [
  'ERP5_WRITE=off',
  'ESIGN_ENABLED=off',
  'FREEPASS_DATA_ADMIN_CATALOG_READ_MODE=OBSERVE',
];

const lines = dataMode
  ? [
      '# 자료 모드 — 실제 freepasserp5 를 읽기만 한다. 로그인은 꺼져 있다(개발에서만 가능).',
      `ERP5_SERVICE_ACCOUNT_PATH=${SERVICE_ACCOUNT_PATH}`,
      ...shared,
    ]
  : [
      '# 로그인 모드 — 계정도 자료도 에뮬레이터다. 운영 값이 아니다.',
      'ADMIN_AUTH=on',
      'IDENTITY_FIREBASE_PROJECT_ID=freepasserp5',
      'IDENTITY_FIREBASE_AUTH_DOMAIN=freepasserp5.firebaseapp.com',
      '# 에뮬레이터는 웹 API 키를 검사하지 않는다 — 아무 값이어도 된다',
      'IDENTITY_FIREBASE_WEB_API_KEY=local-emulator-key',
      'IDENTITY_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099',
      'FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099',
      'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080',
      `IDENTITY_FIREBASE_SERVICE_ACCOUNT_JSON=${throwaway()}`,
      ...shared,
    ];

writeFileSync(ENV, lines.join('\n') + '\n');

if (dataMode && !existsSync(SERVICE_ACCOUNT_PATH)) {
  console.warn(`⚠ 서비스계정 파일이 없습니다: ${SERVICE_ACCOUNT_PATH}`);
  console.warn(`  ${ENV} 의 ERP5_SERVICE_ACCOUNT_PATH 를 실제 경로로 고치세요.`);
}

console.log(`${ENV} — ${dataMode ? '자료' : '로그인'} 모드로 만들었습니다.\n`);
console.log(dataMode
  ? ['다음:', '  npm run dev', '  → http://localhost:3000/intake  (로그인 없이 실제 자료)'].join('\n')
  : [
      '다음: 창 두 개를 쓴다.',
      '  ① npm run local:emulators',
      '  ② npm run dev',
      '  ③ http://localhost:3000/login 에서 「계정 만들기」로 가입',
      '  ④ npm run local:approve -- <가입한 이메일>     (메일 인증 + 승인을 대신한다)',
      '  ⑤ 같은 화면에서 로그인 → 들어간다',
    ].join('\n'));

/* .gitignore 는 이미 .env* 를 덮는다 — 한 번 더 확인해 준다 */
if (!/^\.env\*?/m.test(readFileSync('.gitignore', 'utf8'))) {
  console.warn('⚠ .gitignore 가 .env* 를 덮지 않습니다. 확인하세요.');
}
