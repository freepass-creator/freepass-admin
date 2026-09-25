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
const css = `${cssBase}\n${cssFinal}`;
for (const token of requiredCss) {
  if (!css.includes(token)) errors.push(`admin CSS: missing shared token ${token}`);
}

const cssBaseline = [
  [/--ui-control-radius:\s*6px/, '--ui-control-radius 6px'],
  [/--ui-control-gap:\s*8px/, '--ui-control-gap 8px'],
  [/--글제목:\s*18px/, '--글제목 18px'],
  [/--글메인:\s*14px/, '--글메인 14px'],
  [/--글보조:\s*12px/, '--글보조 12px'],
  [/--컨트롤:\s*44px/, '--컨트롤 44px'],
  [/--ui-action-h:\s*44px/, '--ui-action-h 44px'],
  [/--ui-touch-min:\s*44px/, '--ui-touch-min 44px'],
  [/--r:\s*4px/, '--r 4px'],
] as const;
for (const [re, label] of cssBaseline) {
  if (!re.test(css)) errors.push(`admin CSS: baseline mismatch or missing: ${label}`);
}
const responsiveCssExpected = [
  ['mobile quick filters stay on one horizontal line', /\.fn-main \.workspace \.quick-filters[\s\S]*?flex-wrap:\s*nowrap/],
  ['find list desktop card minimum 360px', /workspace\[data-mode="find"\][\s\S]*?minmax\(360px,\s*1fr\)/],
  ['find list mobile collapses to one shrinkable column', /workspace\[data-mode="find"\][\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/],
  ['three-action bar uses 3-3-4', /grid-template-columns:\s*minmax\(0,\s*3fr\)\s+minmax\(0,\s*3fr\)\s+minmax\(0,\s*4fr\)/],
] as const;
for (const [label, re] of responsiveCssExpected) {
  if (!re.test(cssFinal)) errors.push(`responsive UI regression: missing ${label}`);
}

if (!/:focus-visible/.test(css)) errors.push('admin CSS: missing shared focus-visible behavior');
if (!/prefers-reduced-motion:\s*reduce/.test(css)) errors.push('admin CSS: missing reduced-motion behavior');

const binding = JSON.parse(await readFile(path.join(root, 'docs/ui/ai-core-bindings.json'), 'utf8')) as {
  upstream?: { repository?: string; revision?: string; feature_registry_version?: string; required_features?: string[] };
  list_presentation?: Record<string,string>;
  policy?: { ai_core_semantics_authoritative?: boolean; product_profile_may_redefine_selection_semantics?: boolean; drift_behavior?: string };
};

const ssot = JSON.parse(await readFile(path.join(root, 'docs/ui/admin-ui-ux-ssot.json'), 'utf8')) as {
  typography?: { title?: { px?: number }; main?: { px?: number }; support?: { px?: number } };
  controls?: { standard?: { heightPx?: number }; primary?: { heightPx?: number }; mobileTouchMinimumPx?: number; radiusPx?: number; gapPx?: number };
  radii?: { defaultPx?: number };
  aiCore?: { upstreamRepository?: string; upstreamRevision?: string; featureRegistryVersion?: string; semanticAuthority?: boolean };
  listPresentation?: { authorityFeature?: string; modes?: Record<string,string> };
};

const aiCoreExpected = [
  ['binding.upstream.repository', binding.upstream?.repository, 'freepass-creator/ai-core'],
  ['ssot.aiCore.upstreamRevision', ssot.aiCore?.upstreamRevision, binding.upstream?.revision],
  ['binding.upstream.feature_registry_version', binding.upstream?.feature_registry_version, '1.8.0'],
  ['binding.policy.ai_core_semantics_authoritative', binding.policy?.ai_core_semantics_authoritative, true],
  ['binding.policy.product_profile_may_redefine_selection_semantics', binding.policy?.product_profile_may_redefine_selection_semantics, false],
  ['binding.policy.drift_behavior', binding.policy?.drift_behavior, 'FAIL_CHECK'],
  ['ssot.aiCore.semanticAuthority', ssot.aiCore?.semanticAuthority, true],
  ['ssot.listPresentation.authorityFeature', ssot.listPresentation?.authorityFeature, 'data.list-presentation'],
  ['list.product', binding.list_presentation?.product_catalog, 'product-media-row'],
  ['list.application', binding.list_presentation?.application, 'business-row'],
  ['list.performance', binding.list_presentation?.performance, 'business-row'],
  ['list.billing', binding.list_presentation?.billing, 'business-row'],
  ['list.payout', binding.list_presentation?.payout, 'business-row'],
  ['list.offer', binding.list_presentation?.offer, 'variant-card'],
] as const;
for (const [name, actual, want] of aiCoreExpected) {
  if (actual !== want) errors.push(`AI Core UI binding mismatch: ${name}=${String(actual)}; expected ${String(want)}`);
}

const listRow = await readFile(path.join(root, 'src/app/_design/ListRow.tsx'), 'utf8');
const offerPicker = await readFile(path.join(root, 'src/app/_design/OfferPicker.tsx'), 'utf8');
if (!/data-ai-feature="data\.list-presentation"/.test(listRow)) errors.push('ListRow: missing AI Core data.list-presentation binding');
if (!/product-media-row/.test(listRow) || !/business-row/.test(listRow)) errors.push('ListRow: missing product-media-row/business-row semantic modes');
if (!/data-ai-list-mode="variant-card"/.test(offerPicker)) errors.push('OfferPicker: missing AI Core variant-card mode');

const currentPassFiles = {
  listRow,
  offerPicker,
  intakeForm: await readFile(path.join(root, 'src/app/intake/new/IntakeForm.tsx'), 'utf8'),
  intakeDetail: await readFile(path.join(root, 'src/app/intake/IntakeDetailPanel.tsx'), 'utf8'),
  settlementPage: await readFile(path.join(root, 'src/app/settlement/page.tsx'), 'utf8'),
  esignPage: await readFile(path.join(root, 'src/app/esign/page.tsx'), 'utf8'),
};

const currentPassExpected = [
  ['product list segmented values', currentPassFiles.listRow, /className="dz-seg"/],
  ['detail offer one-line rows', currentPassFiles.offerPicker, /dz-offer-rows/],
  ['intake support helper', currentPassFiles.intakeForm, /dz-form-hint/],
  ['intake detail current work', currentPassFiles.intakeDetail, /dz-work-focus/],
  ['intake detail diagnostic disclosure', currentPassFiles.intakeDetail, /dz-support-section/],
  ['settlement axis separation', currentPassFiles.settlementPage, /dz-settle-axis/],
  ['settlement period context', currentPassFiles.settlementPage, /dz-settle-period/],
  ['esign admin stage mapping', currentPassFiles.esignPage, /type 관리자단계/],
  ['esign current stage focus', currentPassFiles.esignPage, /dz-esign-focus/],
] as const;

for (const [label, src, re] of currentPassExpected) {
  if (!re.test(src)) errors.push(`2026-09-25 UI pass regression: missing ${label}`);
}

if (/control 40|inside 40px search box/.test(JSON.stringify(ssot))) {
  errors.push('docs/ui/admin-ui-ux-ssot.json: stale 40px UI wording remains');
}

const expected = [
  ['typography.title.px', ssot.typography?.title?.px, 18],
  ['typography.main.px', ssot.typography?.main?.px, 14],
  ['typography.support.px', ssot.typography?.support?.px, 12],
  ['controls.standard.heightPx', ssot.controls?.standard?.heightPx, 44],
  ['controls.radiusPx', ssot.controls?.radiusPx, 6],
  ['controls.gapPx', ssot.controls?.gapPx, 8],
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
  console.log('- visual baseline: 18/14/12 · Sales control/action 44 · control radius 6 · gap 8 · panel radius 4');
  console.log('- AI Core semantic authority: data.list-presentation 1.8.0');
  console.log('- list modes: product-media-row / business-row / variant-card / data-table');
  console.log(`- inline-style guard files: ${noInlineStyleFiles.length}`);
}

