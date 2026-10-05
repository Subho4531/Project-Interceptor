import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
await mkdir(new URL('../artifacts/qa/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.error('PAGE ERROR', String(e)));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(m.type(), m.text().slice(0, 1500)); });
  await page.goto('http://127.0.0.1:4173/?qa=1');
  await page.waitForTimeout(10000);
  console.log(await page.locator('body').innerText());
  console.log(await page.evaluate(() => window.__trainerQA?.snapshot()));
  await page.screenshot({ path: new URL('../artifacts/qa/inspection.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
} finally { await browser.close(); }
