#!/usr/bin/env node
/**
 * FreePass Admin visual QA harness.
 *
 * Usage:
 *   NODE_PATH=/opt/node22/lib/node_modules npm run visual:qa -- http://localhost:3000
 *
 * Optional env:
 *   PW_CHROMIUM=/opt/pw-browsers/chromium/chrome-linux/chrome
 *   VISUAL_QA_OUT=artifacts/visual-qa
 *
 * This intentionally stays outside CI until Playwright is a project dependency.
 */
const fs = require('node:fs');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('visual:qa requires Playwright.');
  console.error('Managed dev env: NODE_PATH=/opt/node22/lib/node_modules npm run visual:qa -- http://localhost:3000');
  process.exit(2);
}

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const outDir = process.env.VISUAL_QA_OUT || path.join(process.cwd(), 'artifacts', 'visual-qa');
const executablePath = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium/chrome-linux/chrome';

const cases = [
  { name: 'products-desktop-1440', route: '/products', width: 1440, height: 900 },
  { name: 'products-desktop-1280', route: '/products', width: 1280, height: 800 },
  { name: 'intake-desktop-1440', route: '/intake', width: 1440, height: 900 },
  { name: 'settlement-desktop-1440', route: '/settlement', width: 1440, height: 900 },
  { name: 'esign-desktop-1440', route: '/esign', width: 1440, height: 900 },
  { name: 'products-mobile-390', route: '/products', width: 390, height: 844 },
  { name: 'intake-mobile-390', route: '/intake', width: 390, height: 844 },
  { name: 'settlement-mobile-390', route: '/settlement', width: 390, height: 844 },
  { name: 'esign-mobile-390', route: '/esign', width: 390, height: 844 },
  { name: 'products-mobile-360', route: '/products', width: 360, height: 800 },
  { name: 'intake-mobile-360', route: '/intake', width: 360, height: 800 },
];

