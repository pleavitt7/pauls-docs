// The animated plate is embedded on its docs page and must follow the site theme
// without nesting a scrollbar inside the page or shrinking its label type.
import { chromium } from '@playwright/test';

const BASE = process.env.DIAGRAM_BASE_URL ?? 'http://127.0.0.1:4322';
const DOCS = `${BASE}/diagrams/wendell-call/`;
const PLATE = `${BASE}/diagrams/wendell-call-sequence.html`;

const browser = await chromium.launch();
let failures = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const measure = async (context, url, theme) => {
  const page = await context.newPage();
  await page.goto(url);
  if (theme) await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.waitForTimeout(600);
  const out = await page.evaluate(() => {
    const frame = document.querySelector('[data-diagram-frame]');
    const visible = frame ? getComputedStyle(frame.parentElement).display !== 'none' : false;
    const link = document.querySelector('.mobile-open');
    const d = frame?.contentDocument;
    const svg = d?.querySelector('svg');
    const label = d?.querySelector('svg text');
    const root = d?.querySelector('[data-motion-root]');
    const body = d?.body;
    return {
      embedded: visible,
      linkShown: link ? getComputedStyle(link).display !== 'none' : false,
      linkHref: link?.getAttribute('href') ?? null,
      frameW: frame ? Math.round(frame.getBoundingClientRect().width) : null,
      frameH: frame ? Math.round(frame.getBoundingClientRect().height) : null,
      plateTheme: d?.documentElement.dataset.theme ?? null,
      plateClass: d?.documentElement.className ?? null,
      svgW: svg ? Math.round(svg.getBoundingClientRect().width) : null,
      labelPx: label ? Number.parseFloat(getComputedStyle(label).fontSize) : null,
      paper: body ? getComputedStyle(body).backgroundColor : null,
      ink: d?.querySelector('svg text[fill="#2d3142"]') ? getComputedStyle(d.querySelector('svg text[fill="#2d3142"]')).fill : null,
      innerScrollX: d ? d.documentElement.scrollWidth > d.documentElement.clientWidth : null,
      innerScrollY: d ? d.documentElement.scrollHeight > d.documentElement.clientHeight : null,
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      siteFont: getComputedStyle(document.documentElement).fontFamily.split(',')[0].trim(),
      plateFont: label ? getComputedStyle(label).fontFamily.split(',')[0].trim() : null,
      motionMode: root?.dataset.motionMode ?? null,
    };
  });
  await page.close();
  return out;
};

// 1. Wide viewport: embedded, themed, no nested scroll, legible labels.
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1100 } });
  const m = await measure(context, DOCS, theme);
  check(`[${theme}] plate is embedded on the docs page`, m.embedded === true && m.linkShown === false, `embedded ${m.embedded}, link shown ${m.linkShown}`);
  check(`[${theme}] plate received the site theme`, m.plateTheme === theme && m.plateClass.includes('embedded'), `theme ${m.plateTheme}, class "${m.plateClass}"`);
  check(`[${theme}] no nested scrollbars inside the frame`, m.innerScrollX === false && m.innerScrollY === false && m.pageOverflowX === false, JSON.stringify({ innerScrollX: m.innerScrollX, innerScrollY: m.innerScrollY, pageOverflowX: m.pageOverflowX, frameW: m.frameW, frameH: m.frameH }));
  check(`[${theme}] label type stays legible (>= 7.5px)`, m.labelPx !== null && m.labelPx >= 7.5, `${m.labelPx}px at a ${m.frameW}px frame`);
  check(`[${theme}] plate paints the site surface`, theme === 'light' ? m.paper === 'rgb(255, 255, 255)' : m.paper === 'rgb(23, 24, 28)', m.paper);
  check(`[${theme}] plate ink follows the theme`, theme === 'light' ? m.ink === 'rgb(53, 56, 65)' : m.ink === 'rgb(231, 232, 236)', m.ink);
  await context.close();
}

