const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs/promises');
const appUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

async function seed(page, state) {
  await page.goto(appUrl);
  await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state);
  await page.reload();
}
async function layout(page) { await page.locator('#layout-settings summary').click(); }
async function downloadText(page, selector) {
  const pending = page.waitForEvent('download'); await page.locator(selector).click();
  return fs.readFile(await (await pending).path(), 'utf8');
}
test.beforeEach(async ({ page }) => { await page.goto(appUrl); });

test('custom columns keep values through hiding, moving, months and reload', async ({ page }) => {
  await page.locator('#edit-toggle').check(); await layout(page);
  await page.locator('#add-column-btn').click();
  const id = await page.locator('.column-card').last().getAttribute('data-column-id');
  await page.locator('.column-name').last().fill('Uwagi');
  const field = page.locator(`.cell-input[data-field="${id}"]`).first();
  await field.fill('Praca zdalna; druga zmiana');
  await page.locator('.column-card').last().getByRole('button', { name: 'Move earlier' }).click();
  await expect(page.locator(`.cell-input[data-field="${id}"]`).first()).toHaveValue('Praca zdalna; druga zmiana');
  await page.locator(`.column-card[data-column-id="${id}"] input[type=checkbox]`).uncheck();
  await expect(page.locator(`.cell-input[data-field="${id}"]`)).toHaveCount(0);
  await page.reload(); await layout(page);
  await expect(page.locator('#column-width-preset')).toHaveValue('custom');
  await page.locator(`.column-card[data-column-id="${id}"] input[type=checkbox]`).check();
  await expect(page.locator(`.cell-input[data-field="${id}"]`).first()).toHaveValue('Praca zdalna; druga zmiana');
  const month = await page.locator('#month-select').inputValue();
  await page.locator('#month-select').selectOption(String((Number(month) + 1) % 12));
  await expect(page.locator(`.cell-input[data-field="${id}"]`).first()).toHaveValue('');
  await page.locator('#month-select').selectOption(month);
  await expect(page.locator(`.cell-input[data-field="${id}"]`).first()).toHaveValue('Praca zdalna; druga zmiana');
});

test('employee order and width never move entries to a different person', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  await page.locator('.hours-input').first().fill('7,5');
  await page.locator('.employee-item').first().getByRole('button', { name: 'Move later: Employee 1', exact: true }).click();
  await expect(page.locator('.hours-input').nth(1)).toHaveValue('7,5');
  await page.locator('.emp-weight').nth(1).fill('2'); await page.locator('.emp-weight').nth(1).press('Tab');
  await page.reload();
  await expect(page.locator('.hours-input').nth(1)).toHaveValue('7,5');
  await expect(page.locator('.emp-weight').nth(1)).toHaveValue('2');
  const boxes = await page.locator('th.employee-name').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
  expect(boxes[1]).toBeGreaterThan(boxes[0] * 1.8);
});

test('JSON backup roundtrip preserves custom layout, hidden data and values', async ({ page }) => {
  await page.locator('#edit-toggle').check(); await layout(page); await page.locator('#add-column-btn').click();
  await page.locator('.column-name').last().fill('Notatki');
  await page.locator('.cell-input').nth(2).fill('Zapamiętaj mnie');
  await page.locator('.column-card').last().locator('input[type=checkbox]').uncheck();
  await page.locator('#dev-settings summary').click();
  const backup = await downloadText(page, '#export-btn');
  const parsed = JSON.parse(backup); expect(parsed.version).toBe(2);
  expect(parsed.state.columns.at(-1)).toMatchObject({ label: 'Notatki', visible: false });
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.locator('.column-card').last().locator('input[type=checkbox]').check();
  await expect(page.locator('.cell-input').nth(2)).toHaveValue('Zapamiętaj mnie');
});

test('legacy indexed backup migrates labels, widths and employee data', async ({ page }) => {
  await seed(page, { employees: ['Anna', 'Jan'], year: 2024, month: 1, editMode: true, colStatusName: 'Podpis', colHoursName: 'Czas', colWidthPreset: 'preset-80-20', data: { '2024-02-29:0': { status: 'Obecna', hours: '7.25' } } });
  await expect(page.locator('tbody tr')).toHaveCount(29);
  await expect(page.locator('.hours-input').nth(56)).toHaveValue('7.25');
  await expect(page.locator('.column-header-input').first()).toHaveValue('Podpis');
  await page.reload();
  await expect(page.locator('.hours-input').nth(56)).toHaveValue('7.25');
});

