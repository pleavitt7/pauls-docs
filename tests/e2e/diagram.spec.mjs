// Throwaway Playwright check for the Starlight diagram integration.
// Run: npx -y playwright@1.64.1 test tests/e2e --config tests/e2e/playwright.config.mjs
import { expect, test } from '@playwright/test';

const PAGE = '/diagrams/proxmox-hermes/';
const STANDALONE = '/diagrams/proxmox-hermes-architecture.html';
const FRAME = '[data-diagram-frame]';

// Views may legitimately scroll vertically; only unexpected horizontal overflow is a defect.
const horizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

// The plate scales with its column, so its right edge must stay inside the scroller
// until the readability floor forces scrolling.
const plateClipping = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector('.diagram-scroll svg');
    const scroller = document.querySelector('.diagram-scroll');
    return {
      svgRight: Math.round(svg.getBoundingClientRect().right),
      scrollerRight: Math.round(scroller.getBoundingClientRect().right),
      scrolled: scroller.scrollWidth > scroller.clientWidth,
    };
  });

const innerOverflow = (frame) =>
  frame.locator('html').evaluate((el) => ({
    x: el.scrollWidth > el.clientWidth,
    y: el.scrollHeight > el.clientHeight,
  }));

test.describe('Starlight diagram integration', () => {
  test('the diagram follows the page theme in both directions', async ({ page }) => {
    await page.goto(PAGE);

    const frame = page.frameLocator(FRAME);
    const root = frame.locator('html');

    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(root).toHaveCSS('background-color', 'rgb(23, 24, 28)');

    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await expect(root).toHaveAttribute('data-theme', 'light');
    await expect(root).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('the diagram renders in the same font families as the page', async ({ page }) => {
    await page.goto(PAGE);

    const pageFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const frame = page.frameLocator(FRAME);
    const nodeFont = await frame.locator('.node-name').first().evaluate((el) => getComputedStyle(el).fontFamily);
    const detailFont = await frame.locator('.node-detail').first().evaluate((el) => getComputedStyle(el).fontFamily);

    expect(pageFont.split(',')[0]).toBe('-apple-system');
    expect(nodeFont.split(',')[0]).toBe(pageFont.split(',')[0]);
    expect(detailFont).toMatch(/ui-monospace/);
  });

  test('the diagram content renders and the embed hides standalone chrome', async ({ page }) => {
    await page.goto(PAGE);

    const frame = page.frameLocator(FRAME);
    await expect(frame.locator('.node-name', { hasText: 'Home Assistant OS' })).toBeVisible();
    await expect(frame.locator('.node-name', { hasText: 'Hermes Agent Runtime' })).toBeVisible();
    await expect(frame.locator('.node-name', { hasText: 'Hindsight Memory' })).toBeVisible();
    await expect(frame.locator('.node-name', { hasText: 'PostgreSQL' })).toBeVisible();
    await expect(frame.locator('.node-name')).toHaveCount(8);
    await expect(frame.locator('.connector-label', { hasText: 'CALLER MEMORY' })).toBeVisible();
    await expect(frame.locator('.connector-label', { hasText: 'MEMORY API' })).toBeVisible();
    await expect(frame.locator('.masthead')).toBeHidden();
    await expect(frame.locator('svg')).toBeVisible();
  });

  test('the page never overflows horizontally and the embed has no inner scrollbars', async ({ page }) => {
    for (const width of [1920, 1440, 1280, 1024, 900, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PAGE);

      expect(await horizontalOverflow(page), `page overflow at ${width}px`).toBe(false);
      expect(await innerOverflow(page.frameLocator(FRAME)), `iframe overflow at ${width}px`).toEqual({
        x: false,
        y: false,
      });
    }
  });

  test('phones replace the embed with a tappable link to the standalone diagram', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);

    await expect(page.locator('.diagram-preview')).toBeHidden();
    const link = page.locator('.mobile-open');
    await expect(link).toBeVisible();

    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(await horizontalOverflow(page)).toBe(false);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${STANDALONE.replace(/\./g, '\\.')}$`));
  });

  test('the standalone diagram follows the operating system theme', async ({ browser }) => {
    for (const scheme of ['light', 'dark']) {
      const context = await browser.newContext({ colorScheme: scheme });
      const standalone = await context.newPage();
      await standalone.goto(STANDALONE);

      await expect(standalone.locator('html')).toHaveAttribute('data-theme', scheme);
      const state = await standalone.evaluate(() => ({
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        overflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        scroller: getComputedStyle(document.querySelector('.diagram-scroll')).display,
      }));
      expect(state.overflowX, `standalone overflow at ${scheme}`).toBe(false);
      expect(state.scroller).not.toBe('none');

      await context.close();
    }
  });

  test('the standalone plate scales with its column and never clips', async ({ page }) => {
    for (const width of [1920, 1600, 1440, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(STANDALONE);

      const clip = await plateClipping(page);
      expect(clip.scrolled, `plate needs no scroll at ${width}px`).toBe(false);
      expect(clip.svgRight, `plate right edge inside scroller at ${width}px`).toBeLessThanOrEqual(
        clip.scrollerRight,
      );
      expect(await horizontalOverflow(page)).toBe(false);
    }
  });

  test('the site theme toggle updates the diagram end to end', async ({ page }) => {
    await page.goto(PAGE);

    const root = page.frameLocator(FRAME).locator('html');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);

    await page.selectOption('starlight-theme-select select', before === 'dark' ? 'light' : 'dark');
    const after = await page.evaluate(() => document.documentElement.dataset.theme);

    expect(after).not.toBe(before);
    await expect(root).toHaveAttribute('data-theme', after);
  });
});
