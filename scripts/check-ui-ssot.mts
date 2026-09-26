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

/* PC 화면 CSS = 공통 규격 생성물 + 앱 고유층. 이 가상 경로를 읽으면 두 파일을 순서대로 이어 붙인다. */
const DESKTOP_CSS = 'src/app/_erp/{erp-standard,shell}.css';
const SHELL_MARK = '/* ═══ app shell.css ═══ */';
async function readSource(file: string): Promise<string> {
  if (file !== DESKTOP_CSS) return readFile(path.join(root, file), 'utf8');
  const [std, shell] = await Promise.all(['src/app/_erp/erp-standard.css', 'src/app/_erp/shell.css'].map((f) => readFile(path.join(root, f), 'utf8')));
  return `${std}\n${SHELL_MARK}\n${shell}`;
}

for (const file of coreFiles) {
  const src = await readSource(file);
  for (const rule of forbidden) {
    rule.re.lastIndex = 0;
    if (rule.re.test(src)) errors.push(`${file}: raw shared markup found; use ${rule.use}`);
  }
}

for (const file of noInlineStyleFiles) {
  const src = await readSource(file);
  if (/style=\{\{/.test(src)) errors.push(`${file}: inline visual style found; move stable UI values to globals.css / SSOT tokens`);
  if (/<style[\s>]/.test(src)) errors.push(`${file}: page-local <style> found; internal admin visuals must come from shared CSS/tokens`);
  if (/\b(?:borderRadius|boxShadow|backgroundColor|fontSize|padding|margin)\s*:/.test(src)) {
    errors.push(`${file}: page-local visual constant found; use shared component/token instead`);
  }
}

/* 내부 Admin route가 자기 시각 체계를 새로 만들지 못하게 한다.
 * 도메인 class(dz-money 등)는 허용하지만 stable visual 값은 shared CSS/token에서만 온다. */
for (const file of internalAdminUiFiles) {
  const src = await readSource(file);
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
  const src = await readSource(file);
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

/* PC 화면의 실제 CSS는 두 겹이다 — ai-core 공통 규격(erp-standard.css, 생성물)과 앱 고유층(shell.css).
 * 2026-09-25 공통 규칙을 ai-core erp.css 로 승격한 뒤로 계약은 «두 겹을 합친 결과»에 건다. */
const desktopCss = await readSource(DESKTOP_CSS);
/* 새 값 금지(off-scale)는 이 앱이 쓴 층에만 건다 — 승격된 v1.1 공통 층 + 앱 shell.css.
 * 생성물 앞부분(v1 기본 규칙)과 retro 테마는 ai-core 가 따로 검사한다(npm run erp:check). */
const desktopOwnCss = (() => {
  const start = desktopCss.indexOf('v1.1 — PC 관리자 실적용 규격');
  const shellStart = desktopCss.indexOf(SHELL_MARK);
  const retroStart = desktopCss.indexOf('/* ── themes/retro.css');
  const end = retroStart > start ? retroStart : shellStart;
  return start >= 0 && end > start && shellStart >= 0
    ? desktopCss.slice(start, end) + desktopCss.slice(shellStart)
    : desktopCss;
})();
const visualQa = await readFile(path.join(root, 'scripts/visual-qa.cjs'), 'utf8');
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
  if (re.test(desktopOwnCss)) errors.push(`desktop scale: ${label}`);
}
if (!/:focus-visible/.test(css)) errors.push('admin CSS: missing shared focus-visible behavior');
if (!/prefers-reduced-motion:\s*reduce/.test(css)) errors.push('admin CSS: missing reduced-motion behavior');

const actionRatioBaseline = [
  ['src/app/_design/Primitives.tsx', [
    /data-action-balance=\{balance\}/,
    /balance\?: 'primary' \| 'equal'/,
  ]],
  ['src/app/_erp/parts.tsx', [
    /data-action-balance=\{balance\}/,
    /balance\?: 'primary' \| 'equal'/,
  ]],
] as const;
for (const [file, rules] of actionRatioBaseline) {
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: action ratio contract missing: ${re}`);
  }
}

const actionRatioCss = [
  [/data-action-balance="primary"[\s\S]*?> \.primary[\s\S]*?order:\s*2/, 'mobile primary rightmost'],
  [/data-action-balance="equal"[\s\S]*?flex:\s*1 1 0/, 'mobile equal 5:5'],
] as const;
for (const [re, label] of actionRatioCss) {
  if (!re.test(cssFinal)) errors.push(`action ratio CSS missing: ${label}`);
}

const noWrapResponsiveBaseline = [
  [/\.erp-std \.erp-toolbar \.erp-facet-opts[\s\S]*?flex-wrap:\s*nowrap/, 'desktop quick filters nowrap'],
  [/\.quick-filters,.tabs,.offer-picker,.dz-month[\s\S]*?flex-wrap:\s*nowrap/, 'mobile choice rows nowrap'],
  [/\.fn-main \.workspace \.dz-row-body[\s\S]*?height:\s*calc\(var\(--ui-card-line-h\) \* 3 \+ var\(--ui-card-line-gap\) \* 2\)/, 'mobile three-line body fixed at 64px'],
] as const;
for (const [re, label] of noWrapResponsiveBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`no-wrap responsive contract missing: ${label}`);
}

const compactSignalBaseline = [
  ['src/app/_erp/parts.tsx', /data-thumb-status=\{thumbStatus \? 'true' : undefined\}/, 'status-thumbnail marker'],
  [DESKTOP_CSS, /\.erp-rowcard\[data-thumb-status="true"\][\s\S]*?\.erp-rowcard-title > \.erp-badge[\s\S]*?display:\s*none/, 'compact duplicate badge suppression'],
] as const;
for (const [file, re, label] of compactSignalBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: compact signal contract missing: ${label}`);
}

const brandRestraintBaseline = [
  [/--erp-color-primary:\s*#1B2A4A/i, 'desktop primary navy #1B2A4A'],
  [/--erp-color-primary-weak:\s*#EEF3FA/i, 'desktop primary weak #EEF3FA'],
  [/\.erp-tile--pressable\[aria-pressed="true"\][\s\S]*?color:\s*var\(--erp-color-text\)/, 'selected tile text stays neutral'],
] as const;
for (const [re, label] of brandRestraintBaseline) {
  if (!re.test(desktopCss)) errors.push(`brand restraint missing: ${label}`);
}

const detailPanelRhythmBaseline = [
  [/\.erp-std \.erp-detail-body[\s\S]*?padding:\s*var\(--erp-sp-3\)/, 'detail body padding 12px'],
  [/\.erp-std \.erp-subtitle[\s\S]*?margin:\s*0 0 var\(--erp-sp-2\)/, 'subtitle gap 8px'],
  [/\.erp-std \.erp-tile-title[\s\S]*?border-bottom:\s*0/, 'tile title line-free'],
  [/\.erp-std \.erp-info-card dl[\s\S]*?gap:\s*var\(--erp-sp-2\)/, 'detail info gap 8px'],
] as const;
for (const [re, label] of detailPanelRhythmBaseline) {
  if (!re.test(desktopCss)) errors.push(`detail panel rhythm missing: ${label}`);
}

const fullWidthLayoutBaseline = [
  [/--fp-workspace-gutter-x:\s*20px/, 'desktop standard gutter 20px'],
  [/--fp-workspace-gutter-y:\s*16px/, 'desktop standard gutter y 16px'],
  [/--ui-screen-gutter:\s*16px/, 'mobile gutter 16px'],
  [/--ui-screen-gutter-narrow:\s*12px/, 'mobile narrow gutter 12px'],
] as const;
for (const [re, label] of fullWidthLayoutBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`full-width layout contract missing: ${label}`);
}

const quickFilterVisualBaseline = [
  [/--ui-quick-filter-h:\s*34px/, 'mobile quick filter visual height 34px'],
  [/\.quick-filters[\s\S]*?min-height:\s*var\(--ui-touch-min\)/, 'quick filter row touch height 44px'],
  [/\.quick-filters a[\s\S]*?border-radius:\s*999px/, 'mobile quick filter pill radius'],
] as const;
for (const [re, label] of quickFilterVisualBaseline) {
  if (!re.test(cssFinal)) errors.push(`quick filter visual contract missing: ${label}`);
}

const cardRhythmBaseline = [
  [/64px visual tile contract/, 'desktop compact list visual tile 64px'],
  [/--erp-row-standard-min-h:\s*72px/, 'desktop standard card min 72px'],
  [/--ui-row-min-h:\s*88px/, 'mobile card min 88px'],
  [/--ui-list-gap:\s*12px/, 'mobile list gap 12px'],
] as const;
for (const [re, label] of cardRhythmBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`card rhythm mismatch: ${label}`);
}

const panelCardSurfaceBaseline = [
  [/--erp-color-surface-soft:\s*#F7F9FC/i, 'desktop card surface #F7F9FC'],
  [/--ui-component-surface:\s*#F7F9FC/i, 'mobile card surface #F7F9FC'],
  [/--erp-color-surface:\s*#FFFFFF/i, 'desktop panel surface #FFFFFF'],
  [/--ui-surface:\s*#FFFFFF/i, 'mobile panel surface #FFFFFF'],
] as const;
for (const [re, label] of panelCardSurfaceBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`panel/card surface mismatch: ${label}`);
}

const businessFlowBaseline = [
  ['src/domain/settlement/types.ts', [
    /export function adminWorkflowPhaseOf/,
    /'접수 진행'/,
    /'공급사 청구'/,
    /'공급사 수금'/,
    /'영업자 지급'/,
    /export function adminBlockLabel/,
  ]],
  ['src/app/_erp/SettlementDetail.tsx', [
    /adminWorkflowPhaseOf/,
    /adminBlockLabel/,
  ]],
  ['src/app/intake/IntakeDetailPanel.tsx', [
    /adminWorkflowPhaseOf/,
    /업무 흐름 · \{업무흐름\}/,
  ]],
] as const;
for (const [file, rules] of businessFlowBaseline) {
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: business flow contract missing: ${re}`);
  }
}

const desktopSettlementFocusBaseline = [
  ['src/app/_erp/SettlementScreen.tsx', [
    /locateSettlementFocus/,
    /focus: r\.id/,
    /<SettlementDetail cur=\{focusedLine\.row\}/,
  ]],
  ['src/app/_erp/SettlementDetail.tsx', [
    /settlementPrimaryAction/,
    /<LifeForm/,
    /<SideStep/,
    /정산 묶음으로/,
    /data-detail-context=\{life \? 'settlement-focus' : 'intake'\}/,
    /data-detail-priority="core"/,
    /<details className="erp-tile erp-detail-support">/,
    /정산 핵심/,
  ]],
] as const;
for (const [file, rules] of desktopSettlementFocusBaseline) {
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: desktop settlement focus contract missing: ${re}`);
  }
}
const settlementDesktopSourceForRoute = await readSource('src/app/_erp/SettlementScreen.tsx');
if (/\/intake\?ic=/.test(settlementDesktopSourceForRoute)) {
  errors.push('SettlementScreen.tsx: desktop settlement row must stay on /settlement focus context');
}
const settlementDetailSourceForDensity = await readSource('src/app/_erp/SettlementDetail.tsx');
const focusStart = settlementDetailSourceForDensity.indexOf('{life ? (');
const focusEnd = settlementDetailSourceForDensity.indexOf(') : (', focusStart);
if (focusStart < 0 || focusEnd < 0 || /<IntakeProgress/.test(settlementDetailSourceForDensity.slice(focusStart, focusEnd))) {
  errors.push('SettlementDetail.tsx: focused settlement detail must not repeat intake mutation controls');
}

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
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: terminology contract missing: ${re}`);
  }
}

const motionBaseline = [
  [/--erp-motion-press:\s*80ms/, 'desktop press motion 80ms'],
  [/--erp-motion-state:\s*120ms/, 'desktop state motion 120ms'],
  [/--erp-motion-float:\s*160ms/, 'desktop float motion 160ms'],
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
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: action risk contract missing: ${re}`);
  }
}

