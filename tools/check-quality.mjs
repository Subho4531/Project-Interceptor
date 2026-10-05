import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:4173/?qa=1');
  await page.waitForFunction(() => window.__trainerQA?.snapshot().ready, undefined, { timeout: 60000 });
  const before = await page.evaluate(() => window.__trainerQA.snapshot());
  await page.getByRole('button', { name: 'Environment settings' }).click();
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('low');
  await page.waitForTimeout(500);
  const low = await page.evaluate(() => window.__trainerQA.snapshot());
  assert.equal(low.meshes, before.meshes); assert.equal(low.materials, before.materials); assert.equal(low.textures, before.textures);
  assert.deepEqual(low.conditions, before.conditions); assert.deepEqual(low.camera, before.camera); assert.equal(low.time, before.time);
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('standard');
  await page.getByLabel('Visibility', { exact: true }).selectOption('reduced');
  const reducedDay = await page.evaluate(() => window.__trainerQA.snapshot());
  assert.deepEqual(reducedDay.conditions, { timeOfDay: 'day', visibility: 'reduced' });
  await page.getByLabel('Lighting', { exact: true }).selectOption('night');
  await page.getByLabel('Visibility', { exact: true }).selectOption('clear');
  const clearNight = await page.evaluate(() => window.__trainerQA.snapshot());
  assert.deepEqual(clearNight.conditions, { timeOfDay: 'night', visibility: 'clear' });
  await writeFile(new URL('../artifacts/qa/quality-report.json', import.meta.url), JSON.stringify({ passed: true, checks: ['Performance and standard quality preserve resources, position, time and conditions', 'Day/reduced and night/clear combinations'], before, low, reducedDay, clearNight }, null, 2));
  console.log('Quality controls and alternate lighting/visibility combinations: PASS');
} finally { await browser.close(); }
