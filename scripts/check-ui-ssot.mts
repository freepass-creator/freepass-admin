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

const desktopCss = await readFile(path.join(root, 'src/app/_erp/shell.css'), 'utf8');
const desktopScaleBaseline = [
  [/--erp-fs-kpi:\s*24px/, 'desktop KPI 24px'],
  [/--erp-fs-title:\s*20px/, 'desktop screen title 20px'],
  [/--erp-fs-panel:\s*18px/, 'desktop panel title 18px'],
  [/--erp-fs-section:\s*16px/, 'desktop section title 16px'],
  [/--erp-fs-body:\s*14px/, 'desktop body 14px'],
  [/--erp-fs-label:\s*12px/, 'desktop label 12px'],
  [/--erp-fs-caption:\s*12px/, 'desktop caption 12px'],
  [/--erp-btn-h-sm:\s*32px/, 'desktop small control 32px'],
  [/--erp-btn-h:\s*36px/, 'desktop standard control 36px'],
  [/--erp-input-h:\s*36px/, 'desktop input 36px'],
  [/--erp-grid-row-h:\s*40px/, 'desktop row 40px'],
  [/--erp-section-gap:\s*16px/, 'desktop section gap 16px'],
] as const;
for (const [re, label] of desktopScaleBaseline) {
  if (!re.test(desktopCss)) errors.push(`desktop scale mismatch or missing: ${label}`);
}

/* 최신 PC consumer layer는 Product Scale 밖의 새 안정값을 만들지 않는다.
 * generated erp-standard.css와 legacy/mobile CSS는 아직 별도 세대이므로 여기서 기계적으로 막지 않는다. */
const desktopOffScaleRules = [
  [/font-size:\s*(?:11\.5|13|15|17|22)px/g, 'off-scale desktop font size (11.5/13/15/17/22px)'],
  [/(?:padding|gap|margin(?:-top|-right|-bottom|-left)?):[^;\n]*(?:14|18|22)px/g, 'off-scale desktop layout spacing (14/18/22px)'],
] as const;
for (const [re, label] of desktopOffScaleRules) {
  re.lastIndex = 0;
  if (re.test(desktopCss)) errors.push(`desktop scale: ${label}`);
}
if (!/:focus-visible/.test(css)) errors.push('admin CSS: missing shared focus-visible behavior');
if (!/prefers-reduced-motion:\s*reduce/.test(css)) errors.push('admin CSS: missing reduced-motion behavior');

const terminologyBaseline = [
  ['src/app/intake/new/IntakeForm.tsx', [
    /월 대여료/,
  ]],
  ['src/app/intake/IntakeDetailPanel.tsx', [
    /금액 조정 — 수수료 · 프로모션 · 가감/,
  ]],
  ['src/app/settlement/page.tsx', [
    /할 일 <small>/,
  ]],
  ['src/app/_erp/EsignScreen.tsx', [
    /<dt>영업담당<\/dt>/,
    /<dt>생성일<\/dt>/,
    /<dt>발송일<\/dt>/,
    /<dt>서명일<\/dt>/,
  ]],
] as const;
for (const [file, rules] of terminologyBaseline) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: terminology contract missing: ${re}`);
  }
}

const motionBaseline = [
  [/--fp-motion-press:\s*80ms/, 'desktop press motion 80ms'],
  [/--fp-motion-state:\s*120ms/, 'desktop state motion 120ms'],
  [/--fp-motion-float:\s*160ms/, 'desktop float motion 160ms'],
  [/--ui-motion-press:\s*80ms/, 'mobile press motion 80ms'],
  [/--ui-motion-state:\s*120ms/, 'mobile state motion 120ms'],
  [/--ui-motion-float:\s*160ms/, 'mobile float motion 160ms'],
] as const;
for (const [re, label] of motionBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`motion mismatch or missing: ${label}`);
}

const riskActionBaseline = [
  ['src/app/intake/[code]/Progress.tsx', [
    /className="dz-action-danger"/,
    /data-confirm="인도 완료 상태를 되돌릴까요\?/,
    /data-confirm="이 접수를 취소할까요\?/,
    /window\.confirm/,
  ]],
  ['src/app/settlement/LifeForms.tsx', [
    /className="dz-action-caution"/,
  ]],
] as const;
for (const [file, rules] of riskActionBaseline) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: action risk contract missing: ${re}`);
  }
}