const formContractBaseline = [
  ['src/app/intake/new/IntakeForm.tsx', [
    /className="dz-errs" role="alert" aria-live="assertive"/,
    /aria-busy=\{pending\}/,
    /disabled=\{(?:disabled \|\| )?pending\}/,
    /저장 중…/,
  ]],
  ['src/app/settlement/LifeForms.tsx', [
    /className="dz-errs" role="alert" aria-live="assertive"/,
    /aria-busy=\{pending\}/,
  ]],
] as const;
for (const [file, rules] of formContractBaseline) {
  const src = await readSource(file);
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
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: accessibility behavior missing: ${re}`);
  }
}

const iconTouchBaseline = [
  [/--erp-icon-hit:\s*36px/, 'desktop icon-only hit area 36px'],
  [/--erp-icon-nav:\s*18px/, 'desktop action glyph 18px'],
  [/--ui-icon-action:\s*20px/, 'mobile action glyph 20px'],
  [/\.dz-phone-back[\s\S]*?width:\s*var\(--ui-touch-min\)[\s\S]*?height:\s*var\(--ui-touch-min\)/, 'mobile back hit area uses touch minimum'],
] as const;
for (const [re, label] of iconTouchBaseline) {
  const target = label.startsWith('desktop') ? desktopCss : cssFinal;
  if (!re.test(target)) errors.push(`icon/touch mismatch or missing: ${label}`);
}

const contrastBaseline = [
  [/--erp-color-text-muted:\s*#667085/i, 'desktop muted text #667085'],
  [/--erp-color-nav-text:\s*#AEB9CA/i, 'desktop nav text #AEB9CA'],
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
  const src = await readSource(file);
  for (const re of rules) {
    if (!re.test(src)) errors.push(`${file}: page QA structural invariant missing: ${re}`);
  }
}


const liveAdminScaleBaseline = [
  [/--ui-panel-pad:\s*20px/, 'shared panel padding 20px'],
  [/--ui-panel-pad-mobile:\s*16px/, 'mobile panel padding 16px'],
  [/--ui-list-gap:\s*12px/, 'list gap 12px'],
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
  [/--erp-color-canvas:\s*#F2F6FC/i, 'desktop canvas #F2F6FC'],
  [/--erp-color-surface-soft:\s*#F7F9FC/i, 'desktop component surface #F7F9FC'],
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
  [/--erp-row-compact-min-h:\s*84px/, 'desktop compact row 84px'],
  [/--erp-panel-head-h:\s*44px/, 'desktop panel head 44px'],
  [/--erp-query-row-h:\s*48px/, 'desktop query row 48px'],
  [/--erp-quick-row-h:\s*40px/, 'desktop quick filter row 48px'],
  [/--erp-panel-foot-h:\s*56px/, 'desktop panel foot 56px'],
  [/64px visual tile contract/, 'desktop compact visual tile 64px'],
  [/--erp-row-standard-min-h:\s*72px/, 'desktop standard row 72px'],
] as const;
for (const [re, label] of densityBaseline) {
  if (!re.test(desktopCss)) errors.push(`density mismatch or missing: ${label}`);
}
const mobileDensityBaseline = [
  [/--ui-panel-head-h:\s*52px/, 'mobile panel head 52px'],
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
  [/--erp-focus-halo:/, 'desktop soft focus halo token'],
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

/* QuickFilter business items are provisional until the user configures them.
 * Guard the current admin from silently expanding example chips into a full taxonomy. */
const quickFilterPolicyBaseline = [
  ['src/app/_erp/Workspace.tsx', /QuickFilter 업무 항목은 아직 확정 전/, 'intake quick filters explicitly provisional'],
  ['src/app/_erp/SettlementScreen.tsx', /상태 QuickFilter 업무 항목은 미확정/, 'settlement quick filters explicitly provisional'],
  ['src/app/_erp/EsignScreen.tsx', /전자서명 QuickFilter 업무 항목은 미확정/, 'e-sign quick filters explicitly provisional'],
] as const;
for (const [file, re, label] of quickFilterPolicyBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: quick filter provisional contract missing: ${label}`);
}

