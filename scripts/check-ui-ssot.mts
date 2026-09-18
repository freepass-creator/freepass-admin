import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const coreFiles = [
  'src/app/products/workspace.tsx',
  'src/app/intake/panels.tsx',
  'src/app/intake/NewIntakePanel.tsx',
  'src/app/intake/IntakeDetailPanel.tsx',
  'src/app/settlement/page.tsx',
  'src/app/esign/page.tsx',
  'src/app/_design/DetailTabs.tsx',
  'src/app/_design/OfferPicker.tsx',
  'src/app/_design/FilterSheet.tsx',
];

const noInlineStyleFiles = [
  ...coreFiles,
  'src/app/intake/MoneyForm.tsx',
  'src/app/intake/PaidRounds.tsx',
  'src/app/intake/[code]/Progress.tsx',
  'src/app/settlement/LifeForms.tsx',
];

const forbidden = [
  { re: /className="panel-head"/g, use: '<PanelHeader />' },
  { re: /className="dz-bar"/g, use: '<ActionBar />' },
  { re: /className="dz-empty"/g, use: '<EmptyState />' },
  { re: /className="summary-grid"/g, use: '<SummaryGrid />' },
  { re: /className="dz-warn"/g, use: '<Notice tone="warn" />' },
  { re: /className="dz-ok"/g, use: '<Notice tone="ok" />' },
];

const requiredCss = [
  '--ui-text-title:',
  '--ui-text-main:',
  '--ui-text-support:',
  '--ui-radius:',
  '--ui-control-h:',
  '--ui-action-h:',
  '--ui-touch-min:',
  '--ui-row-body-h:',
  '--ui-thumb-w:',
  '--ui-thumb-h:',
  '--ui-status-tile:',
];

const errors: string[] = [];

const layout = await readFile(path.join(root, 'src/app/layout.tsx'), 'utf8');
const importOrder = [
  "import './globals.css';",
  "import './_design/admin-final.css';",
  "import './_fn/fn.css';",
  "import './_design/admin-micro-polish.css';",
];
let lastImport = -1;
for (const item of importOrder) {
  const at = layout.indexOf(item);
  if (at < 0) errors.push(`src/app/layout.tsx: missing CSS import ${item}`);
  if (at >= 0 && at <= lastImport) errors.push('src/app/layout.tsx: micro-polish CSS must load last');
  lastImport = Math.max(lastImport, at);
}

for (const file of coreFiles) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const rule of forbidden) {
    rule.re.lastIndex = 0;
    if (rule.re.test(src)) errors.push(`${file}: raw shared markup found; use ${rule.use}`);
  }
}

for (const file of noInlineStyleFiles) {
  const src = await readFile(path.join(root, file), 'utf8');
  if (/style=\{\{/.test(src)) errors.push(`${file}: inline visual style found; move stable UI values to globals.css / SSOT tokens`);
}

const cssBase = await readFile(path.join(root, 'src/app/globals.css'), 'utf8');
const cssFinal = await readFile(path.join(root, 'src/app/_design/admin-final.css'), 'utf8');
const cssPolish = await readFile(path.join(root, 'src/app/_design/admin-micro-polish.css'), 'utf8');
const css = `${cssBase}\n${cssFinal}\n${cssPolish}`;
for (const token of requiredCss) {
  if (!css.includes(token)) errors.push(`admin CSS: missing shared token ${token}`);
}

const cssBaseline = [
  [/--글제목:\s*18px/, '--글제목 18px'],
  [/--글메인:\s*14px/, '--글메인 14px'],
  [/--글보조:\s*12px/, '--글보조 12px'],
  [/--컨트롤:\s*40px/, '--컨트롤 40px'],
  [/--ui-action-h:\s*44px/, '--ui-action-h 44px'],
  [/--ui-touch-min:\s*44px/, '--ui-touch-min 44px'],
  [/--r:\s*4px/, '--r 4px'],
] as const;
for (const [re, label] of cssBaseline) {
  if (!re.test(css)) errors.push(`admin CSS: baseline mismatch or missing: ${label}`);
}
if (!/:focus-visible/.test(css)) errors.push('admin CSS: missing shared focus-visible behavior');
if (!/prefers-reduced-motion:\s*reduce/.test(css)) errors.push('admin CSS: missing reduced-motion behavior');

const ssot = JSON.parse(await readFile(path.join(root, 'docs/ui/admin-ui-ux-ssot.json'), 'utf8')) as {
  typography?: { title?: { px?: number }; main?: { px?: number }; support?: { px?: number } };
  controls?: { standard?: { heightPx?: number }; primary?: { heightPx?: number }; mobileTouchMinimumPx?: number };
  radii?: { defaultPx?: number };
};

const expected = [
  ['typography.title.px', ssot.typography?.title?.px, 18],
  ['typography.main.px', ssot.typography?.main?.px, 14],
  ['typography.support.px', ssot.typography?.support?.px, 12],
  ['controls.standard.heightPx', ssot.controls?.standard?.heightPx, 40],
  ['controls.primary.heightPx', ssot.controls?.primary?.heightPx, 44],
  ['controls.mobileTouchMinimumPx', ssot.controls?.mobileTouchMinimumPx, 44],
  ['radii.defaultPx', ssot.radii?.defaultPx, 4],
] as const;

for (const [name, actual, want] of expected) {
  if (actual !== want) errors.push(`docs/ui/admin-ui-ux-ssot.json: ${name}=${String(actual)}; expected ${want}`);
}

if (errors.length) {
  console.error('UI/UX SSOT check FAILED');
  for (const e of errors) console.error(`- ${e}`);
  process.exitCode = 1;
} else {
  console.log('UI/UX SSOT check PASS');
  console.log(`- checked UI files: ${coreFiles.length}`);
  console.log(`- shared markup: PanelHeader / ActionBar / EmptyState / Notice / SummaryGrid`);
  console.log('- visual baseline: 18/14/12 · control 40 · action/touch 44 · radius 4');
  console.log(`- inline-style guard files: ${noInlineStyleFiles.length}`);
  console.log('- micro-polish layer: layout-preserving visual depth only');
}
