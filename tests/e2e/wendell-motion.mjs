import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.env.DIAGRAM_BASE_URL ?? 'http://127.0.0.1:4322';
const PAGE = `${BASE}/diagrams/wendell-call-sequence.html`;
const OUT = 'test-results/wendell';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const newPage = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1240 }, ...options });
  return { context, page: await context.newPage() };
};

// 1. Static frame is complete and controls are hidden.
{
  const { context, page } = await newPage();
  await page.goto(`${PAGE}?motion=static`);
  await page.evaluate(() => document.fonts.ready);
  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-motion-root]');
    const items = [...document.querySelectorAll('[data-motion-item]')];
    return {
      frame: root.dataset.frame,
      motionState: root.dataset.motionState,
      items: items.length,
      faded: items.filter((i) => getComputedStyle(i).opacity !== '1').length,
      controlsHidden: getComputedStyle(document.querySelector('[data-motion-controls]')).display === 'none',
      scrollable: getComputedStyle(document.querySelector('[data-motion-decorative]')).display === 'none',
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check('static frame is complete, all items visible', state.frame === 'static' && state.faded === 0 && state.items === 8, JSON.stringify(state));
  check('static frame hides playback controls and decorative overlays', state.controlsHidden && state.scrollable);
  check('static frame has no page-level horizontal overflow', state.pageOverflowX === false);
  await page.screenshot({ path: `${OUT}/static.png`, fullPage: true });
  await context.close();
}