test('rejects invalid hours including values above 24 without corrupting totals', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  const input = page.locator('.hours-input').first();
  await input.fill('8,5'); await input.fill('24.99');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.total-hours-value').first()).toHaveText('8.5');
  await input.blur(); await expect(input).toHaveValue('8,5');
  await input.fill('24'); await input.blur();
  await expect(page.locator('.total-hours-value').first()).toHaveText('24');
  await page.reload(); await expect(page.locator('.hours-input').first()).toHaveValue('24');
});

test('fill affects only empty working-day hours and keeps custom data', async ({ page }) => {
  await seed(page, { year: 2026, month: 9, editMode: true, employees: [{ id: 'anna', name: 'Anna' }], data: { '2026-10-01:anna': { hours: '6.5', status: 'Szkolenie' } } });
  await layout(page); await page.locator('#add-column-btn').click();
  await page.locator('.cell-input').nth(2).fill('Notatka');
  await page.locator('#fill-workdays-btn').click();
  await expect(page.locator('.hours-input').first()).toHaveValue('6.5');
  await expect(page.locator('.hours-input').nth(2)).toHaveValue(''); // Saturday
  await expect(page.locator('.cell-input').nth(2)).toHaveValue('Notatka');
  await expect(page.locator('.total-hours-value').first()).toHaveText('174.5'); // 22 weekdays, one 6.5h
});

test('each hours column totals independently and exports only visible columns', async ({ page }) => {
  await page.locator('#edit-toggle').check(); await layout(page); await page.locator('#add-column-btn').click();
  await page.locator('.column-name').last().fill('Nadgodziny');
  await page.locator('.column-type').last().selectOption('hours');
  await page.locator('.hours-input').nth(0).fill('8');
  await page.locator('.hours-input').nth(1).fill('2.5');
  await expect(page.locator('.total-hours-value').nth(0)).toHaveText('8');
  await expect(page.locator('.total-hours-value').nth(1)).toHaveText('2.5');
  await page.locator('.column-card').first().locator('input[type=checkbox]').uncheck();
  const csv = await downloadText(page, '#export-csv-btn');
  expect(csv).toContain('Nadgodziny'); expect(csv).not.toContain(' - Status');
  expect(csv).toContain('"TOTAL";"8";"2.5"');
});

test('CSV escapes quoted headers and neutralizes formula-like text', async ({ page }) => {
  await page.locator('#edit-toggle').check(); await page.locator('.column-header-input').first().fill('Podpis "osoby"');
  await page.locator('.cell-input').first().fill('=1+1');
  const csv = await downloadText(page, '#export-csv-btn');
  expect(csv).toContain('Podpis ""osoby""'); expect(csv).toContain('"\'=1+1"');
});

test('invalid import is atomic and does not overwrite existing entries', async ({ page }) => {
  await page.locator('#edit-toggle').check(); await page.locator('.hours-input').first().fill('8');
  await page.locator('#dev-settings summary').click();
  const error = page.waitForEvent('dialog');
  await page.locator('#import-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ employees: ['Other'], year: 2026, month: 0, data: { '2026-01-01:0': { hours: '25' } } })) });
  await (await error).accept();
  await expect(page.locator('.hours-input').first()).toHaveValue('8');
  await expect(page.locator('.emp-name').first()).toHaveValue('Employee 1');
});

test('deleting a person preserves the other people and their entries', async ({ page }) => {
  await page.locator('#edit-toggle').check();
  await page.locator('.hours-input').nth(1).fill('7');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.emp-remove').first().click();
  await expect(page.locator('.hours-input').first()).toHaveValue('7');
  await page.reload(); await expect(page.locator('.hours-input').first()).toHaveValue('7');
});

test('mobile has no document overflow and every control remains reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#edit-toggle').check(); await layout(page);
  await page.locator('#add-column-btn').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#print-btn')).toBeVisible();
  await page.locator('#dark-toggle').check();
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await expect(page.locator('html')).not.toHaveClass(/dark-sheet/);
});

test('foreign holiday failure is visible and a late response cannot replace Poland', async ({ page }) => {
  await page.route('https://date.nager.at/**', route => route.abort());
  await page.locator('#dev-settings summary').click();
  await page.locator('#holiday-country').selectOption('DE');
  await expect(page.locator('#holiday-status')).toContainText('Could not load');
  await page.locator('#holiday-country').selectOption('PL');
  await page.locator('#month-select').selectOption('10');
  await expect(page.locator('tr[data-day="1"]')).toHaveClass('special-day');
  await expect(page.locator('#holiday-status')).toBeEmpty();
});