// 2. Theme toggle propagates from the page into the frame.
// 1c. The embedded plate shows the complete sequence as a figure: every message
// visible, playback controls left to the standalone animated page.
{
  const context = await browser.newContext({ viewport: { width: 1920, height: 1100 } });
  const page = await context.newPage();
  await page.goto(DOCS);
  await page.waitForTimeout(1200);
  const m = await page.locator('[data-diagram-frame]').evaluate((f) => {
    const d = f.contentDocument;
    const root = d.querySelector('[data-motion-root]');
    const controls = d.querySelector('[data-motion-controls]');
    const items = [...d.querySelectorAll('[data-motion-item]:not([data-motion-decorative])')];
    const decorativeHidden = [...d.querySelectorAll('[data-motion-decorative]')].every(
      (el) => getComputedStyle(el).display === 'none',
    );
    return {
      step: root.dataset.stepCurrent,
      frame: root.dataset.frame,
      motionState: root.dataset.motionState,
      controlsShown: controls ? getComputedStyle(controls).display !== 'none' && !controls.hidden : false,
      faded: items.filter((i) => Number.parseFloat(getComputedStyle(i).opacity) < 1).length,
      items: items.length,
      decorativeHidden,
      labels: d.querySelectorAll('svg text').length,
    };
  });
  check(
    'embedded plate shows the complete sequence with no playback chrome',
    // Six step groups carry the twelve messages; the two decorative overlays are
    // hidden in a static frame, and the 24 svg text nodes are all present.
    m.faded === 0 && m.items === 6 && m.labels === 24 && m.decorativeHidden === true && m.controlsShown === false,
    JSON.stringify(m),
  );
  const linkHref = await page.locator('.mobile-open, a[href*="wendell-call-sequence.html"]').first().getAttribute('href');
  check('docs page offers the animated plate as a link', /wendell-call-sequence\.html$/.test(linkHref ?? ''), linkHref ?? 'none');
  await context.close();
}

// 1b. Actor labels must fit their boxes in the site's font, which is wider than
// the plate's own face.
{
  const context = await browser.newContext({ viewport: { width: 1920, height: 1100 } });
  const page = await context.newPage();
  await page.goto(DOCS);
  await page.waitForTimeout(700);
  const boxes = await page.locator('[data-diagram-frame]').evaluate((f) => {
    const d = f.contentDocument;
    const rects = [...d.querySelectorAll('svg rect')].filter((r) => Number(r.getAttribute('height')) === 56);
    return rects.map((r) => {
      const x = Number(r.getAttribute('x'));
      const w = Number(r.getAttribute('width'));
      const cx = x + w / 2;
      const name = [...d.querySelectorAll('svg text')].find(
        (t) => Math.abs(Number(t.getAttribute('x')) - cx) < 1 && Number(t.getAttribute('y')) === 136,
      );
      if (!name) return { label: null, box: w, slack: null };
      const textW = name.getBBox().width;
      return { label: name.textContent, box: w, text: Math.round(textW), slack: Math.round(w - textW) };
    });
  });
  const bad = boxes.filter((b) => b.slack === null || b.slack < 8);
  check(
    'actor labels fit their boxes in the site font',
    boxes.length === 6 && bad.length === 0,
    `${boxes.length} boxes; tightest ${Math.min(...boxes.map((b) => b.slack ?? -1))}px slack${bad.length ? `; offending: ${JSON.stringify(bad)}` : ''}`,
  );
  await context.close();
}

// 2. Theme toggle propagates from the page into the frame.
{
  const context = await browser.newContext({ viewport: { width: 1920, height: 1100 } });
  const page = await context.newPage();
  await page.goto(DOCS);
  await page.waitForTimeout(500);
  const before = await page.locator('[data-diagram-frame]').evaluate((f) => f.contentDocument.documentElement.dataset.theme);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.waitForTimeout(500);
  const after = await page.locator('[data-diagram-frame]').evaluate((f) => f.contentDocument.documentElement.dataset.theme);
  check('toggling the site theme updates the embedded plate', before !== after && after === 'dark', `${before} -> ${after}`);
  await context.close();
}

// 3. Narrow viewport: link instead of a squeezed plate, and no page overflow.
for (const width of [1440, 1280, 1100, 900, 600, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const m = await measure(context, DOCS);
  const ok = m.pageOverflowX === false && (m.embedded ? !m.innerScrollX && !m.innerScrollY : m.linkShown);
  check(`docs page at ${width}px: ${m.embedded ? 'embedded without nested scroll' : 'links out instead of squeezing'}`, ok, `embedded ${m.embedded}, link ${m.linkShown}, frame ${m.frameW}x${m.frameH}`);
  await context.close();
}

// 4. Standalone: complete, its own skin, no page overflow at any width.
for (const width of [1920, 1440, 1024, 768, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${PLATE}?motion=static`);
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const root = document.querySelector('[data-motion-root]');
    return {
      svgW: Math.round(svg.getBoundingClientRect().width),
      paper: getComputedStyle(document.body).backgroundColor,
      controlsHidden: getComputedStyle(document.querySelector('[data-motion-controls]')).display === 'none',
      themed: document.documentElement.dataset.theme,
      notEmbedded: !document.documentElement.classList.contains('embedded'),
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      motionMode: root.dataset.motionMode,
    };
  });
  check(
    `standalone at ${width}px: no page overflow, keeps its authored width`,
    m.pageOverflowX === false && m.svgW === 1120 && m.controlsHidden && m.notEmbedded,
    JSON.stringify(m),
  );
  await context.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
if (failures) process.exitCode = 1;
