/**
 * 배포 환경변수 점검 — 값은 출력하지 않는다.
 *   로컬:   npm run deploy:check           (현재 셸 환경)
 *   Vercel: vercel env pull .env.check --environment=production && node --env-file=.env.check --import tsx scripts/check-deploy-env.mts && rm .env.check
 */
import { checkDeployEnv } from '../src/server/deploy-env';

// Keep local/CI builds credential-free. Every Vercel production build must pass.
if (process.argv.includes('--vercel-build') && process.env.VERCEL_ENV !== 'production') {
  console.log('배포 환경 검사: 로컬/preview 빌드에는 운영 자격증명을 요구하지 않습니다');
  process.exit(0);
}

const findings = checkDeployEnv(process.env);
const mark = { error: 'ERROR', warn: 'WARN ', ok: 'OK   ' } as const;
for (const f of findings) console.log(`${mark[f.level]} ${f.key} — ${f.message}`);
const errors = findings.filter((f) => f.level === 'error').length;
console.log(errors ? `\n배포 전 고칠 것 ${errors}건` : '\n필수 환경변수 이상 없음');
process.exit(errors ? 1 : 0);