const naturalTypographyBaseline = [
  [/Natural ERP typography roles/, 'desktop natural ERP typography role block'],
  [/\.erp-panel-head h2 \{ font-size: var\(--erp-fs-body\); \}/, 'panel title role size'],
  [/\.erp-rowcard-title,[\s\S]*?\.erp-facet-opt,[\s\S]*?font-size: var\(--erp-fs-body\)/, 'card/control body size role'],
  [/\.erp-rowcard-amount strong,.erp-tile-row strong\) \{ font-size: var\(--erp-fs-body\); \}/, 'primary value body size'],
] as const;
for (const [re, label] of naturalTypographyBaseline) {
  if (!re.test(desktopCss)) errors.push(`natural typography contract missing: ${label}`);
}

const mobileNaturalTypographyBaseline = [
  [/Natural ERP typography roles \(mobile\/live\)/, 'mobile natural ERP typography role block'],
  [/\.panel-head h1 \{ font-size: var\(--글메인\); \}/, 'mobile panel title role size'],
  [/\.quick-filters a,[\s\S]*?input, select, textarea[\s\S]*?font-size: var\(--글메인\)/, 'mobile body/control role size'],
  [/\.dz-badge[\s\S]*?font-size: var\(--글보조\)/, 'mobile support/badge role size'],
] as const;
for (const [re, label] of mobileNaturalTypographyBaseline) {
  if (!re.test(cssFinal)) errors.push(`mobile natural typography contract missing: ${label}`);
}