const formContractBaseline = [
  ['src/app/intake/new/IntakeForm.tsx', [
    /className="dz-errs" role="alert" aria-live="assertive"/,
    /aria-busy=\{pending\}/,
    /disabled=\{pending\}/,
    /저장 중…/,
  ]],
  ['src/app/settlement/LifeForms.tsx', [
    /className="dz-errs" role="alert" aria-live="assertive"/,
    /aria-busy=\{pending\}/,
  ]],
] as const;
for (const [file, rules] of formContractBaseline) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: form contract missing: ${re}`);
  }
}

const formCssBaseline = [
  [/input\[inputmode="numeric"\][\s\S]*?text-align:\s*right/, 'mobile numeric right alignment'],
  [/\.dz-errs[\s\S]*?background:\s*#FDEEEE/i, 'mobile error summary surface'],
] as const;
for (const [re, label] of formCssBaseline) {
  if (!re.test(cssFinal)) errors.push(`form UX mismatch or missing: ${label}`);
}

const accessibilityBehaviorBaseline = [
  ['src/app/_design/DetailTabs.tsx', [
    /tabIndex=\{tab === 'summary' \? 0 : -1\}/,
    /ArrowRight/,
    /ArrowLeft/,
    /Home/,
    /End/,
  ]],
  ['src/app/_design/FilterSheet.tsx', [
    /aria-expanded=\{open\}/,
    /aria-haspopup="dialog"/,
    /aria-controls=\{dialogId\}/,
    /querySelector<HTMLElement>/,
    /trigger\.current\?\.focus\(\)/,
  ]],
  ['src/app/_erp/parts.tsx', [
    /erp-rowcard-link[^>]+aria-current=\{current \? 'true' : undefined\}/,
  ]],
] as const;
for (const [file, rules] of accessibilityBehaviorBaseline) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: accessibility behavior missing: ${re}`);
  }
}

const iconTouchBaseline = [
  [/--fp-icon-action-hit:\s*36px/, 'desktop icon-only hit area 36px'],
  [/--fp-icon-md:\s*18px/, 'desktop action glyph 18px'],
  [/--ui-icon-action:\s*20px/, 'mobile action glyph 20px'],
  [/\.dz-phone-back[\s\S]*?width:\s*var\(--ui-touch-min\)[\s\S]*?height:\s*var\(--ui-touch-min\)/, 'mobile back hit area uses touch minimum'],
] as const;
for (const [re, label] of iconTouchBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`icon/touch mismatch or missing: ${label}`);
}

