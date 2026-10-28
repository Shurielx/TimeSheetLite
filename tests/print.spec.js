const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const appUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

for (const orientation of ['portrait', 'landscape']) {
  test(`A4 ${orientation}: largest font, tall rows and long labels preserve all text`, async ({ page }, testInfo) => {
    await page.goto(appUrl);
    const state = { year: 2026, month: 9, pageLayout: orientation, printFontSize: 12, rowHeight: 12, dayWidth: 35,
      monthLabel: 'SHEETTITLESTART ' + 'Long attendance title '.repeat(7) + ' TITLEEND',
      employees: [{ id: 'anna', name: 'Anna Nowak Long Employee Name NAMEEND' }], data: {}, dayLabels: {} };
    const markers = ['SHEETTITLESTART', 'TITLEEND', 'NAMEEND'];
    for (let day = 1; day <= 31; day++) {
      const key = `2026-10-${String(day).padStart(2, '0')}`;
      const marker = `MAXDAY${day}END`; markers.push(marker);
      state.dayLabels[key] = `Day ${day} label DAYLABEL${day}END`; markers.push(`DAYLABEL${day}END`);
      state.data[`${key}:anna`] = { status: 'Long complete entry '.repeat(8) + marker, hours: '24' };
    }
    await page.addInitScript(value => localStorage.setItem('tsl-state', JSON.stringify(value)), state); await page.reload();
    const pending = page.waitForEvent('popup'); await page.locator('#print-btn').click(); const popup = await pending;
    await popup.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true });
    await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers, orientation }));
  });
  for (const [year, month, days] of [[2026, 1, 28], [2024, 1, 29], [2026, 3, 30], [2026, 9, 31]]) {
    test(`A4 ${orientation}: ${days} days fit with all rows and totals`, async ({ page }, testInfo) => {
      await page.goto(appUrl);
      const state = { year, month, pageLayout: orientation, employees: [{ id: 'anna', name: 'Anna Nowak' }, { id: 'jan', name: 'Jan Kowalski' }, { id: 'ola', name: 'Aleksandra Wiśniewska' }], editMode: true, data: {} };
      const markers = [];
      for (let day = 1; day <= days; day++) {
        const marker = `DAY${String(day).padStart(2, '0')}END`; markers.push(marker);
        state.data[`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}:anna`] = { status: marker, hours: '8.5' };
      }
      await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state); await page.reload();
      const pending = page.waitForEvent('popup'); await page.locator('#print-btn').click(); const popup = await pending;
      await expect(popup.locator('tbody tr')).toHaveCount(days);
      await expect(popup.locator('.sub-header').first()).toHaveText('Status'); // Empty edit header uses its label.
      const pdf = await popup.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true, printBackground: true });
      expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
      await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers, orientation, pages: 1 }));
    });
  }
  test(`wide ${orientation}: no person, custom column or long entry disappears`, async ({ page }, testInfo) => {
    await page.goto(appUrl);
    const state = { year: 2026, month: 9, pageLayout: orientation, editMode: true, darkMode: true, darkSheet: true, employees: [], columns: [
      { id: 'status', label: 'Podpis pracownika', type: 'text', weight: 3 },
      { id: 'hours', label: 'Przepracowane godziny', type: 'hours', weight: 2 },
      { id: 'notes', label: 'Uwagi i miejsce pracy', type: 'text', weight: 4 },
      { id: 'hidden', label: 'PRIVATEHIDDEN', type: 'text', weight: 1, visible: false },
    ], data: {} };
    const markers = [];
    for (let employee = 1; employee <= 9; employee++) {
      const id = `person${employee}`; state.employees.push({ id, name: `Osoba ${employee} Długie nazwisko` });
      for (let day = 1; day <= 31; day++) {
        const marker = `D${String(day).padStart(2, '0')}P${employee}END`; markers.push(marker);
        const long = day === 31 ? ' Bardzo długi wpis, który musi zostać w całości wydrukowany i zawinięty bez wielokropka. KONIECDLUGIEGOWPISU' : '';
        state.data[`2026-10-${String(day).padStart(2, '0')}:${id}`] = { status: `Podpis ${day}`, hours: '7.25', notes: marker + long, hidden: 'PRIVATEHIDDEN' };
      }
    }
    await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state); await page.reload();
    const pending = page.waitForEvent('popup'); await page.locator('#print-btn').click(); const popup = await pending;
    await expect(popup.locator('th.employee-name')).toHaveCount(9);
    expect(await popup.locator('#print-root').textContent()).not.toContain('PRIVATEHIDDEN');
    const parts = await popup.locator('.print-panel').count(); expect(parts).toBeGreaterThan(1);
    const overflow = await popup.locator('td, th').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 2).length);
    expect(overflow).toBe(0);
    const pdf = await popup.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g).length).toBeGreaterThanOrEqual(parts);
    await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers: [...markers, 'KONIECDLUGIEGOWPISU'], forbidden: 'PRIVATEHIDDEN', orientation }));
  });
}

test('Ctrl+P uses the same printable content and preserves the editor afterwards', async ({ page }, testInfo) => {
  await page.goto(appUrl); await page.locator('#edit-toggle').check();
  await page.locator('.cell-input').first().fill('NATIVEPRINTEND');
  await page.locator('.hours-input').first().fill('8.25');
  const pdf = await page.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await expect(page.locator('#print-root')).toHaveCount(0);
  await expect(page.locator('.cell-input').first()).toHaveValue('NATIVEPRINTEND');
  await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers: ['NATIVEPRINTEND', '8.25'], orientation: 'portrait', pages: 1 }));
});