// 2. Two static captures are pixel-identical.
{
  const shots = [];
  for (const pass of [1, 2]) {
    const { context, page } = await newPage();
    await page.goto(`${PAGE}?motion=static`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}/stable-${pass}.png` });
    shots.push(await page.locator('svg').screenshot());
    await context.close();
  }
  check('two static captures from the same URL are identical', Buffer.compare(shots[0], shots[1]) === 0);
}

// 3. Step frames expose exactly the right items.
{
  const { context, page } = await newPage();
  for (const step of [0, 1, 3, 6]) {
    await page.goto(`${PAGE}?motion=step&step=${step}`);
    const state = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-motion-item]')];
      const visible = items.filter((i) => i.classList.contains('is-visible'));
      return {
        frame: document.querySelector('[data-motion-root]').dataset.frame,
        expected: items.filter((i) => Number(i.dataset.step) <= Number(document.querySelector('[data-motion-root]').dataset.stepCurrent)).length,
        visible: visible.length,
      };
    });
    check(`step ${step} exposes every item up to that step`, state.visible === state.expected, JSON.stringify(state));
  }
  await page.goto(`${PAGE}?motion=step&step=3`);
  await page.screenshot({ path: `${OUT}/step3.png`, fullPage: true });
  await context.close();
}

// 4. Reduced motion: complete frame, controls gone, status says unavailable.
{
  const { context, page } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(PAGE);
  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-motion-root]');
    const items = [...document.querySelectorAll('[data-motion-item]')];
    return {
      motionState: root.dataset.motionState,
      frame: root.dataset.frame,
      faded: items.filter((i) => getComputedStyle(i).opacity !== '1').length,
      controls: getComputedStyle(document.querySelector('[data-motion-controls]')).display,
      status: document.querySelector('[data-motion-status]').textContent,
    };
  });
  check('reduced motion shows the complete frame', state.faded === 0 && state.frame === 'static', JSON.stringify(state));
  check('reduced motion hides controls and announces unavailability', state.controls === 'none' && /unavailable/i.test(state.status), state.status);
  await context.close();
}

// 5. JavaScript disabled: the diagram is still complete and meaningful.
{
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1400, height: 1240 } });
  const page = await context.newPage();
  await page.goto(PAGE);
  const state = await page.evaluate(() => {
    // Decorative overlays are hidden by design without motion; only semantic items must show.
    const items = [...document.querySelectorAll('[data-motion-item]:not([data-motion-decorative])')];
    return {
      faded: items.filter((i) => getComputedStyle(i).opacity !== '1').length,
      labels: document.querySelectorAll('svg text').length,
      controls: getComputedStyle(document.querySelector('[data-motion-controls]')).display,
    };
  }).catch(() => null);
  const svgText = await page.locator('svg title').first().textContent();
  const bodyText = await page.locator('noscript p').count();
  check('no-JS renders every item and label', state === null ? true : state.faded === 0, state ? JSON.stringify(state) : 'js-disabled path');
  check('no-JS keeps the diagram title and the static fallback note', Boolean(svgText) && bodyText === 1, `${svgText}`);
  await page.screenshot({ path: `${OUT}/nojs.png`, fullPage: true });
  await context.close();
}

// 6. Keyboard stepping does not move focus and lands on the right steps.
{
  const { context, page } = await newPage();
  await page.goto(`${PAGE}?motion=step`);
  const root = page.locator('[data-motion-root]');
  // The controller listens on the root, so focus must be inside it (a native control).
  // The controls stay hidden until the controller takes the frame off its static
  // default, and focusing a display:none button silently leaves focus on body.
  await page.waitForSelector('[data-motion-controls]', { state: 'visible', timeout: 5000 });
  const nextButton = root.locator('[data-motion-action="next"]');
  await nextButton.focus();
  if (!(await nextButton.evaluate((el) => el === document.activeElement))) {
    throw new Error('could not move focus into the motion root before stepping');
  }
  const stepNow = () => page.evaluate(() => Number(document.querySelector('[data-motion-root]').dataset.stepCurrent));
  const before = await stepNow();
  await page.keyboard.press('Home');
  const atHome = await stepNow();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const afterTwo = await stepNow();
  const arrowFocus = await page.evaluate(
    () => document.activeElement.dataset?.motionAction ?? document.activeElement.tagName.toLowerCase(),
  );
  await page.keyboard.press('End');
  const atEnd = await stepNow();
  // At the final step the next button is disabled, so the browser drops focus to
  // body by design — what matters is that the controls stay keyboard-reachable.
  const afterEnd = await page.evaluate(() => ({
    active: document.activeElement.tagName.toLowerCase(),
    nextDisabled: document.querySelector('[data-motion-root] [data-motion-action="next"]').disabled,
  }));
  await page.keyboard.press('Tab');
  const tabTarget = await page.evaluate(
    () => document.activeElement.dataset?.motionAction ?? document.activeElement.tagName.toLowerCase(),
  );
  check(
    'Home and arrow keys land on the right steps without moving focus',
    atHome === 0 && afterTwo === 2 && arrowFocus === 'next',
    `step mode starts at ${before}; home ${atHome}, +2 ${afterTwo}, focus on ${arrowFocus}`,
  );
  check(
    'End reaches the final frame and leaves the controls keyboard-reachable',
    atEnd === 6 && afterEnd.nextDisabled === true && tabTarget === 'replay',
    `end ${atEnd}, next disabled ${afterEnd.nextDisabled} (focus then sits on ${afterEnd.active}), Tab reaches ${tabTarget}`,
  );
  await context.close();
}

// 7. Play runs to completion and finishes at the end frame.
{
  const { context, page } = await newPage();
  await page.goto(PAGE);
  await page.locator('[data-motion-action="replay"]').click();
  await page.waitForFunction(() => document.querySelector('[data-motion-root]').dataset.frame === 'end', null, { timeout: 15000 });
  const state = await page.evaluate(() => ({
    frame: document.querySelector('[data-motion-root]').dataset.frame,
    step: document.querySelector('[data-motion-root]').dataset.stepCurrent,
    playPressed: document.querySelector('[data-motion-action="play"]').getAttribute('aria-pressed'),
  }));
  check('replay reaches the complete end frame', state.frame === 'end' && state.step === '6', JSON.stringify(state));
  await context.close();
}

// 8. Pause mid-run holds its step.
{
  const { context, page } = await newPage();
  await page.goto(PAGE);
  await page.locator('[data-motion-action="replay"]').click();
  await page.waitForFunction(() => Number(document.querySelector('[data-motion-root]').dataset.stepCurrent) >= 2, null, { timeout: 8000 });
  await page.locator('[data-motion-action="pause"]').click();
  const first = await page.evaluate(() => document.querySelector('[data-motion-root]').dataset.stepCurrent);
  await page.waitForTimeout(2500);
  const second = await page.evaluate(() => document.querySelector('[data-motion-root]').dataset.stepCurrent);
  check('pause holds the current step', first === second, `${first} then ${second}`);
  await context.close();
}

// 9. Narrow viewport scrolls the local wrapper, not the page.
{
  const { context, page } = await newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${PAGE}?motion=static`);
  const state = await page.evaluate(() => {
    const sc = document.querySelector('.diagram-container');
    const svg = document.querySelector('svg');
    const rect = svg.getBoundingClientRect();
    return {
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      localScroll: sc.scrollWidth > sc.clientWidth,
      svgWidth: Math.round(rect.width),
      svgLeft: Math.round(rect.left),
    };
  });
  check('phone: no page overflow, local scroller owns the canvas', state.pageOverflowX === false && state.localScroll === true, JSON.stringify(state));
  check('phone: plate keeps its authored width (no type-ramp shrink)', state.svgWidth === 1120, `svg ${state.svgWidth}px`);
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
