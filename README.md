# TimeSheetLite v1.3.1

Simple attendance sheet generator for printing or saving as PDF. Everything is kept locally in your browser.

[Polska instrukcja](README.pl.md) · [Changelog](CHANGELOG.md)

**[Open TimeSheetLite](https://shurielx.github.io/TimeSheetLite/)** · [View the repository](https://github.com/Shurielx/TimeSheetLite)

Current release: **v1.3.1**. Created by [Shuriel](https://github.com/Shurielx). [Report an issue](https://github.com/Shurielx/TimeSheetLite/issues/new) or [suggest something](https://github.com/Shurielx/TimeSheetLite/issues/new).

## What you can do

- choose a month and year with flexible navigation;
- add up to 100 people, reorder them, and adjust the relative width of each person’s group;
- add up to 12 columns per person: text/signature or hours (0–24), each with its own total;
- rename, reorder, hide or remove columns, and set their relative widths;
- enter status and hours for each day with Excel-like keyboard navigation (Enter/arrows);
- click any table cell to immediately begin editing;
- fill empty working-day hours with 8, keeping existing entries and custom columns;
- toggle monthly total hours row on/off with live preview, print and CSV synchronization;
- automatic monthly total hours calculation for each employee;
- mark non-working days and Polish public holidays (including All Saints' Day, Christmas Eve from 2025);
- print on A4 in portrait or landscape, or save as PDF; wide tables split into readable parts and long entries wrap;
- export directly to Excel-friendly CSV;
- export and import a JSON backup;
- choose a local JSON data file in Settings (supported browsers save changes back to that file).

## Quick use

1. Pick the month and year.
2. Enter or edit people and their data (or click any cell to start typing).
3. Use **Fill working days (8h)** for fast routine scheduling.
4. Open **Table layout** to customize columns, day width, print font size, row height and title visibility.
5. Select portrait or landscape.
6. Use **Print / Save PDF** or **Export CSV**.

Entries are saved only in the browser on the current device. Export a backup before clearing browser data or moving to another computer.

## Editing and printing

Columns repeat for **each person**; they are shared across months. Widths are relative: a column with width 2 gets twice the space of width 1. People also have relative widths (1–5). The screen keeps narrow columns readable with horizontal scrolling. Click a cell to enable editing; Enter/Shift+Enter move between days and Tab moves between fields.

The toolbar identifies the date, person and column of the active field. A visible focus outline marks the selected cell or control. Switch captions are clickable; moving a person or column moves focus with that item. The screen preview is an editor, not an exact paper-page preview; use **Print / Save PDF** to inspect the print layout.

Hiding a column preserves its entries in local storage and JSON backups; it excludes the column from the sheet, printout and CSV. Removing a column or person deletes their entries from **every month**, after confirmation. Clearing a month clears every column for that month, including hidden columns. Keep a JSON backup before deleting data.

Print uses A4 with 6 mm margins. Choose **100% scale** and turn off browser headers/footers. Text prints at the chosen 8–12 pt size. When the table is too wide, people or column groups continue on separate parts with repeated dates and headings. Long rows can continue onto further pages, with repeated column headers. The preview reports horizontal parts, not the final number of paper pages. A normal sheet with three people, two equal columns and 28–31 days fits one A4 page at default settings, in either orientation. Custom widths, long text, larger fonts or taller rows may require more pages. To keep everything on one sheet instead, set **Wide tables → Shrink to one A4 page**; the whole table is scaled down to fit, so text gets smaller as the table grows.

The print button and browser Ctrl+P use the same table preparation. PDF layout has been tested in Chromium; physical printer margins and other browser print engines can differ.

JSON backups use version 2 and include the layout. Older backups with indexed employee data and status/hours columns are migrated automatically. Keep a backup before switching to an older application version, which does not understand custom columns.

## Development checks

```sh
npm ci
npx playwright install chromium
npm run check
npm test
```

The browser suite covers editing, persistence, layout changes, migration, JSON/CSV exports, mocked local-file writes and failures, mobile layout, holiday failures, and actual PDF output. Print tests leave synthetic PDF fixtures under `test-results/`. To independently check all text markers, page sizes and text margins in those PDFs:

```sh
python -m pip install -r scripts/requirements-pdf.txt
python scripts/verify_pdfs.py
```

Direct local-file tests mock the browser file picker; they do not validate operating-system permission dialogs or hardware disk behavior.

GitHub Actions runs the browser suite and independently checks generated PDF text, A4 dimensions, blank pages, and margins for both text and table borders before deploying the static site to Pages. Only the application and privacy files are published; test data and generated PDFs are excluded.

## Privacy

Your data is stored in the current browser's local storage. GitHub Pages only serves the static application; it does not receive or store your attendance data. The optional local JSON file is read and written directly by your browser and is never uploaded by this application. Exported CSV and JSON files are generated directly on your device. If you select a country other than Poland, the app sends only the selected year and country code to [Nager.Date](https://date.nager.at/) to load public holidays. Attendance data is not sent.

The direct local-file buttons require a Chromium-based browser on HTTPS (including GitHub Pages). Other browsers can still use CSV and JSON export/import. Data and backups are not encrypted, so use a trusted device and keep exported files private.

Read [Privacy](PRIVACY.md) before using the app with personal data.

## License

MIT
