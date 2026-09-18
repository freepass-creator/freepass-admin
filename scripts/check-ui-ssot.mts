import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const coreFiles = [
  'src/app/products/workspace.tsx',
  'src/app/intake/panels.tsx',
  'src/app/settlement/page.tsx',
  'src/app/esign/page.tsx',
];

const forbidden = [
  { re: /className="panel-head"/g, use: '<PanelHeader />' },
  { re: /className="dz-bar"/g, use: '<ActionBar />' },
  { re: /className="dz-empty"/g, use: '<EmptyState />' },
  { re: /className="summary-grid"/g, use: '<SummaryGrid />' },
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

for (const file of coreFiles) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const rule of forbidden) {
    rule.re.lastIndex = 0;
    if (rule.re.test(src)) errors.push(`${file}: raw shared markup found; use ${rule.use}`);
  }
}

const css = await readFile(path.join(root, 'src/app/globals.css'), 'utf8');
for (const token of requiredCss) {
  if (!css.includes(token)) errors.push(`src/app/globals.css: missing shared token ${token}`);
}

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
  console.log(`- core routes: ${coreFiles.length}`);
  console.log(`- shared markup: PanelHeader / ActionBar / EmptyState / SummaryGrid`);
  console.log('- visual baseline: 18/14/12 · control 40 · action/touch 44 · radius 4');
}
