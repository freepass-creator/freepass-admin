#!/usr/bin/env node
/**
 * AI Core «ERP 표준 UI 규격 v1» → freepass-admin 투영 (DEC-2026-09-23-01)
 *
 * 대표 2026-09-23 「아까 네가 규격한 디자인이랑 완전 동일하게 구성을 해야지 … 너 규격화 해놨다며」
 *   ⇒ 규격 CSS 를 손으로 흉내 내지 않는다. ai-core 정본(erp.css · themes/retro.css)을 «그대로» 가져와
 *     이 앱의 틀에 맞게 범위만 바꾼다. 값 · 규칙은 한 글자도 바꾸지 않는다.
 *
 * 범위 바꾸기 (그 밖은 그대로):
 *   · `.erp-app` (규격의 뿌리 틀) → `.erp-std` — 관리자는 body 바로 아래 형제들로 틀을 세운다(폰 규칙이 `body > main` 을 본다).
 *     그래서 뿌리 격자 규칙(.erp-app { display:grid … })만 빼고, 격자는 _erp/shell.css 가 body 에 세운다.
 *   · `[data-theme="retro"]` → `body:has(> .erp-theme-flag[data-theme="retro"])` — 테마 표지는 AdminChrome 이 둔다.
 *
 * 사용: node scripts/sync-erp-standard.mjs [ai-core 경로]   (기본: ../ai-core)
 * 결과: src/app/_erp/erp-standard.css (생성물 — 손대지 않는다)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = resolve(process.argv[2] ?? resolve(root, '..', 'ai-core'));
const std = resolve(core, 'design/erp-standard');
const rev = execFileSync('git', ['-C', core, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

let erp = readFileSync(resolve(std, 'erp.css'), 'utf8');
const retro = readFileSync(resolve(std, 'themes/retro.css'), 'utf8');

// 뿌리 격자 규칙 두 개만 뺀다 — 격자는 body 에 선다.
const before = erp.length;
erp = erp.replace(/\.erp-app \{\n  display: grid;[\s\S]*?\n\}\n/, '');
erp = erp.replace(/\.erp-app\[data-nav="collapsed"\][^\n]*\n/, '');
if (erp.length === before) throw new Error('규격 뿌리 격자 규칙을 못 찾았다 — erp.css 구조가 바뀌었는지 확인');
erp = erp.replaceAll('.erp-app', '.erp-std');

const FLAG = 'body:has(> .erp-theme-flag[data-theme="retro"])';
// 자리표를 거쳐 한 번만 바꾼다 — FLAG 안에도 [data-theme="retro"] 가 있어 곧바로 바꾸면 두 번 바뀐다.
const MARK = '\u0000FLAG\u0000';
const theme = retro
  .replaceAll('[data-theme="retro"].erp-app', `${MARK} .erp-std`)
  .replaceAll('[data-theme="retro"] .erp-app', `${MARK} .erp-std`)
  .replaceAll('[data-theme="retro"]', MARK)
  .replaceAll(MARK, FLAG);
if (theme.includes('erp-theme-flagbody')) throw new Error('범위 바꾸기가 겹쳤다');

const out = `/* ⚠ 생성물 — 손대지 않는다. scripts/sync-erp-standard.mjs 가 만든다.
 * 정본: freepass-creator/ai-core @ ${rev}
 *   design/erp-standard/erp.css (테마 1 classic) + design/erp-standard/themes/retro.css (테마 2 retro)
 * 바꾼 것은 범위뿐: .erp-app → .erp-std · [data-theme="retro"] → ${FLAG}
 */
/* 뿌리 틀 대신 — 규격 부품이 규격 글꼴 · 글자 · 색을 쓰게. ★맨 앞에 둔다(규격의 .erp-app 자리) — 뒤의 부품 규칙이 이긴다 */
.erp-std { box-sizing: border-box; font-family: var(--erp-font-family); font-size: var(--erp-fs-body); font-weight: var(--erp-fw-regular); font-variant-numeric: tabular-nums; color: var(--erp-color-text); }
/* 규격 템플릿은 단추를 <button> 으로 쓴다. 관리자는 이동 단추를 <a> 로 쓰므로 링크 색이 단추 색을 덮지 않게 한다 */
.erp-std a.erp-btn { color: var(--erp-color-text); font-weight: var(--erp-fw-semibold); }
.erp-std a.erp-btn--primary, .erp-std a.erp-btn--danger { color: var(--erp-color-on-primary); }
.erp-std a.erp-btn--ghost { color: var(--erp-color-text-2); }
.erp-std a.erp-btn--danger-text { color: var(--erp-color-err); }
.erp-std a.erp-company, .erp-std a.erp-iconbtn { color: var(--erp-color-nav-text); font-weight: var(--erp-fw-regular); }
.erp-std a.erp-nav-item { color: var(--erp-color-nav-text); font-weight: var(--erp-fw-regular); }
.erp-std a.erp-facet-opt { color: var(--erp-color-text); font-weight: var(--erp-fw-regular); }
.erp-std a.erp-facet-opt[aria-pressed="true"] { color: var(--erp-color-primary); font-weight: var(--erp-fw-semibold); }
.erp-std a.erp-chip { color: var(--erp-color-text-2); font-weight: var(--erp-fw-regular); }
.erp-std a.erp-listcard-link, .erp-std a.erp-rowcard-link { color: var(--erp-color-text); text-decoration: none; }

/* ── erp.css ───────────────────────────────────────────── */
${erp}

/* ── themes/retro.css ──────────────────────────────────── */
${theme}`;

mkdirSync(resolve(root, 'src/app/_erp'), { recursive: true });
writeFileSync(resolve(root, 'src/app/_erp/erp-standard.css'), out);
writeFileSync(resolve(root, 'src/app/_erp/erp-standard.source.json'), JSON.stringify({ repository: 'freepass-creator/ai-core', revision: rev, files: ['design/erp-standard/erp.css', 'design/erp-standard/themes/retro.css'] }, null, 2) + '\n');
console.log(`erp-standard.css ← ai-core@${rev.slice(0, 7)}`);