test('twelve columns and extreme proportions split without losing columns', async ({ page }, testInfo) => {
  await page.goto(appUrl);
  const columns = Array.from({ length: 12 }, (_, i) => ({ id: `custom${i}`, label: `Kolumna ${i + 1}`, type: 'text', weight: i % 2 ? 1 : 20 }));
  const cell = Object.fromEntries(columns.map((column, i) => [column.id, `COLUMN${i}END`]));
  const state = { year: 2026, month: 9, employees: [{ id: 'anna', name: 'Anna' }], columns, data: { '2026-10-31:anna': cell }, showTitle: false, showTotals: false };
  await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state); await page.reload();
  const pending = page.waitForEvent('popup'); await page.locator('#print-btn').click(); const popup = await pending;
  await expect(popup.locator('th.sub-header')).toHaveCount(12);
  await expect(popup.locator('.main-header')).toHaveCount(0);
  await popup.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true });
  await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers: Object.values(cell), orientation: 'portrait' }));
});

for (const orientation of ['portrait', 'landscape']) {
  for (const [label, people, extreme] of [['five people', 5, false], ['nine people, largest text and rows', 9, true]]) {
    test(`one-page fit ${orientation}: ${label} shrink onto a single A4 sheet`, async ({ page }, testInfo) => {
      await page.goto(appUrl);
      const state = { year: 2026, month: 9, pageLayout: orientation, printFit: 'page', employees: [], data: {},
        ...(extreme ? { printFontSize: 12, rowHeight: 12, dayWidth: 35, columns: [
          { id: 'status', label: 'Podpis pracownika', type: 'text', weight: 3 },
          { id: 'hours', label: 'Godziny', type: 'hours', weight: 1 },
          { id: 'notes', label: 'Uwagi', type: 'text', weight: 4 },
        ] } : {}) };
      const markers = [];
      for (let employee = 1; employee <= people; employee++) {
        const id = `person${employee}`; state.employees.push({ id, name: `Osoba ${employee} Długie nazwisko` });
        for (let day = 1; day <= 31; day++) {
          const marker = `D${String(day).padStart(2, '0')}P${employee}END`; markers.push(marker);
          const long = extreme && day === 31 ? ' Bardzo długi wpis zawinięty w komórce KONIECWPISU' : '';
          state.data[`2026-10-${String(day).padStart(2, '0')}:${id}`] = { status: marker + long, hours: '8', notes: extreme ? 'Biuro' : undefined };
        }
      }
      await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state); await page.reload();
      await expect(page.locator('#print-fit')).toHaveValue('page');
      const pending = page.waitForEvent('popup'); await page.locator('#print-btn').click(); const popup = await pending;
      await expect(popup.locator('.print-panel')).toHaveCount(1);
      await expect(popup.locator('th.employee-name')).toHaveCount(people);
      await expect(popup.locator('.print-panel-note')).toHaveCount(0);
      const pdf = await popup.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true, printBackground: true });
      expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
      await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers: extreme ? [...markers, 'KONIECWPISU'] : markers, orientation, pages: 1 }));
    });
  }
}

test('one-page fit also applies to Ctrl+P', async ({ page }, testInfo) => {
  await page.goto(appUrl);
  const employees = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Osoba ${i + 1}` }));
  const state = { year: 2026, month: 9, pageLayout: 'landscape', printFit: 'page', employees, data: { '2026-10-31:p6': { status: 'LASTPERSONEND', hours: '8' } } };
  await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state); await page.reload();
  const pdf = await page.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true });
  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers: ['LASTPERSONEND', 'Osoba7'], orientation: 'landscape', pages: 1 }));
});

for (const orientation of ['portrait', 'landscape']) {
  test(`fill page ${orientation}: rows stretch to the A4 height and can be turned off`, async ({ page }, testInfo) => {
    await page.goto(appUrl);
    const state = { year: 2026, month: 1, pageLayout: orientation, employees: [{ id: 'anna', name: 'Anna Nowak' }], data: { '2026-02-28:anna': { status: 'LASTFILLDAYEND', hours: '8' } } };
    await page.addInitScript(value => { if (!sessionStorage.getItem('test-seeded')) { localStorage.setItem('tsl-state', JSON.stringify(value)); sessionStorage.setItem('test-seeded', '1'); } }, state); await page.reload();
    await expect(page.locator('#print-fill')).toBeChecked();
    const height = async () => {
      const pending = page.waitForEvent('popup'); await page.locator('#print-btn').click(); const popup = await pending;
      const mm = await popup.locator('.print-panel').evaluate(el => el.getBoundingClientRect().height / (96 / 25.4));
      return { popup, mm };
    };
    const filled = await height();
    expect(filled.mm).toBeGreaterThan((orientation === 'portrait' ? 285 : 198) - 8);
    const pdf = await filled.popup.pdf({ path: testInfo.outputPath('sheet.pdf'), preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    await fs.writeFile(testInfo.outputPath('expected.json'), JSON.stringify({ markers: ['LASTFILLDAYEND'], orientation, pages: 1 }));
    await filled.popup.close();
    await page.locator('#print-fill').evaluate(el => { el.checked = false; el.dispatchEvent(new Event('change')); });
    expect((await height()).mm).toBeLessThan(filled.mm - 20);
  });
}
