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
