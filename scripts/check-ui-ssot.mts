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

const internalAdminUiFiles = [
  ...coreFiles,
  'src/app/system/data-status/page.tsx',
  'src/app/intake/MoneyForm.tsx',
  'src/app/intake/PaidRounds.tsx',
  'src/app/intake/[code]/Progress.tsx',
  'src/app/settlement/LifeForms.tsx',
];

const noInlineStyleFiles = internalAdminUiFiles;

/**
 * 명시적 예외 — 관리자 내부 화면이 아니라 별도 사용자 여정이다.
 * 이 셋을 내부 Admin 공통 UI 검사에서 빼는 것은 “페이지별 독자 디자인 허용”이 아니라
 * audience/shell 자체가 다른 surface라서다. 공통 interaction 원칙은 별도 검증 대상으로 올린다.
 */
const explicitSurfaceExceptions = [
  'src/app/login/LoginForm.tsx',
  'src/app/c/[token]/ClaimDoor.tsx',
  'src/app/sign/[token]/SignClient.tsx',
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
  if (/<style[\s>]/.test(src)) errors.push(`${file}: page-local <style> found; internal admin visuals must come from shared CSS/tokens`);
  if (/\b(?:borderRadius|boxShadow|backgroundColor|fontSize|padding|margin)\s*:/.test(src)) {
    errors.push(`${file}: page-local visual constant found; use shared component/token instead`);
  }
}

/* 내부 Admin route가 자기 시각 체계를 새로 만들지 못하게 한다.
 * 도메인 class(dz-money 등)는 허용하지만 stable visual 값은 shared CSS/token에서만 온다. */
for (const file of internalAdminUiFiles) {
  const src = await readFile(path.join(root, file), 'utf8');
  if (/className=["'`]\s*(?:lg|cl|sg)-/.test(src)) {
    errors.push(`${file}: public/login surface class prefix used inside internal Admin UI`);
  }
}

/* 모바일/기존 board의 Panel도 역할 contract를 반드시 가진다.
 * Web의 Panel 역할(List/Detail/Work)과 같은 semantics를 공유하되 shell만 다르다. */
for (const file of [
  'src/app/products/workspace.tsx',
  'src/app/settlement/page.tsx',
  'src/app/esign/page.tsx',
]) {
  const src = await readFile(path.join(root, file), 'utf8');
  const rawPanels = [...src.matchAll(/<section className="[^"]*\bpanel\b[^"]*"(?![^>]*data-panel-role=)/g)];
  if (rawPanels.length) errors.push(`${file}: ${rawPanels.length} panel(s) missing data-panel-role=list|detail|work`);
  for (const m of src.matchAll(/data-panel-role="([^"]+)"/g)) {
    if (!['list','detail','work'].includes(m[1])) errors.push(`${file}: invalid data-panel-role=${m[1]}`);
  }
}

/* 예외는 닫힌 목록이다. 새 공개/독립 surface가 생기면 이유를 문서와 여기 둘 다 갱신해야 한다. */
for (const file of explicitSurfaceExceptions) {
  if (!await readFile(path.join(root, file), 'utf8').catch(() => '')) errors.push(`explicit UI exception missing: ${file}`);
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
  console.log(`- internal Admin UI guard files: ${internalAdminUiFiles.length}`);
  console.log(`- explicit separate-surface exceptions: ${explicitSurfaceExceptions.length} (login / supplier claim / public e-sign)`);
}