test('direct JSON file writes include later edits and report disk failures', async ({ page }) => {
  await page.addInitScript(() => {
    window.testFileWrites = [];
    window.showOpenFilePicker = async () => [];
    window.showSaveFilePicker = async () => ({ name: 'local.timesheet.json', createWritable: async () => ({
      write: async value => { if (window.testDiskFails) throw new Error('disk full'); window.testFileWrites.push(JSON.parse(value)); },
      close: async () => {},
    }) });
  });
  await page.reload(); await page.locator('#dev-settings summary').click();
  await page.locator('#create-data-file-btn').click();
  await expect(page.locator('#data-file-status')).toContainText('local.timesheet.json');
  await page.locator('#edit-toggle').check(); await page.locator('.hours-input').first().fill('7.5');
  await expect.poll(() => page.evaluate(() => window.testFileWrites.at(-1).state.data)).toMatchObject({ [await page.locator('.hours-input').first().evaluate(el => `${el.dataset.date}:${el.dataset.employeeId}`)]: { hours: '7.5' } });
  await page.evaluate(() => { window.testDiskFails = true; });
  await page.locator('.hours-input').first().fill('8');
  await expect(page.locator('#data-file-status')).toContainText('Could not save the file');
  expect(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('tsl-state')).data)[0].hours)).toBe('8');
});

test('removing a custom column removes only its data across months', async ({ page }) => {
  await seed(page, { year: 2026, month: 9, editMode: true, employees: ['Anna'], columns: [
    { id: 'hours', type: 'hours', weight: 1 }, { id: 'notes', label: 'Notes', type: 'text', weight: 1 },
  ], data: { '2026-10-01:0': { hours: '8', notes: 'October' }, '2026-11-01:0': { hours: '7', notes: 'November' } } });
  await layout(page); page.once('dialog', dialog => dialog.accept());
  await page.locator('.column-card').last().getByRole('button', { name: 'Remove: Notes', exact: true }).click();
  await expect(page.locator('.hours-input').first()).toHaveValue('8');
  await page.locator('#month-select').selectOption('10');
  await expect(page.locator('.hours-input').first()).toHaveValue('7');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('tsl-state')).data);
  expect(Object.values(data).some(entry => 'notes' in entry)).toBe(false);
});

test('print dimensions, title visibility and column width survive a reload', async ({ page }) => {
  await layout(page);
  await page.locator('#day-width').fill('25'); await page.locator('#day-width').press('Tab');
  await page.locator('#print-font-size').fill('12'); await page.locator('#print-font-size').press('Tab');
  await page.locator('#row-height').fill('9'); await page.locator('#row-height').press('Tab');
  await page.locator('#show-title').uncheck();
  await page.locator('.column-weight').first().fill('3'); await page.locator('.column-weight').first().press('Tab');
  await page.reload(); await layout(page);
  await expect(page.locator('#day-width')).toHaveValue('25');
  await expect(page.locator('#print-font-size')).toHaveValue('12');
  await expect(page.locator('#row-height')).toHaveValue('9');
  await expect(page.locator('.main-header')).toHaveCount(0);
  await expect(page.locator('.column-weight').first()).toHaveValue('3');
});

test('clicking switch labels works and active cell feedback follows keyboard navigation', async ({ page }) => {
  await page.locator('label[for="edit-toggle"]').last().click();
  await expect(page.locator('#edit-toggle')).toBeChecked();
  const hours = page.locator('.hours-input').first(); await hours.focus();
  await expect(page.locator('#active-cell-status')).toContainText('Employee 1');
  await expect(page.locator('#active-cell-status')).toContainText('Hours');
  const firstDate = await hours.getAttribute('data-date');
  await expect(page.locator('#active-cell-status')).toContainText(firstDate);
  await hours.press('Enter');
  const nextDate = await page.locator('.hours-input').nth(3).getAttribute('data-date');
  await expect(page.locator('#active-cell-status')).toContainText(nextDate);
  await expect(page.locator('.hours-input').nth(3)).toBeFocused();
  const outline = await page.locator('.hours-input').nth(3).evaluate(input => getComputedStyle(input).outlineColor);
  expect(outline).not.toBe('rgba(0, 0, 0, 0)');
});

test('clicking a preview column header focuses that header instead of a random field', async ({ page }) => {
  await page.locator('th.cell-hours').nth(1).click();
  await expect(page.locator('th.cell-hours').nth(1).locator('.column-header-input')).toBeFocused();
  await expect(page.locator('#active-cell-status')).toContainText('Hours');
});

test('clicking a preview day focuses its label and moving a column keeps visible focus', async ({ page }) => {
  await page.locator('tbody tr[data-day="3"] td').first().click();
  await expect(page.locator('tr[data-day="3"] .day-label-input')).toBeFocused();
  await layout(page);
  await page.locator('.column-card').last().getByRole('button', { name: 'Move earlier', exact: true }).click();
  await expect(page.locator('.column-name').first()).toBeFocused();
});