function rgbLuminance(rgb) {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  if (!m) return null;
  const c = [m[1], m[2], m[3]].map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(fg, bg) {
  const a = rgbLuminance(fg);
  const b = rgbLuminance(bg);
  if (a === null || b === null) return null;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

async function inspect(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity || 1) > 0;
    };
    const styleOf = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        color: s.color,
        backgroundColor: s.backgroundColor,
        opacity: s.opacity,
        visible: visible(el),
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      };
    };
    const pick = (selector) => [...document.querySelectorAll(selector)].filter(visible).slice(0, 24).map(styleOf);
    return {
      title: document.title,
      url: location.href,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      selected: pick('[aria-pressed="true"], [aria-current="true"], [aria-current="page"]'),
      primary: pick('.erp-btn--primary, button.primary, a.primary'),
      panels: pick('.erp-panel, .panel'),
      cards: pick('.erp-rowcard, .erp-tile, .dz-row'),
      cardMetrics: (() => {
        const card = [...document.querySelectorAll('.erp-rowcard, .dz-row')].find(visible);
        const amount = card?.querySelector('.erp-rowcard-amount, .dz-row-l3 > strong, .dz-row-l2.value strong');
        if (!card) return null;
        const cs = getComputedStyle(card);
        const as = amount ? getComputedStyle(amount) : null;
        const r = card.getBoundingClientRect();
        return {
          paddingTop: parseFloat(cs.paddingTop) || 0,
          paddingRight: parseFloat(cs.paddingRight) || 0,
          paddingBottom: parseFloat(cs.paddingBottom) || 0,
          paddingLeft: parseFloat(cs.paddingLeft) || 0,
          rowGap: parseFloat(cs.rowGap) || 0,
          columnGap: parseFloat(cs.columnGap) || 0,
          height: Math.round(r.height),
          amountTextAlign: as?.textAlign ?? null,
          amountFontVariantNumeric: as?.fontVariantNumeric ?? null,
        };
      })(),
      actionBars: (() => {
        const bars = [...document.querySelectorAll(
          '.erp-panel-foot[data-action-balance], .dz-bar-go[data-action-balance]'
        )].filter(visible);
        return bars.map((bar, index) => {
          const balance = bar.getAttribute('data-action-balance') || 'primary';
          const actions = [...bar.children].filter((el) =>
            visible(el) && el.matches('.erp-btn, .primary, .dz-bar-sub, button, a')
          ).map((el, i) => {
            const r = el.getBoundingClientRect();
            return {
              index: i,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
              width: Math.round(r.width),
              left: Math.round(r.left),
              right: Math.round(r.right),
              primary: el.classList.contains('erp-btn--primary') || el.classList.contains('primary'),
            };
          });
          return { index, balance, actions };
        }).filter((x) => x.actions.length > 0);
      })(),
      panelWidths: (() => {
        const panels = [...document.querySelectorAll('.erp-workspace > .erp-panel, .workspace > .panel')].filter(visible);
        return panels.map((panel, index) => {
          const r = panel.getBoundingClientRect();
          return {
            index,
            width: Math.round(r.width),
            compact: panel.classList.contains('erp-panel--compact') || panel.dataset.panelRole === 'list',
            wide: panel.classList.contains('erp-panel--wide'),
          };
        });
      })(),
      panelRhythm: (() => {
        const panels = [...document.querySelectorAll('.erp-panel, .panel')].filter(visible).slice(0, 6);
        return panels.map((panel, index) => {
          const rectOf = (selector) => {
            const el = panel.querySelector(selector);
            if (!el || !visible(el)) return null;
            const r = el.getBoundingClientRect();
            return {
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              height: Math.round(r.height),
            };
          };
          const p = panel.getBoundingClientRect();
          return {
            index,
            panelTop: Math.round(p.top),
            panelBottom: Math.round(p.bottom),
            panelHeight: Math.round(p.height),
            head: rectOf('.erp-panel-head, .panel-head'),
            search: rectOf('.erp-searchbar, .dz-find'),
            quick: rectOf('.erp-toolbar, .quick-filters'),
            foot: rectOf('.erp-panel-foot, .dz-bar'),
          };
        });
      })(),
      scrollTopology: (() => {
        const panels = [...document.querySelectorAll('.erp-panel, .panel')].filter(visible).slice(0, 6);
        return panels.map((panel, index) => {
          const nodes = [panel, ...panel.querySelectorAll('*')];
          const verticalScrollers = nodes.filter((el) => {
            const s = getComputedStyle(el);
            const oy = s.overflowY;
            return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
          }).map((el) => ({
            tag: el.tagName,
            className: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          }));
          return { index, verticalScrollers };
        });
      })(),
      cardInteraction: (() => {
        const row = [...document.querySelectorAll('.erp-rowcard, .dz-row')].find(visible);
        const passive = [...document.querySelectorAll('.erp-tile:not(.erp-tile--pressable)')].find(visible);
        let rowHit = null;
        if (row) {
          const r = row.getBoundingClientRect();
          const points = [
            [r.left + r.width / 2, r.top + r.height / 2],
            [r.left + 8, r.top + 8],
            [r.right - 8, r.bottom - 8],
          ];
          rowHit = points.map(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            const a = hit?.closest?.('a');
            return {
              x: Math.round(x),
              y: Math.round(y),
              tag: hit?.tagName ?? null,
              link: a?.getAttribute('href') ?? null,
              insideRow: !!hit && row.contains(hit),
            };
          });
        }
        return {
          rowHit,
          passiveCursor: passive ? getComputedStyle(passive).cursor : null,
        };
      })(),
      surfaceSamples: {
        panel: pick('.erp-panel, .panel').slice(0, 4),
        card: pick('.erp-rowcard, .erp-tile, .dz-row').slice(0, 8),
      },
    };
  });
}