const typographyVisualQaBaseline = [
  [/fontSamples: \(\(\) => \{/, 'visual QA font samples'],
  [/mobile panel title/, 'visual QA mobile panel title range'],
  [/desktop primary value/, 'visual QA desktop primary value range'],
] as const;
for (const [re, label] of typographyVisualQaBaseline) {
  if (!re.test(visualQa)) errors.push(`typography visual QA missing: ${label}`);
}

const solidMaterialityBaseline = [
  [/Solid commercial ERP materiality/, 'desktop solid ERP materiality block'],
  [/\.erp-std \.erp-panel \{\s*box-shadow:\s*none;/s, 'desktop panel rests flat'],
  [/Solid commercial ERP materiality \(mobile\/live\)/, 'mobile solid ERP materiality block'],
  [/resting panel has outer shadow/, 'visual QA resting panel shadow guard'],
  [/selected card\/tile has outer shadow/, 'visual QA selected outer shadow guard'],
] as const;
for (const [re, label] of solidMaterialityBaseline) {
  const target = /visual QA/.test(label) ? visualQa : `${desktopCss}\n${cssFinal}`;
  if (!re.test(target)) errors.push(`solid materiality contract missing: ${label}`);
}

const geometryContractBaseline = [
  [/2026-09-25 — Geometry contract/, 'desktop geometry contract block'],
  [/\.erp-std \.erp-panel \{[\s\S]*?border-radius: var\(--erp-r-lg\)/, 'desktop panel radius 8 role'],
  [/\.erp-std :is\(\.erp-rowcard,\.erp-tile,\.erp-listcard,\.erp-kpi\) \{[\s\S]*?border-radius: var\(--erp-r-md\)/, 'desktop card radius 6 role'],
  [/\.erp-std \.erp-rowcard \{[\s\S]*?padding: var\(--erp-sp-3\)/, 'desktop card padding 12'],
  [/Geometry contract \(mobile\/live\)/, 'mobile geometry contract block'],
  [/\.fn-main \.workspace > \.panel \{[\s\S]*?border-radius: 0/, 'mobile panel radius 0'],
  [/panel radius mismatch/, 'visual QA panel radius check'],
  [/card horizontal padding mismatch/, 'visual QA card padding check'],
] as const;
for (const [re, label] of geometryContractBaseline) {
  const target = /visual QA/.test(label) ? visualQa : `${desktopCss}\n${cssFinal}`;
  if (!re.test(target)) errors.push(`geometry contract missing: ${label}`);
}

const cardLineContractBaseline = [
  [/2026-09-25 — Card line contract/, 'desktop card line contract block'],
  [/--erp-card-line-h:\s*20px/, 'desktop card line height 20'],
  [/--erp-card-line-gap:\s*2px/, 'desktop card line gap 2'],
  [/grid-auto-rows:\s*var\(--erp-card-line-h\)/, 'desktop compact card consistent line rhythm'],
  [/Card line contract \(mobile\/live\)/, 'mobile card line contract block'],
  [/--ui-card-line-h:\s*20px/, 'mobile card line height 20'],
  [/--ui-card-line-gap:\s*2px/, 'mobile card line gap 2'],
  [/card line-height mismatch/, 'visual QA card line-height guard'],
  [/card line role grew vertically/, 'visual QA per-line wrap guard'],
] as const;
for (const [re, label] of cardLineContractBaseline) {
  const target = /visual QA/.test(label) ? visualQa : `${desktopCss}\n${cssFinal}`;
  if (!re.test(target)) errors.push(`card line contract missing: ${label}`);
}

const cardPriorityBaseline = [
  ['src/app/_erp/ProductsScreen.tsx', /meta=\{`\$\{offer\.termMonths\}개월 · 보증 /, 'product card term/deposit priority line'],
  ['src/app/_erp/ProductsScreen.tsx', /amount=\{`월 \$\{manWon\(offer\.monthlyRent\)\} 원`\}/, 'product list natural monthly rent display'],
] as const;
for (const [file, re, label] of cardPriorityBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: priority-driven card lines missing: ${label}`);
}

const listAmountLanguageBaseline = [
  ['src/app/_erp/ProductsScreen.tsx', /월 \$\{manWon\(offer\.monthlyRent\)\} 원/, 'product monthly rent may be compact'],
  ['src/app/_erp/Workspace.tsx', /월 \$\{manWon\(r\.rent\)\} 원/, 'intake monthly rent may be compact'],
  ['src/app/_erp/Workspace.tsx', /수수료 청구[\s\S]*won0\(r\.money\.claim\)[\s\S]*지급[\s\S]*won0\(r\.money\.pay\)/, 'intake fees stay exact'],
  ['src/app/_erp/SettlementScreen.tsx', /정산 \$\{won0\(g\.net\)\}원/, 'settlement total stays exact'],
  ['src/app/_erp/SettlementScreen.tsx', /(?=[\s\S]*청구 수수료)(?=[\s\S]*won0\(r\.money\.claim\))(?=[\s\S]*지급 수수료)(?=[\s\S]*won0\(r\.money\.pay\))/, 'settlement line fees stay exact'],
  ['src/app/_erp/EsignScreen.tsx', /월 \$\{manWon\(c\.rent\)\} 원/, 'e-sign monthly rent may be compact'],
] as const;
for (const [file, re, label] of listAmountLanguageBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: list amount language mismatch: ${label}`);
}

const cardInformationMatrixBaseline = [
  ['src/app/_erp/ProductsScreen.tsx', /subId=\{txt\(p\.registration\?\.vehicleNumber\)\} sub=\{txt\(p\.productKind\)\}/, 'product key line'],
  ['src/app/_erp/ProductsScreen.tsx', /meta=\{`\$\{offer\.termMonths\}개월 · 보증 /, 'product support line'],
  ['src/app/_erp/Workspace.tsx', /subId=\{txt\(r\.plate\)\} sub=\{`\$\{txt\(r\.model\)\} · \$\{txt\(r\.product\)\} · \$\{r\.term \?\? '—'\}개월`\}/, 'intake/performance key line'],
  ['src/app/_erp/Workspace.tsx', /meta=\{`수수료 청구 /, 'intake/performance support line'],
  ['src/app/_erp/SettlementScreen.tsx', /sub=\{`\$\{name\} \$\{g\.done\}\/\$\{g\.lines\.length\}`\}/, 'settlement group key line'],
  ['src/app/_erp/SettlementScreen.tsx', /meta=\{settlementGroupSupport\(g, side\)\}/, 'settlement group support line'],
  ['src/app/settlement/group-signal.ts', /g\.unknown[\s\S]*g\.broken[\s\S]*correction[\s\S]*g\.hold[\s\S]*g\.clawbacks\.length/, 'settlement support signal authority'],
  ['src/app/_erp/SettlementScreen.tsx', /meta=\{tab === 'claim'/, 'settlement opposite-axis support line'],
  ['src/app/_erp/EsignScreen.tsx', /meta=\{`\$\{c\.term \? `\$\{c\.term\}개월` : '—'\} · \$\{txt\(c\.status\)\}`\}/, 'e-sign support line'],
] as const;
for (const [file, re, label] of cardInformationMatrixBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: strict three-line card matrix mismatch: ${label}`);
}

// Profit/margin is detail-owned by default and must not be promoted into list-card amount text.
const workspaceForListPolicy = await readFile(path.join(root, 'src/app/_erp/Workspace.tsx'), 'utf8');
if (/amount=\{`남는 /.test(workspaceForListPolicy)) errors.push('Workspace.tsx: profit/margin must not be a default list-card amount');


const threeLineCardGrammarBaseline = [
  ['src/app/_erp/parts.tsx', /data-line-role="main"/, 'row card main role'],
  ['src/app/_erp/parts.tsx', /data-line-role="key"/, 'row card key role'],
  ['src/app/_erp/parts.tsx', /data-line-role="support"/, 'row card support role'],
  [DESKTOP_CSS, /Three-line list card semantics/, 'three-line semantic style block'],
  ['src/app/_erp/Workspace.tsx', /subId=\{txt\(r\.plate\)\} sub=\{`\$\{txt\(r\.model\)\} · \$\{txt\(r\.product\)\} · \$\{r\.term \?\? '—'\}개월`\}/, 'intake key line'],
  ['src/app/_erp/Workspace.tsx', /meta=\{`수수료 청구/, 'intake support fee line'],
  ['src/app/_erp/SettlementScreen.tsx', /meta=\{tab === 'claim'/, 'settlement opposite-axis support fee'],
] as const;
for (const [file, re, label] of threeLineCardGrammarBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: three-line card grammar mismatch: ${label}`);
}

const settlementFeeAxisBaseline = [
  [/amount=\{tab === 'claim'/, 'active axis chooses main fee amount'],
  [/청구 수수료/, 'claim fee label present'],
  [/지급 수수료/, 'pay fee label present'],
  [/meta=\{tab === 'claim'/, 'opposite axis chooses support fee'],
] as const;
const settlementUiSource = await readFile(path.join(root, 'src/app/_erp/SettlementScreen.tsx'), 'utf8');
for (const [re, label] of settlementFeeAxisBaseline) {
  if (!re.test(settlementUiSource)) errors.push(`SettlementScreen.tsx: settlement fee axis mismatch: ${label}`);
}

const strictThreeLineNoEscapeBaseline = [
  ['src/app/_erp/parts.tsx', /data-line-role="main"/, 'main slot exists'],
  ['src/app/_erp/parts.tsx', /data-line-role="key"/, 'key slot exists'],
  ['src/app/_erp/parts.tsx', /data-line-role="support"/, 'support slot exists'],
  ['src/app/_design/ListRow.tsx', /data-line-role="main"/, 'mobile main slot exists'],
  ['src/app/_design/ListRow.tsx', /data-line-role="key"/, 'mobile key slot exists'],
  ['src/app/_design/ListRow.tsx', /data-line-role="support"/, 'mobile support slot exists'],
  ['scripts/visual-qa.cjs', /list card must be exactly Main\/Key\/Support/, 'visual QA exact three-line guard'],
] as const;
for (const [file, re, label] of strictThreeLineNoEscapeBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: strict three-line card contract missing: ${label}`);
}
const rowCardSource = await readFile(path.join(root, 'src/app/_erp/parts.tsx'), 'utf8');
if (/lines\?:\s*ReactNode\[\]/.test(rowCardSource) || /erp-rowcard-line/.test(rowCardSource)) {
  errors.push('RowCard: arbitrary fourth-line escape hatch must not exist');
}
for (const file of ['src/app/_erp/ProductsScreen.tsx','src/app/_erp/Workspace.tsx','src/app/_erp/SettlementScreen.tsx','src/app/_erp/EsignScreen.tsx']) {
  const src = await readSource(file);
  if (/\blines=\{/.test(src)) errors.push(`${file}: list cards must not add a fourth information line`);
}

const listVisualTileBaseline = [
  ['scripts/visual-qa.cjs', /list card outer height mismatch/, 'visual QA list-card outer height guard'],
  [DESKTOP_CSS, /64px visual tile contract/, 'desktop 64px visual tile contract'],
  ['src/app/_design/admin-final.css', /64px visual parity \(mobile\/live\)/, 'mobile 64px visual tile contract'],
  ['src/app/_erp/ProductDetail.tsx', /export function ProductThumb/, 'product thumbnail helper'],
  ['src/app/_erp/parts.tsx', /thumbStatus \? null : badge/, 'desktop duplicate status badge suppression'],
  ['src/app/_design/ListRow.tsx', /!status && badge/, 'mobile duplicate status badge suppression'],
  ['scripts/visual-qa.cjs', /list visual tile must be 64x64/, 'visual QA 64px tile guard'],
] as const;
for (const [file, re, label] of listVisualTileBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: list visual tile contract missing: ${label}`);
}

const crossShellListParityBaseline = [
  ['src/app/_design/ListRow.tsx', /mainValue\?: ReactNode/, 'mobile main-right primary value slot'],
  ['src/app/products/workspace.tsx', /mainValue=\{o \? `월 /, 'mobile product monthly rent main value'],
  ['src/app/products/workspace.tsx', /meta=\{\[txt\(p\.registration\?\.vehicleNumber\), txt\(p\.productKind\)(?:, txt\(p\.status\))?\]/, 'mobile product key line'],
  ['src/app/products/workspace.tsx', /value=\{o \? `\$\{o\.termMonths\}개월 · 보증 /, 'mobile product support line'],
  ['src/app/products/workspace.tsx', /mainValue=\{r\.rent \? `월 /, 'mobile intake monthly rent main value'],
  ['src/app/products/workspace.tsx', /value=\{`청구 \$\{r\.money\.claim/, 'mobile intake exact fee support'],
  ['src/app/settlement/page.tsx', /mainValue=\{tab === 'claim'/, 'mobile settlement active-axis main fee'],
  ['src/app/settlement/page.tsx', /value=\{tab === 'claim'/, 'mobile settlement opposite-axis support fee'],
  ['src/app/esign/page.tsx', /mainValue=\{c\.rent === null/, 'mobile esign monthly rent main value'],
] as const;
for (const [file, re, label] of crossShellListParityBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: cross-shell list parity mismatch: ${label}`);
}

const statusTileToneBaseline = [
  [DESKTOP_CSS, /Status tile semantic tones/, 'desktop status tile tones'],
  [DESKTOP_CSS, /data-tone="info"[\s\S]*?var\(--erp-color-primary-weak\)[\s\S]*?var\(--erp-color-primary\)/, 'desktop info/navy tile'],
  [DESKTOP_CSS, /data-tone="ok"[\s\S]*?var\(--erp-color-ok-bg\)[\s\S]*?var\(--erp-color-ok\)/, 'desktop ok/green tile'],
  [DESKTOP_CSS, /data-tone="warn"[\s\S]*?var\(--erp-color-warn-bg\)[\s\S]*?var\(--erp-color-warn\)/, 'desktop warn/amber tile'],
  [DESKTOP_CSS, /data-tone="err"[\s\S]*?var\(--erp-color-err-bg\)[\s\S]*?var\(--erp-color-err\)/, 'desktop err/red tile'],
  ['src/app/globals.css', /\.dz-row-status\.navy[\s\S]*?\.dz-row-status\.green[\s\S]*?\.dz-row-status\.red[\s\S]*?\.dz-row-status\.grey[\s\S]*?\.dz-row-status\.amber/, 'mobile status tile semantic tones'],
] as const;
for (const [file, re, label] of statusTileToneBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: status tile tone contract missing: ${label}`);
}

const embeddedOfferListBaseline = [
  ['src/app/_erp/ProductDetail.tsx', /className="erp-offer-list"/, 'product detail embedded offer list'],
  ['src/app/_erp/ProductDetail.tsx', /className="erp-offer-card"/, 'selectable offer card'],
  ['src/app/_erp/ProductDetail.tsx', /aria-current=\{selected \? 'true' : undefined\}/, 'offer selected state'],
  ['src/app/_erp/ProductDetail.tsx', /className="erp-offer-term"/, 'one-line offer term'],
  ['src/app/_erp/ProductDetail.tsx', /className="erp-offer-rent"/, 'one-line offer monthly rent'],
  ['src/app/_erp/ProductDetail.tsx', /className="erp-offer-conditions"/, 'one-line offer conditions'],
  [DESKTOP_CSS, /\.erp-std \.erp-offer-list[\s\S]*?\.erp-std \.erp-offer-card/, 'offer list styling contract'],
] as const;
for (const [file, re, label] of embeddedOfferListBaseline) {
  const src = await readSource(file);
  if (!re.test(src)) errors.push(`${file}: embedded offer-list contract missing: ${label}`);
}
const productDetailOfferSource = await readFile(path.join(root, 'src/app/_erp/ProductDetail.tsx'), 'utf8');
if (/선택됨|체크|check/i.test(productDetailOfferSource)) errors.push('ProductDetail: offer card must not render a check icon or redundant selected text');

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
  elevation?: { base?: string; hover?: string; float?: string };
  listPresentation?: { authorityFeature?: string; modes?: Record<string,string> };
};

const presentationExpected = [
  ['ssot.listPresentation.authorityFeature', ssot.listPresentation?.authorityFeature, 'data.list-presentation'],
  ['list.product', ssot.listPresentation?.modes?.productCatalog, 'product-media-row'],
  ['list.application', ssot.listPresentation?.modes?.application, 'business-row'],
  ['list.performance', ssot.listPresentation?.modes?.performance, 'business-row'],
  ['list.billing', ssot.listPresentation?.modes?.billing, 'business-row'],
  ['list.payout', ssot.listPresentation?.modes?.payout, 'business-row'],
  ['list.offer', ssot.listPresentation?.modes?.offer, 'variant-card'],
] as const;
for (const [name, actual, want] of presentationExpected) {
  if (actual !== want) errors.push(`UI list-presentation contract mismatch: ${name}=${String(actual)}; expected ${String(want)}`);
}

const listRow = await readFile(path.join(root, 'src/app/_design/ListRow.tsx'), 'utf8');
const offerPicker = await readFile(path.join(root, 'src/app/_design/OfferPicker.tsx'), 'utf8');
if (!/data-ai-feature="data\.list-presentation"/.test(listRow)) errors.push('ListRow: missing data.list-presentation semantic marker');
if (!/product-media-row/.test(listRow) || !/business-row/.test(listRow)) errors.push('ListRow: missing product-media-row/business-row semantic modes');
if (!/data-ai-list-mode="variant-card"/.test(offerPicker)) errors.push('OfferPicker: missing variant-card semantic mode');

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
if (!ssot.elevation?.base || !ssot.elevation?.hover || !ssot.elevation?.float) errors.push('machine SSOT: elevation must define base/hover/float');

if (errors.length) {
  console.error('UI/UX SSOT check FAILED');
  for (const e of errors) console.error(`- ${e}`);
  process.exitCode = 1;
} else {
  console.log('UI/UX SSOT check PASS');
  console.log(`- checked UI files: ${coreFiles.length}`);
  console.log(`- shared markup: PanelHeader / ActionBar / EmptyState / Notice / SummaryGrid`);
  console.log('- mobile operational typography: 14/12 · control/action/touch 44 · radius 6 · gap 8');
  console.log('- desktop operational typography: 14/12 first · larger tiers reserved for explicit exceptions');
  console.log('- list-presentation semantic contract: product / business / variant modes');
  console.log('- list modes: product-media-row / business-row / variant-card / data-table');
  console.log(`- internal Admin UI guard files: ${internalAdminUiFiles.length}`);
  console.log(`- explicit separate-surface exceptions: ${explicitSurfaceExceptions.length} (login / supplier claim / public e-sign)`);
}