const contrastBaseline = [
  [/--fp-text-muted:\s*#667085/i, 'desktop muted text #667085'],
  [/--fp-nav-text:\s*#AEB9CA/i, 'desktop nav text #AEB9CA'],
  [/--ui-text-muted-color:\s*#667085/i, 'mobile muted text #667085'],
] as const;
for (const [re, label] of contrastBaseline) {
  const target = label.startsWith('mobile') ? cssFinal : desktopCss;
  if (!re.test(target)) errors.push(`contrast mismatch or missing: ${label}`);
}

const responsiveWidthBaseline = [
  [/Responsive width QA/, 'desktop responsive width QA contract'],
  [/@media \(min-width: 1280px\) and \(max-width: 1439px\)/, 'desktop 1280-1439 compact tier'],
  [/@media \(min-width: 1440px\)/, 'desktop 1440+ standard tier'],
] as const;
for (const [re, label] of responsiveWidthBaseline) {
  if (!re.test(desktopCss)) errors.push(`responsive width mismatch or missing: ${label}`);
}

const mobileResponsiveBaseline = [
  [/Mobile width QA \(360 \/ 390 \/ 412\)/, 'mobile width QA contract'],
  [/@media \(max-width: 379px\)/, '360-class narrow tier'],
  [/overflow-x:\s*hidden/, 'mobile page horizontal overflow guard'],
] as const;
for (const [re, label] of mobileResponsiveBaseline) {
  if (!re.test(cssFinal)) errors.push(`responsive width mismatch or missing: ${label}`);
}


/* Page QA structural invariants — prevent accidental redesign of core workflows. */
const pageQaRules = [
  ['src/app/_erp/ProductsScreen.tsx', [
    /<Panel compact wide>/,
    /<SearchBar/,
    /<QuickFilter/,
    /<RowCards label="상품 목록">/,
    /<ProductDetail/,
  ]],
  ['src/app/_erp/Workspace.tsx', [
    /products-workspace|intake-workspace/,
    /<ProductDetail/,
    /<SettlementDetail/,
    /<SearchBar/,
    /<QuickFilter/,
  ]],
  ['src/app/_erp/SettlementScreen.tsx', [
    /title="청구목록"/,
    /title="지급목록"/,
    /title="정산상세"/,
    /<SearchBar/,
    /<QuickFilter/,
  ]],
  ['src/app/_erp/EsignScreen.tsx', [
    /전자계약 목록|전자계약목록/,
    /<SearchBar/,
    /<QuickFilter/,
    /<PanelFoot>/,
  ]],
] as const;

for (const [file, rules] of pageQaRules) {
  const src = await readFile(path.join(root, file), 'utf8');
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: page QA structural invariant missing: ${re}`);
  }
}


const liveAdminScaleBaseline = [
  [/--ui-panel-pad:\s*20px/, 'shared panel padding 20px'],
  [/--ui-panel-pad-mobile:\s*16px/, 'mobile panel padding 16px'],
  [/--ui-list-gap:\s*8px/, 'list gap 8px'],
  [/--ui-item-pad:\s*12px/, 'item padding 12px'],
  [/\.dz-picked-grid > div \{[^}]*padding:\s*8px 12px/s, 'picked-grid padding 8/12'],
  [/--ui-space-7:\s*32px/, 'current-route 4pt spacing scale through 32px'],
] as const;
for (const [re, label] of liveAdminScaleBaseline) {
  if (!re.test(cssFinal)) errors.push(`live Admin scale mismatch or missing: ${label}`);
}

const surfaceDepthBaseline = [
  [/--ui-canvas:\s*#F2F6FC/i, 'mobile canvas #F2F6FC'],
  [/--ui-component-surface:\s*#F7F9FC/i, 'mobile component surface #F7F9FC'],
  [/--fp-canvas:\s*#F2F6FC/i, 'desktop canvas #F2F6FC'],
  [/--fp-component-surface:\s*#F7F9FC/i, 'desktop component surface #F7F9FC'],
] as const;
for (const [re, label] of surfaceDepthBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`surface hierarchy mismatch or missing: ${label}`);
}

/* current internal Admin layer may not introduce a raw 13px text tier again.
 * Explicit public/login surfaces are outside this guard. */
if (/\.dz-perk\s*\{[^}]*font-size:\s*13px/s.test(cssFinal)) {
  errors.push('live Admin typography: dz-perk reintroduced legacy 13px tier');
}

const densityBaseline = [
  [/--fp-panel-head-h:\s*48px/, 'desktop panel head 48px'],
  [/--fp-query-row-h:\s*52px/, 'desktop query row 52px'],
  [/--fp-quick-row-h:\s*48px/, 'desktop quick filter row 48px'],
  [/--fp-panel-foot-h:\s*60px/, 'desktop panel foot 60px'],
  [/--fp-row-compact-min-h:\s*64px/, 'desktop compact row 64px'],
  [/--fp-row-standard-min-h:\s*72px/, 'desktop standard row 72px'],
] as const;
for (const [re, label] of densityBaseline) {
  if (!re.test(desktopCss)) errors.push(`density mismatch or missing: ${label}`);
}
const mobileDensityBaseline = [
  [/--ui-panel-head-h:\s*56px/, 'mobile panel head 56px'],
  [/--ui-row-min-h:\s*88px/, 'mobile row 88px'],
  [/--ui-section-rhythm:\s*16px/, 'mobile section rhythm 16px'],
] as const;
for (const [re, label] of mobileDensityBaseline) {
  if (!re.test(cssFinal)) errors.push(`density mismatch or missing: ${label}`);
}

const alignmentBaseline = [
  [/Alignment & information hierarchy/, 'desktop alignment contract'],
  [/\.erp-rowcard-amount\s*\{[^}]*text-align:\s*right/s, 'desktop amount right alignment'],
  [/font-variant-numeric:\s*tabular-nums/, 'desktop tabular numeric alignment'],
] as const;
for (const [re, label] of alignmentBaseline) {
  if (!re.test(desktopCss)) errors.push(`alignment mismatch or missing: ${label}`);
}
const mobileAlignmentBaseline = [
  [/Alignment & information hierarchy \(live Admin\)/, 'mobile alignment contract'],
  [/\.dz-row-l3 > :is\(strong,b\)[^}]*text-align:\s*right/s, 'mobile result right alignment'],
] as const;
for (const [re, label] of mobileAlignmentBaseline) {
  if (!re.test(cssFinal)) errors.push(`alignment mismatch or missing: ${label}`);
}

const systemStateBaseline = [
  [/Async \/ empty \/ error \/ readonly state surfaces/, 'desktop system state contract'],
  [/\[aria-busy="true"\]/, 'desktop busy state'],
  [/data-ui-state="stale"/, 'desktop stale state'],
] as const;
for (const [re, label] of systemStateBaseline) {
  if (!re.test(desktopCss)) errors.push(`system state mismatch or missing: ${label}`);
}
const mobileSystemStateBaseline = [
  [/Async \/ empty \/ error \/ readonly state surfaces/, 'mobile system state contract'],
  [/\.fn-main \.workspace \.dz-empty/, 'mobile empty surface'],
  [/\.fn-main \.workspace \.fn-err/, 'mobile error surface'],
] as const;
for (const [re, label] of mobileSystemStateBaseline) {
  if (!re.test(cssFinal)) errors.push(`system state mismatch or missing: ${label}`);
}

const stateContractBaseline = [
  [/Interaction state consistency/, 'desktop interaction state contract'],
  [/--fp-focus-halo:/, 'desktop soft focus halo token'],
] as const;
for (const [re, label] of stateContractBaseline) {
  if (!re.test(desktopCss)) errors.push(`interaction state mismatch or missing: ${label}`);
}
const mobileStateBaseline = [
  [/Interaction state consistency \(live Admin\)/, 'mobile interaction state contract'],
  [/--ui-focus-halo:/, 'mobile soft focus halo token'],
] as const;
for (const [re, label] of mobileStateBaseline) {
  if (!re.test(cssFinal)) errors.push(`interaction state mismatch or missing: ${label}`);
}

const binding = JSON.parse(await readFile(path.join(root, 'docs/ui/ai-core-bindings.json'), 'utf8')) as {
  upstream?: { repository?: string; revision?: string; feature_registry_version?: string; required_features?: string[] };
  list_presentation?: Record<string,string>;
  policy?: { ai_core_semantics_authoritative?: boolean; product_profile_may_redefine_selection_semantics?: boolean; drift_behavior?: string };
};

const ssot = JSON.parse(await readFile(path.join(root, 'docs/ui/admin-ui-ux-ssot.json'), 'utf8')) as {
  typography?: {
    kpi?: { px?: number }; screen?: { px?: number }; panel?: { px?: number }; section?: { px?: number };
    body?: { px?: number }; support?: { px?: number }; scalePx?: number[];
  };
  spacing?: { scalePx?: number[] };
  controls?: {
    desktop?: { smallHeightPx?: number; standardHeightPx?: number; rowHeightPx?: number; topbarHeightPx?: number };
    mobile?: { standardHeightPx?: number; actionHeightPx?: number; touchMinimumPx?: number };
    radiusPx?: number; gapPx?: number;
  };
  radii?: { scalePx?: number[]; smallPx?: number; controlPx?: number; defaultPanelPx?: number };
  surfaces?: { canvas?: string; lineFree?: boolean };
  elevation?: { levels?: string[] };
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
  ['typography.kpi.px', ssot.typography?.kpi?.px, 24],
  ['typography.screen.px', ssot.typography?.screen?.px, 20],
  ['typography.panel.px', ssot.typography?.panel?.px, 18],
  ['typography.section.px', ssot.typography?.section?.px, 16],
  ['typography.body.px', ssot.typography?.body?.px, 14],
  ['typography.support.px', ssot.typography?.support?.px, 12],
  ['controls.desktop.smallHeightPx', ssot.controls?.desktop?.smallHeightPx, 32],
  ['controls.desktop.standardHeightPx', ssot.controls?.desktop?.standardHeightPx, 36],
  ['controls.desktop.rowHeightPx', ssot.controls?.desktop?.rowHeightPx, 40],
  ['controls.desktop.topbarHeightPx', ssot.controls?.desktop?.topbarHeightPx, 56],
  ['controls.mobile.standardHeightPx', ssot.controls?.mobile?.standardHeightPx, 44],
  ['controls.mobile.actionHeightPx', ssot.controls?.mobile?.actionHeightPx, 44],
  ['controls.mobile.touchMinimumPx', ssot.controls?.mobile?.touchMinimumPx, 44],
  ['controls.radiusPx', ssot.controls?.radiusPx, 6],
  ['controls.gapPx', ssot.controls?.gapPx, 8],
  ['surfaces.canvas', ssot.surfaces?.canvas, '#F2F6FC'],
  ['surfaces.lineFree', ssot.surfaces?.lineFree, true],
] as const;

for (const [name, actual, want] of expected) {
  if (actual !== want) errors.push(`docs/ui/admin-ui-ux-ssot.json: ${name}=${String(actual)}; expected ${want}`);
}

const sameArray = (a: unknown, b: unknown[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
if (!sameArray(ssot.typography?.scalePx, [12,14,16,18,20,24])) errors.push('machine SSOT: typography scale must be 12/14/16/18/20/24');
if (!sameArray(ssot.spacing?.scalePx, [4,8,12,16,20,24,32])) errors.push('machine SSOT: spacing scale must be 4/8/12/16/20/24/32');
if (!sameArray(ssot.radii?.scalePx, [4,6,8])) errors.push('machine SSOT: radius scale must be 4/6/8');
if (!sameArray(ssot.elevation?.levels, ['0','base','hover','float'])) errors.push('machine SSOT: elevation levels must be 0/base/hover/float');

if (errors.length) {
  console.error('UI/UX SSOT check FAILED');
  for (const e of errors) console.error(`- ${e}`);
  process.exitCode = 1;
} else {
  console.log('UI/UX SSOT check PASS');
  console.log(`- checked UI files: ${coreFiles.length}`);
  console.log(`- shared markup: PanelHeader / ActionBar / EmptyState / Notice / SummaryGrid`);
  console.log('- mobile baseline: 18/14/12 · control/action/touch 44 · radius 6 · gap 8');
  console.log('- desktop normalized scale: 24/20/18/16/14/12 · controls 32/36 · row 40 · topbar 56');
  console.log('- AI Core semantic authority: data.list-presentation 1.8.0');
  console.log('- list modes: product-media-row / business-row / variant-card / data-table');
  console.log(`- internal Admin UI guard files: ${internalAdminUiFiles.length}`);
  console.log(`- explicit separate-surface exceptions: ${explicitSurfaceExceptions.length} (login / supplier claim / public e-sign)`);
}

