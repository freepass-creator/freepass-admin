/**
 * 배포 환경변수 점검 — 값은 출력하지 않는다.
 *   로컬:   npm run deploy:check           (현재 셸 환경)
 *   Vercel: vercel env pull .env.check --environment=production && node --env-file=.env.check --import tsx scripts/check-deploy-env.mts && rm .env.check
 */
import { checkDeployEnv } from '../src/server/deploy-env';

const findings = checkDeployEnv(process.env);
const mark = { error: 'ERROR', warn: 'WARN ', ok: 'OK   ' } as const;
for (const f of findings) console.log(`${mark[f.level]} ${f.key} — ${f.message}`);
const errors = findings.filter((f) => f.level === 'error').length;
console.log(errors ? `\n배포 전 고칠 것 ${errors}건` : '\n필수 환경변수 이상 없음');
process.exit(errors ? 1 : 0);
