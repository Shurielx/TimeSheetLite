const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const appUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
  expect(await page.locator('#attendance-table tbody tr').count()).toBeGreaterThan(27);
});

test('edits a single cell and preserves a valid hours value', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  const hours = page.locator('.hours-input').first();
  await hours.fill('8.5');
  await hours.blur();
  await page.waitForTimeout(400);
  await page.reload();
  await page.locator('#edit-toggle').check();
  await expect(page.locator('.hours-input').first()).toHaveValue('8.5');
});

test('limits the sheet to eight employees', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  for (let count = 0; count < 5; count += 1) await page.locator('#add-employee-btn').click();
  await expect(page.locator('.employee-item')).toHaveCount(8);
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#add-employee-btn').click();
  await expect(page.locator('.employee-item')).toHaveCount(8);
});

test('edits column headers directly in the sheet', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  const headers = page.locator('.column-header-input');
  await headers.nth(0).fill('Presence');
  await headers.nth(1).fill('Total hours');
  await headers.nth(1).blur();
  await page.waitForTimeout(400);
  await page.reload();
  await page.locator('#edit-toggle').check();
  await expect(headers.nth(0)).toHaveValue('Presence');
  await expect(headers.nth(1)).toHaveValue('Total hours');
});

test('selects a different year from the year picker', async ({ page }) => {
  const currentYear = Number(await page.locator('#year-btn').textContent());
  await page.locator('#year-btn').click();
  await page.locator('.year-tile').filter({ hasText: String(currentYear + 1) }).click();
  await expect(page.locator('#year-btn')).toHaveText(String(currentYear + 1));
  await expect(page.locator('.main-header')).toContainText(String(currentYear + 1));
});

test('opens a standalone print preview with the current table', async ({ page }) => {
  await page.locator('#month-label').fill('Printable attendance sheet');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#print-btn').click();
  const printPage = await popupPromise;
  await printPage.waitForLoadState('domcontentloaded');
  await expect(printPage.locator('#attendance-table')).toBeVisible();
  await expect(printPage.locator('.main-header')).toHaveText('Printable attendance sheet');
  await expect(printPage.locator('#ui-panel')).toHaveCount(0);
  await printPage.close();
});

for (const layout of ['portrait', 'landscape']) {
  test(`uses the A4 printable area in ${layout}`, async ({ page }) => {
    await page.locator('#page-layout').selectOption(layout);
    await page.emulateMedia({ media: 'print' });
    const size = await page.locator('.sheet-page').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    const expected = layout === 'portrait'
      ? { width: 198 / 25.4 * 96, height: 285 / 25.4 * 96 }
      : { width: 285 / 25.4 * 96, height: 198 / 25.4 * 96 };
    expect(size.width).toBeCloseTo(expected.width, 0);
    expect(size.height).toBeGreaterThanOrEqual(expected.height - 1);
  });
}
