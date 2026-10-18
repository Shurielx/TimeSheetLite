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

test('allows nine people and splits wide printouts into readable parts', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  for (let count = 0; count < 6; count += 1) await page.locator('#add-employee-btn').click();
  await expect(page.locator('.employee-item')).toHaveCount(9);
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#print-btn').click();
  const popup = await popupPromise;
  await expect(popup.locator('.print-panel')).toHaveCount(3);
  await expect(popup.locator('th.employee-name')).toHaveCount(9);
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

test('keeps Polish and English interface translations complete', async ({ page }) => {
  const translationKeys = await page.evaluate(() => ({
    pl: Object.keys(window.TimeSheetI18n.I18N.pl).sort(),
    en: Object.keys(window.TimeSheetI18n.I18N.en).sort(),
  }));
  expect(translationKeys.pl).toEqual(translationKeys.en);

  await page.locator('#lang-select').selectOption('pl');
  await expect(page.locator('h1')).toContainText('Generator listy obecności');
  await expect(page.locator('[data-i18n="backup"]')).toHaveText('Kopia zapasowa');
  await expect(page.locator('[data-i18n="privacyDisclaimer"]')).toContainText('Korzystaj z aplikacji');
  await expect(page.locator('[data-i18n="privacyLink"]')).toHaveText('Szczegóły prywatności');
  await expect(page.locator('.privacy-link')).toHaveAttribute('href', /PRIVACY\.pl\.md$/);

  await page.locator('#lang-select').selectOption('en');
  await expect(page.locator('h1')).toContainText('Attendance Generator');
  await expect(page.locator('[data-i18n="backup"]')).toHaveText('Backup');
  await expect(page.locator('[data-i18n="privacyDisclaimer"]')).toContainText('Use the app');
  await expect(page.locator('[data-i18n="privacyLink"]')).toHaveText('Privacy details');
  await expect(page.locator('.privacy-link')).toHaveAttribute('href', /PRIVACY\.md$/);
});

test.describe('browser language detection', () => {
  test.use({ locale: 'pl-PL' });

  test('uses Polish only for a Polish browser and preserves manual English choice', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.locator('[data-i18n="title"]')).toHaveText('Generator listy obecności');

    await page.locator('#lang-select').selectOption('en');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-i18n="title"]')).toHaveText('Attendance Generator');
  });
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
  test(`uses the A4 printable width in ${layout}`, async ({ page }) => {
    await page.locator('#page-layout').selectOption(layout);
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#print-btn').click();
    const popup = await popupPromise;
    const rect = await popup.locator('.print-panel').boundingBox();
    expect(rect.width).toBeCloseTo((layout === 'portrait' ? 198 : 285) / 25.4 * 96, 0);
  });
}

test('adjusts column proportions according to column width preset on screen and in print', async ({ page }) => {
  await page.locator('#column-width-preset').selectOption('preset-90-10');
  const statusHeader = page.locator('th.cell-status').first();
  const hoursHeader = page.locator('th.cell-hours').first();
  
  const statusBox = await statusHeader.boundingBox();
  const hoursBox = await hoursHeader.boundingBox();
  expect(statusBox.width).toBeGreaterThan(hoursBox.width * 5);

  const popupPromise = page.waitForEvent('popup');
  await page.locator('#print-btn').click();
  const printPage = await popupPromise;
  await printPage.waitForLoadState('domcontentloaded');

  const printStatusHeader = printPage.locator('th.cell-status').first();
  const printHoursHeader = printPage.locator('th.cell-hours').first();
  const printStatusBox = await printStatusHeader.boundingBox();
  const printHoursBox = await printHoursHeader.boundingBox();
  expect(printStatusBox.width).toBeGreaterThan(printHoursBox.width * 5);
  await printPage.close();
});

test('wraps full column headers rather than truncating them', async ({ page }) => {
  await page.locator('#column-width-preset').selectOption('preset-90-10');
  const styles = await page.locator('th.cell-hours').first().evaluate(el => {
    const style = getComputedStyle(el);
    return { overflow: style.overflow, whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap };
  });
  expect(styles).toEqual({ overflow: 'visible', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
});

test('marks November 1st as a Polish holiday', async ({ page }) => {
  await page.locator('#month-select').selectOption('10');
  const nov1Row = page.locator('#attendance-table tbody tr[data-day="1"]');
  await expect(nov1Row).toHaveClass(/special-day/);
});

test('calculates total hours and updates live', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  const firstHours = page.locator('.hours-input').first();
  await firstHours.fill('8.5');
  await firstHours.blur();
  const totalCell = page.locator('.total-hours-value').first();
  await expect(totalCell).toContainText('8.5');

  const secondHours = page.locator('.hours-input').nth(3);
  await secondHours.fill('7.5');
  await secondHours.blur();
  await expect(totalCell).toContainText('16');
});

test('synchronizes employee name between sidebar and table header live', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  const sidebarName = page.locator('.emp-name').first();
  await sidebarName.fill('Anna Nowak');
  const tableHeader = page.locator('th.employee-name').first();
  await expect(tableHeader.locator('.employee-name-input')).toHaveValue('Anna Nowak');
});

test('allows clearing month label without reverting', async ({ page }) => {
  const monthLabel = page.locator('#month-label');
  await monthLabel.fill('Custom Title');
  await expect(page.locator('.main-header')).toHaveText('Custom Title');
  await monthLabel.fill('');
  await expect(monthLabel).toHaveValue('');
  await expect(page.locator('.main-header')).toContainText('2026');
});

test('fills working days with 8 hours and clears month', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  await page.locator('#fill-workdays-btn').click();
  const totalCell = page.locator('.total-hours-value').first();
  const totalText = await totalCell.textContent();
  const totalHours = parseFloat(totalText.replace(',', '.'));
  expect(totalHours).toBeGreaterThan(100);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#clear-month-btn').click();
  await expect(page.locator('.total-hours-value').first()).toHaveText('0');
});

test('exports data to CSV file', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-csv-btn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^timesheet-\d{4}-\d{2}\.csv$/);
});

test('clicking a table cell when edit mode is off enables edit mode and focuses input', async ({ page }) => {
  await expect(page.locator('#edit-toggle')).not.toBeChecked();
  const firstDataCell = page.locator('#attendance-table tbody tr').first().locator('.cell-hours').first();
  await firstDataCell.click();
  await expect(page.locator('#edit-toggle')).toBeChecked();
  await expect(page.locator('.hours-input').first()).toBeFocused();
});

test('navigates with Enter key to the next day row', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  const firstHours = page.locator('.hours-input').first();
  await firstHours.focus();
  await firstHours.fill('8');
  await page.keyboard.press('Enter');
  const secondHours = page.locator('.hours-input').nth(3);
  await expect(secondHours).toBeFocused();
});

test('toggles total hours visibility on the sheet and CSV export', async ({ page }) => {
  await expect(page.locator('#show-totals-toggle')).toBeChecked();
  await expect(page.locator('.total-row')).toBeVisible();

  await page.locator('#show-totals-toggle').uncheck();
  await expect(page.locator('.total-row')).toHaveCount(0);

  await page.locator('#show-totals-toggle').check();
  await expect(page.locator('.total-row')).toBeVisible();
});