async function captureState(page, caseName, stateName, selector, action = 'click') {
  const el = page.locator(selector).first();
  if (!(await el.count())) {
    return { state: stateName, status: 'SKIP', reason: `selector not found: ${selector}` };
  }

  try {
    if (action === 'click') {
      await el.click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(200);
    }

    const shot = path.join(outDir, `${caseName}--${stateName}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const info = await inspect(page);
    return {
      state: stateName,
      status: 'PASS',
      screenshot: path.relative(process.cwd(), shot),
      selected: info.selected,
      primary: info.primary,
      url: info.url,
    };
  } catch (err) {
    return {
      state: stateName,
      status: 'FAIL',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runInteractiveStates(page, c) {
  const states = [];

  if (c.route === '/products') {
    states.push(await captureState(page, c.name, 'product-selected', '.erp-rowcard-link, .dz-row'));
    await page.goto(base + c.route, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    const filter = page.locator('.dz-fs-open').first();
    if (await filter.count()) {
      states.push(await captureState(page, c.name, 'filter-open', '.dz-fs-open'));
    } else {
      states.push({ state: 'filter-open', status: 'SKIP', reason: 'filter trigger not found' });
    }
  }

  if (c.route === '/intake') {
    states.push(await captureState(page, c.name, 'intake-selected', '.erp-rowcards .erp-rowcard-link, .dz-row'));
  }

  if (c.route === '/settlement') {
    states.push(await captureState(page, c.name, 'settlement-party-selected', '.erp-rowcards .erp-rowcard-link, .dz-row'));
  }

  if (c.route === '/esign') {
    states.push(await captureState(page, c.name, 'esign-selected', '.erp-rowcards .erp-rowcard-link, .dz-row'));
  }

  return states;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
  });

  const report = { createdAt: new Date().toISOString(), base, cases: [], failures: [] };

  for (const c of cases) {
    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const url = base + c.route;

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(250);

      const shot = path.join(outDir, c.name + '.png');
      await page.screenshot({ path: shot, fullPage: true });

      const info = await inspect(page);
      const interactiveStates = await runInteractiveStates(page, c);
      const problems = [];
      if (!response || !response.ok()) problems.push('HTTP response not OK');
      if (info.bodyWidth > info.viewportWidth + 1) problems.push(`horizontal overflow ${info.bodyWidth} > ${info.viewportWidth}`);

      const panelBg = info.surfaceSamples?.panel?.[0]?.backgroundColor;
      const cardBg = info.surfaceSamples?.card?.find((x) => x.backgroundColor && x.backgroundColor !== 'rgba(0, 0, 0, 0)')?.backgroundColor;
      if (panelBg && cardBg && panelBg === cardBg) {
        problems.push(`panel/card resting surfaces are identical: ${panelBg}`);
      }

      if (Array.isArray(info.actionBars)) {
        for (const bar of info.actionBars) {
          const a = bar.actions;
          const primary = a.find((x) => x.primary);

          if (primary && primary.right !== Math.max(...a.map((x) => x.right))) {
            problems.push(`primary action is not rightmost: ${JSON.stringify(bar)}`);
          }

          if (a.length === 2 && bar.balance === 'equal') {
            const ratio = Math.max(a[0].width, a[1].width) / Math.max(1, Math.min(a[0].width, a[1].width));
            if (ratio > 1.06) problems.push(`equal 2-action bar is not 5:5: ${JSON.stringify(bar)}`);
          }

          if (a.length === 2 && bar.balance === 'primary' && primary) {
            const secondary = a.find((x) => !x.primary);
            if (secondary) {
              const ratio = primary.width / Math.max(1, secondary.width);
              if (ratio < 2.15 || ratio > 2.55) {
                problems.push(`primary 2-action bar is not 3:7: ratio ${ratio.toFixed(2)} ${JSON.stringify(bar)}`);
              }
            }
          }

          if (a.length === 3 && bar.balance === 'primary' && primary) {
            const total = a.reduce((sum, x) => sum + x.width, 0);
            const pShare = primary.width / Math.max(1, total);
            const secondaries = a.filter((x) => !x.primary);
            if (pShare < 0.37 || pShare > 0.43) {
              problems.push(`3-action primary share is not ~40%: ${pShare.toFixed(2)} ${JSON.stringify(bar)}`);
            }
            if (secondaries.length === 2) {
              const sRatio = Math.max(secondaries[0].width, secondaries[1].width) /
                Math.max(1, Math.min(secondaries[0].width, secondaries[1].width));
              if (sRatio > 1.06) problems.push(`3-action secondary widths differ: ${JSON.stringify(bar)}`);
            }
          }
        }
      }

      if (Array.isArray(info.panelWidths) && c.width >= 1280 && info.panelWidths.length >= 2) {
        const widths = info.panelWidths.map((p) => p.width);
        const wide = info.panelWidths.find((p) => p.wide);
        if (wide && info.panelWidths.length === 2) {
          const other = info.panelWidths.find((p) => !p.wide);
          if (other) {
            const ratio = wide.width / other.width;
            if (ratio < 1.85 || ratio > 2.15) {
              problems.push(`wide panel ratio out of range: ${ratio.toFixed(2)} (${wide.width}/${other.width})`);
            }
          }
        } else if (!wide && info.panelWidths.length === 3) {
          const max = Math.max(...widths);
          const min = Math.min(...widths);
          if (min > 0 && max / min > 1.08) {
            problems.push(`3-panel widths drift beyond 8%: ${widths.join(', ')}`);
          }
        }
      }

      if (Array.isArray(info.panelRhythm) && c.width >= 1280) {
        const present = (key) => info.panelRhythm.map((p) => p[key]).filter(Boolean);
        for (const key of ['head', 'search', 'quick']) {
          const rows = present(key);
          if (rows.length >= 2) {
            const tops = rows.map((x) => x.top);
            const delta = Math.max(...tops) - Math.min(...tops);
            if (delta > 2) problems.push(`panel ${key} y-axis drift: ${delta}px (${tops.join(', ')})`);
          }
        }
        const foots = present('foot');
        if (foots.length >= 2) {
          const bottoms = foots.map((x) => x.bottom);
          const delta = Math.max(...bottoms) - Math.min(...bottoms);
          if (delta > 2) problems.push(`panel foot bottom drift: ${delta}px (${bottoms.join(', ')})`);
        }
      }

      if (Array.isArray(info.scrollTopology)) {
        for (const p of info.scrollTopology) {
          if (p.verticalScrollers.length > 1) {
            problems.push(`nested vertical scroll containers in panel ${p.index}: ${JSON.stringify(p.verticalScrollers)}`);
          }
        }
      }

      const interaction = info.cardInteraction;
      if (interaction?.rowHit?.length) {
        const misses = interaction.rowHit.filter((x) => !x.link);
        if (misses.length) {
          problems.push(`interactive row card does not expose full-card link hit area: ${JSON.stringify(misses)}`);
        }
      }
      if (interaction?.passiveCursor && interaction.passiveCursor === 'pointer') {
        problems.push('passive tile exposes pointer cursor');
      }

      const cm = info.cardMetrics;
      if (cm) {
        const minPad = c.width <= 900 ? 8 : 12;
        if (Math.min(cm.paddingTop, cm.paddingRight, cm.paddingBottom, cm.paddingLeft) < minPad) {
          problems.push(`card padding below ${minPad}px: ${JSON.stringify(cm)}`);
        }
        if (c.width <= 900 && cm.height < 88) {
          problems.push(`mobile card height below 88px: ${cm.height}px`);
        }
        if (c.width > 900 && cm.height < 64) {
          problems.push(`desktop card height below 64px: ${cm.height}px`);
        }
        if (cm.amountTextAlign && cm.amountTextAlign !== 'right' && cm.amountTextAlign !== 'end') {
          problems.push(`card amount is not right aligned: ${cm.amountTextAlign}`);
        }
      }

      for (const [kind, list] of [['selected', info.selected], ['primary', info.primary]]) {
        for (const el of list) {
          const ratio = contrast(el.color, el.backgroundColor);
          if (!el.visible) problems.push(`${kind} control not visible: ${el.text}`);
          if (ratio !== null && ratio < 3) problems.push(`${kind} low contrast ${ratio.toFixed(2)}: ${el.text}`);
        }
      }

      if (c.route === '/products' && c.width >= 1280 && info.selected.length === 0) {
        problems.push('products desktop has no visible selected/current state to inspect');
      }
      if (c.route === '/products' && c.width >= 1280 && info.primary.length === 0) {
        problems.push('products desktop has no visible primary action to inspect');
      }

      for (const state of interactiveStates) {
        if (state.status === 'FAIL') problems.push(`interactive state ${state.state} failed: ${state.reason}`);
      }

      const item = {
        ...c,
        url: info.url,
        screenshot: path.relative(process.cwd(), shot),
        selected: info.selected,
        primary: info.primary,
        surfaceSamples: info.surfaceSamples,
        cardMetrics: info.cardMetrics,
        cardInteraction: info.cardInteraction,
        scrollTopology: info.scrollTopology,
        panelRhythm: info.panelRhythm,
        panelWidths: info.panelWidths,
        actionBars: info.actionBars,
        interactiveStates,
        problems,
      };
      report.cases.push(item);
      if (problems.length) report.failures.push({ case: c.name, problems });

      console.log(`${problems.length ? 'FAIL' : 'PASS'} ${c.name} -> ${item.screenshot}`);
      for (const p of problems) console.log('  - ' + p);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.failures.push({ case: c.name, problems: [message] });
      report.cases.push({ ...c, url, problems: [message] });
      console.log(`FAIL ${c.name}`);
      console.log('  - ' + message);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`report: ${path.relative(process.cwd(), reportPath)}`);
  process.exit(report.failures.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
