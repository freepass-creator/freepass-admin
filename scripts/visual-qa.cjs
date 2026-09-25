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
      selectedCards: (() => {
        const nodes = [...document.querySelectorAll(
          '.erp-rowcard[aria-current="true"], .erp-tile--pressable[aria-pressed="true"], .dz-row.on'
        )].filter(visible);
        return nodes.slice(0, 20).map((el) => {
          const s = getComputedStyle(el);
          return {
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
            backgroundColor: s.backgroundColor,
            borderTopWidth: s.borderTopWidth,
            borderRightWidth: s.borderRightWidth,
            borderBottomWidth: s.borderBottomWidth,
            borderLeftWidth: s.borderLeftWidth,
            borderTopColor: s.borderTopColor,
            borderRightColor: s.borderRightColor,
            borderBottomColor: s.borderBottomColor,
            borderLeftColor: s.borderLeftColor,
            boxShadow: s.boxShadow,
          };
        });
      })(),
      primary: pick('.erp-btn--primary, button.primary, a.primary'),
      panels: pick('.erp-panel, .panel'),
      cards: pick('.erp-rowcard, .erp-tile, .dz-row'),
      cardGapMetrics: (() => {
        const containers = [...document.querySelectorAll('.erp-rowcards, .erp-cardlist, .erp-tile-group, .list')]
          .filter(visible)
          .slice(0, 12);
        return containers.map((el) => {
          const s = getComputedStyle(el);
          return {
            className: typeof el.className === 'string' ? el.className : '',
            rowGap: parseFloat(s.rowGap || s.gap) || 0,
            columnGap: parseFloat(s.columnGap || s.gap) || 0,
          };
        });
      })(),
      cardMetrics: (() => {
        const card = [...document.querySelectorAll('.erp-rowcard, .dz-row')].find(visible);
        const amount = card?.querySelector('.erp-rowcard-amount, .dz-row-l3 > strong, .dz-row-l2.value strong');
        if (!card) return null;
        const cs = getComputedStyle(card);
        const as = amount ? getComputedStyle(amount) : null;
        const r = card.getBoundingClientRect();
        return {
          className: typeof card.className === 'string' ? card.className : '',
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
        const uncontracted = [...document.querySelectorAll('.dz-bar-go, .erp-panel-foot')]
          .filter(visible)
          .filter((el) => !el.hasAttribute('data-action-balance'))
          .map((el) => ({
            tag: el.tagName,
            className: typeof el.className === 'string' ? el.className : '',
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
          }));

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
        return { contracted: bars, uncontracted };
      })(),
      wrapSamples: (() => {
        const sample = (selector, limit = 30) =>
          [...document.querySelectorAll(selector)].filter(visible).slice(0, limit).map((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return {
              className: typeof el.className === 'string' ? el.className : '',
              height: Math.round(r.height),
              lineHeight: parseFloat(s.lineHeight) || 0,
              whiteSpace: s.whiteSpace,
              scrollWidth: Math.round(el.scrollWidth),
              clientWidth: Math.round(el.clientWidth),
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
            };
          });
        return {
          choiceRows: sample('.quick-filters, .erp-facet-opts, .tabs, .offer-picker'),
          actions: sample('.erp-btn, .primary, .dz-bar-sub'),
          cards: sample('.erp-rowcard, .dz-row'),
        };
      })(),
      signalSamples: (() => {
        const sample = (selector, limit = 30) =>
          [...document.querySelectorAll(selector)].filter(visible).slice(0, limit).map((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return {
              className: typeof el.className === 'string' ? el.className : '',
              width: Math.round(r.width),
              height: Math.round(r.height),
              radius: parseFloat(s.borderTopLeftRadius) || 0,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            };
          });
        const cardStatusCounts = [...document.querySelectorAll('.erp-rowcard, .erp-listcard, .dz-row')]
          .filter(visible)
          .slice(0, 30)
          .map((card) => ({
            text: (card.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            count: card.querySelectorAll('.erp-badge, .dz-badge').length,
          }));
        return {
          badges: sample('.erp-badge, .dz-badge'),
          tags: sample('.erp-tag'),
          quickFilters: sample('.erp-facet-opt, .quick-filters a'),
          cardStatusCounts,
        };
      })(),
      fontSamples: (() => {
        const sample = (selector, limit = 24) =>
          [...document.querySelectorAll(selector)].filter(visible).slice(0, limit).map((el) => {
            const s = getComputedStyle(el);
            return {
              className: typeof el.className === 'string' ? el.className : '',
              fontSize: parseFloat(s.fontSize) || 0,
              fontWeight: parseInt(s.fontWeight, 10) || 0,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            };
          });
        return {
          panelTitles: sample('.erp-panel-head h2, .panel-head h1'),
          cardTitles: sample('.erp-rowcard-title, .dz-row-l1 > b'),
          primaryValues: sample('.erp-rowcard-amount strong, .erp-tile-row strong, .dz-row-l2.value strong, .dz-row-l3 > strong'),
          controls: sample('.erp-btn, .quick-filters a, .erp-facet-opt, .primary, .dz-bar-sub'),
          support: sample('.erp-rowcard-sub, .erp-rowcard-meta, .panel-head > .count, .dz-muted, .erp-badge, .dz-badge'),
        };
      })(),
      listCardAlignment: (() => {
        const cards = [...document.querySelectorAll('.erp-rowcard, .dz-row')].filter(visible).slice(0, 40);
        return cards.map((card) => {
          const visual = card.querySelector('.erp-rowcard-thumb, .dz-row-thumb, .dz-row-status');
          const main = card.querySelector('[data-line-role="main"]');
          const key = card.querySelector('[data-line-role="key"]');
          const support = card.querySelector('[data-line-role="support"]');
          const primary = card.querySelector('.erp-rowcard-amount, .dz-row-main-value');
          const cr = card.getBoundingClientRect();
          const rr = (el) => el ? el.getBoundingClientRect() : null;
          const vr = rr(visual), mr = rr(main), kr = rr(key), sr = rr(support), pr = rr(primary);
          return {
            className: typeof card.className === 'string' ? card.className : '',
            outerHeight: Math.round(cr.height),
            cardLeft: Math.round(cr.left), cardRight: Math.round(cr.right),
            visualTop: vr ? Math.round(vr.top) : null, visualBottom: vr ? Math.round(vr.bottom) : null, visualLeft: vr ? Math.round(vr.left) : null,
            mainTop: mr ? Math.round(mr.top) : null,
            supportBottom: sr ? Math.round(sr.bottom) : null,
            keyTop: kr ? Math.round(kr.top) : null,
            primaryRight: pr ? Math.round(pr.right) : null,
            text: (card.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
          };
        });
      })(),
      listVisualTiles: (() => {
        const tiles = [...document.querySelectorAll('.erp-rowcard-thumb, .dz-row-thumb, .dz-row-status')].filter(visible).slice(0, 40);
        return tiles.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            className: typeof el.className === 'string' ? el.className : '',
            width: Math.round(r.width),
            height: Math.round(r.height),
            status: el.matches('.erp-rowcard-thumb--status,.dz-row-status'),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
          };
        });
      })(),
      cardRoleGrammar: (() => {
        const cards = [...document.querySelectorAll('.erp-rowcard, .dz-row')].filter(visible).slice(0, 40);
        return cards.map((card) => ({
          className: typeof card.className === 'string' ? card.className : '',
          roles: [...card.querySelectorAll('[data-line-role]')].filter(visible).map((el) => el.getAttribute('data-line-role')),
          text: (card.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        }));
      })(),
      cardLineSamples: (() => {
        const sample = (selector, limit = 30) =>
          [...document.querySelectorAll(selector)].filter(visible).slice(0, limit).map((el) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              className: typeof el.className === 'string' ? el.className : '',
              height: Math.round(r.height),
              lineHeight: parseFloat(s.lineHeight) || 0,
              whiteSpace: s.whiteSpace,
              overflow: s.overflow,
              textOverflow: s.textOverflow,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            };
          });
        return {
          desktopLines: sample('.erp-rowcard-title, .erp-rowcard-sub, .erp-rowcard-meta, .erp-tile-row'),
          mobileLines: sample('.dz-row-l1, .dz-row-l2, .dz-row-l3'),
        };
      })(),
      dividerSamples: (() => {
        const nodes = [...document.querySelectorAll(
          '.erp-panel-head, .erp-panel-foot, .erp-searchbar, .erp-toolbar, .erp-card-head, .erp-listcard-foot, .erp-grid-foot, .erp-tile-title, .panel-head, .dz-listtop, .dz-bar'
        )].filter(visible).slice(0, 40);
        return nodes.map((el) => {
          const s = getComputedStyle(el);
          return {
            className: typeof el.className === 'string' ? el.className : '',
            topWidth: parseFloat(s.borderTopWidth) || 0,
            topColor: s.borderTopColor,
            bottomWidth: parseFloat(s.borderBottomWidth) || 0,
            bottomColor: s.borderBottomColor,
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          };
        });
      })(),
      shadowSamples: (() => {
        const sample = (selector, limit = 16) =>
          [...document.querySelectorAll(selector)].filter(visible).slice(0, limit).map((el) => {
            const s = getComputedStyle(el);
            return {
              className: typeof el.className === 'string' ? el.className : '',
              boxShadow: s.boxShadow,
              selected: el.matches('[aria-current="true"],[aria-pressed="true"],.on'),
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            };
          });
        return {
          cards: sample('.erp-rowcard, .erp-tile, .erp-listcard, .dz-row'),
          panels: sample('.erp-panel, .panel', 8),
        };
      })(),
      radiusSamples: (() => {
        const pickRadius = (selector, limit = 12) =>
          [...document.querySelectorAll(selector)].filter(visible).slice(0, limit).map((el) => {
            const s = getComputedStyle(el);
            return {
              className: typeof el.className === 'string' ? el.className : '',
              radius: parseFloat(s.borderTopLeftRadius) || 0,
              text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
            };
          });
        return {
          panels: pickRadius('.erp-panel, .panel'),
          cards: pickRadius('.erp-rowcard, .erp-tile, .dz-row'),
          controls: pickRadius('.erp-btn, .primary, .dz-bar-sub, .dz-fs-open'),
          quickFilters: pickRadius('.erp-facet-opt, .quick-filters a'),
        };
      })(),
      workspaceFill: (() => {
        const ws = document.querySelector('.erp-workspace, .workspace');
        if (!ws || !visible(ws)) return null;
        const wr = ws.getBoundingClientRect();
        const s = getComputedStyle(ws);
        const children = [...ws.children].filter((el) => visible(el));
        const cr = children.map((el) => el.getBoundingClientRect());
        return {
          width: Math.round(wr.width),
          left: Math.round(wr.left),
          right: Math.round(wr.right),
          paddingLeft: parseFloat(s.paddingLeft) || 0,
          paddingRight: parseFloat(s.paddingRight) || 0,
          gap: parseFloat(s.columnGap || s.gap) || 0,
          visibleChildren: cr.length,
          childLeft: cr.length ? Math.round(Math.min(...cr.map((x) => x.left))) : null,
          childRight: cr.length ? Math.round(Math.max(...cr.map((x) => x.right))) : null,
        };
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

      if (info.actionBars?.uncontracted?.length) {
        problems.push(`uncontracted action bar found: ${JSON.stringify(info.actionBars.uncontracted)}`);
      }

      if (Array.isArray(info.actionBars?.contracted)) {
        for (const bar of info.actionBars.contracted) {
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

      if (info.wrapSamples) {
        for (const row of info.wrapSamples.choiceRows || []) {
          if (row.height > 48) {
            problems.push(`choice row wrapped vertically: ${JSON.stringify(row)}`);
          }
        }
        for (const a of info.wrapSamples.actions || []) {
          if (a.whiteSpace !== 'nowrap') {
            problems.push(`action text may wrap: ${JSON.stringify(a)}`);
          }
        }
      }

      if (info.signalSamples) {
        for (const b of info.signalSamples.badges || []) {
          if (b.height > 22) problems.push(`badge too tall: ${JSON.stringify(b)}`);
          if (b.radius > 8) problems.push(`badge too pill-like: ${JSON.stringify(b)}`);
        }
        for (const t of info.signalSamples.tags || []) {
          if (t.height > 20) problems.push(`tag too tall: ${JSON.stringify(t)}`);
        }
        for (const x of info.signalSamples.cardStatusCounts || []) {
          if (x.count > 1) problems.push(`multiple status badges in one card: ${JSON.stringify(x)}`);
        }
      }

      if (info.fontSamples) {
        const expectRange = (items, min, max, label) => {
          for (const x of items || []) {
            if (x.fontSize < min || x.fontSize > max) {
              problems.push(`${label} font-size out of range ${x.fontSize}px: ${JSON.stringify(x)}`);
            }
          }
        };
        if (c.width <= 900) {
          expectRange(info.fontSamples.panelTitles, 13, 15, 'mobile panel title');
          expectRange(info.fontSamples.cardTitles, 13, 15, 'mobile card title');
          expectRange(info.fontSamples.primaryValues, 13, 15, 'mobile primary value');
          expectRange(info.fontSamples.controls, 13, 15, 'mobile control');
          expectRange(info.fontSamples.support, 11.5, 12.5, 'mobile support');
        } else {
          expectRange(info.fontSamples.panelTitles, 13, 15, 'desktop panel title');
          expectRange(info.fontSamples.cardTitles, 13, 15, 'desktop card title');
          expectRange(info.fontSamples.primaryValues, 13, 15, 'desktop primary value');
          expectRange(info.fontSamples.controls, 13, 15, 'desktop control');
          expectRange(info.fontSamples.support, 11.5, 12.5, 'desktop support');
        }
      }
      if (Array.isArray(info.listCardAlignment)) {
        for (const card of info.listCardAlignment) {
          const expectedOuter = c.width <= 900 ? 88 : 84;
          if (Math.abs(card.outerHeight - expectedOuter) > 2) {
            problems.push(`list card outer height mismatch: expected ${expectedOuter}px: ${JSON.stringify(card)}`);
          }
          if (card.visualTop !== null && card.mainTop !== null && card.visualBottom !== null && card.supportBottom !== null) {
            if (Math.abs(card.visualTop - card.mainTop) > 2 || Math.abs(card.visualBottom - card.supportBottom) > 2) {
              problems.push(`visual and 3-line text block vertical alignment drift: ${JSON.stringify(card)}`);
            }
          }
          if (card.primaryRight !== null && Math.abs(card.cardRight - card.primaryRight) > 28) {
            problems.push(`main primary value right-edge drift: ${JSON.stringify(card)}`);
          }
        }
      }
      if (Array.isArray(info.listVisualTiles)) {
        for (const tile of info.listVisualTiles) {
          if (Math.abs(tile.width - 64) > 1 || Math.abs(tile.height - 64) > 1) {
            problems.push(`list visual tile must be 64x64: ${JSON.stringify(tile)}`);
          }
        }
      }
      if (Array.isArray(info.cardRoleGrammar)) {
        for (const card of info.cardRoleGrammar) {
          const roles = card.roles || [];
          if (roles.length !== 3 || roles[0] !== 'main' || roles[1] !== 'key' || roles[2] !== 'support') {
            problems.push(`list card must be exactly Main/Key/Support: ${JSON.stringify(card)}`);
          }
        }
      }
      if (info.cardLineSamples) {
        const lines = c.width <= 900 ? info.cardLineSamples.mobileLines : info.cardLineSamples.desktopLines;
        for (const x of lines || []) {
          if (x.lineHeight && (x.lineHeight < 19 || x.lineHeight > 21)) {
            problems.push(`card line-height mismatch ${x.lineHeight}px: ${JSON.stringify(x)}`);
          }
          if (x.height > 22) {
            problems.push(`card line role grew vertically: ${JSON.stringify(x)}`);
          }
        }
      }
      if (info.shadowSamples) {
        const hasOuterShadow = (v) => {
          if (!v || v === 'none') return false;
          return !/\binset\b/.test(v);
        };
        for (const x of info.shadowSamples.panels || []) {
          if (hasOuterShadow(x.boxShadow)) problems.push(`resting panel has outer shadow: ${JSON.stringify(x)}`);
        }
        for (const x of info.shadowSamples.cards || []) {
          if (!x.selected && hasOuterShadow(x.boxShadow)) problems.push(`resting card/tile has outer shadow: ${JSON.stringify(x)}`);
          if (x.selected && hasOuterShadow(x.boxShadow)) problems.push(`selected card/tile has outer shadow: ${JSON.stringify(x)}`);
        }
      }
      if (Array.isArray(info.dividerSamples)) {
        const visibleColor = (value) => value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';
        for (const x of info.dividerSamples) {
          const topVisible = x.topWidth > 0 && visibleColor(x.topColor);
          const bottomVisible = x.bottomWidth > 0 && visibleColor(x.bottomColor);
          if (topVisible || bottomVisible) {
            problems.push(`decorative divider still visible: ${JSON.stringify(x)}`);
          }
        }
      }

      if (info.shadowSamples?.cards) {
        for (const x of info.shadowSamples.cards) {
          if (!x.selected && x.boxShadow && x.boxShadow !== 'none' && /0px [3-9]px|0px [1-9][0-9]px/.test(x.boxShadow)) {
            problems.push(`resting card shadow too strong: ${JSON.stringify(x)}`);
          }
          if (x.selected && x.boxShadow && /rgba\([^)]*\)[^,]*,/.test(x.boxShadow) && /0px [2-9]px/.test(x.boxShadow)) {
            problems.push(`selected card has outer elevation: ${JSON.stringify(x)}`);
          }
        }
      }

      if (info.radiusSamples) {
        for (const x of info.radiusSamples.panels || []) {
          const expected = c.width <= 900 ? 0 : 8;
          if (Math.abs(x.radius - expected) > 0.6) {
            problems.push(`panel radius mismatch ${x.radius}px expected ${expected}px: ${JSON.stringify(x)}`);
          }
        }
        for (const x of info.radiusSamples.cards || []) {
          if (Math.abs(x.radius - 6) > 0.6) {
            problems.push(`card/tile radius mismatch ${x.radius}px expected 6px: ${JSON.stringify(x)}`);
          }
        }
        for (const x of info.radiusSamples.controls || []) {
          if (/quick|facet/i.test(x.className)) continue;
          if (Math.abs(x.radius - 6) > 0.6) {
            problems.push(`action/control radius mismatch ${x.radius}px expected 6px: ${JSON.stringify(x)}`);
          }
        }
      }

      if (info.cardMetrics) {
        const m = info.cardMetrics;
        const narrowMobile = c.width < 380 && /dz-row/.test(m.className || '');
        const expectedPad = narrowMobile ? 8 : 12;
        if (Math.abs(m.paddingLeft - expectedPad) > 1 || Math.abs(m.paddingRight - expectedPad) > 1) {
          problems.push(`card horizontal padding mismatch ${m.paddingLeft}/${m.paddingRight}, expected ${expectedPad}`);
        }
      }

      if (info.workspaceFill?.visibleChildren) {
        const expectedLeft = info.workspaceFill.left + info.workspaceFill.paddingLeft;
        const expectedRight = info.workspaceFill.right - info.workspaceFill.paddingRight;
        if (info.workspaceFill.childLeft !== null && Math.abs(info.workspaceFill.childLeft - expectedLeft) > 2) {
          problems.push(`workspace left fill mismatch: child=${info.workspaceFill.childLeft} expected=${expectedLeft}`);
        }
        if (info.workspaceFill.childRight !== null && Math.abs(info.workspaceFill.childRight - expectedRight) > 2) {
          problems.push(`workspace right fill mismatch: child=${info.workspaceFill.childRight} expected=${expectedRight}`);
        }

        const expectedGutter = c.width < 380 ? 12 : c.width <= 900 ? 16 : c.width < 1440 ? 16 : 20;
        if (c.width <= 900) {
          if (Math.abs(info.workspaceFill.paddingLeft - expectedGutter) > 1 ||
              Math.abs(info.workspaceFill.paddingRight - expectedGutter) > 1) {
            problems.push(`mobile workspace gutter mismatch: ${info.workspaceFill.paddingLeft}/${info.workspaceFill.paddingRight}, expected ${expectedGutter}`);
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

      if (Array.isArray(info.selectedCards)) {
        for (const card of info.selectedCards) {
          const widths = [card.borderTopWidth, card.borderRightWidth, card.borderBottomWidth, card.borderLeftWidth]
            .map((v) => parseFloat(v) || 0);
          const colors = [card.borderTopColor, card.borderRightColor, card.borderBottomColor, card.borderLeftColor];
          const visibleBorder = widths.some((w, i) =>
            w > 0 && colors[i] !== 'rgba(0, 0, 0, 0)' && colors[i] !== 'transparent'
          );
          if (visibleBorder) {
            problems.push(`selected card has visible border: ${JSON.stringify(card)}`);
          }
        }
      }

      if (Array.isArray(info.cardGapMetrics)) {
        for (const g of info.cardGapMetrics) {
          const isCardContainer = /erp-rowcards|erp-cardlist|erp-tile-group|list/.test(g.className);
          if (isCardContainer && g.rowGap > 0 && (g.rowGap < 10 || g.rowGap > 14)) {
            problems.push(`card gap outside 12px rhythm: ${JSON.stringify(g)}`);
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
        cardGapMetrics: info.cardGapMetrics,
        selectedCards: info.selectedCards,
        cardInteraction: info.cardInteraction,
        scrollTopology: info.scrollTopology,
        panelRhythm: info.panelRhythm,
        panelWidths: info.panelWidths,
        workspaceFill: info.workspaceFill,
        radiusSamples: info.radiusSamples,
        shadowSamples: info.shadowSamples,
        dividerSamples: info.dividerSamples,
        signalSamples: info.signalSamples,
        fontSamples: info.fontSamples,
        wrapSamples: info.wrapSamples,
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
