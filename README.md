# TimeSheetLite v1.2.0

Simple attendance sheet generator for printing or saving as PDF. Everything is kept locally in your browser.

**[Open TimeSheetLite](https://shurielx.github.io/TimeSheetLite/)** · [View the repository](https://github.com/Shurielx/TimeSheetLite)

Current release: **v1.2.0**. Created by [Shuriel](https://github.com/Shurielx). [Report an issue](https://github.com/Shurielx/TimeSheetLite/issues/new) or [suggest something](https://github.com/Shurielx/TimeSheetLite/issues/new).

## What you can do

- choose a month and year with flexible navigation;
- add up to eight people for a readable A4 sheet;
- enter status and hours for each day with Excel-like keyboard navigation (Enter/arrows);
- click any table cell to immediately begin editing;
- one-click fill standard working days with 8 hours;
- automatic monthly total hours calculation for each employee;
- mark non-working days and Polish public holidays (including All Saints' Day, Christmas Eve from 2025);
- print on A4 in portrait or landscape, or save as PDF;
- export directly to Excel-friendly CSV;
- export and import a JSON backup;
- choose a local JSON data file in Settings (supported browsers save changes back to that file).

## Quick use

1. Pick the month and year.
2. Enter or edit people and their data (or click any cell to start typing).
3. Use **Fill working days (8h)** for fast routine scheduling.
4. Select portrait or landscape.
5. Use **Print / Save PDF** or **Export CSV**.

Entries are saved only in the browser on the current device. Export a backup before clearing browser data or moving to another computer.

## Privacy

Your data is stored in the current browser's local storage. GitHub Pages only serves the static application; it does not receive or store your attendance data. The optional local JSON file is read and written directly by your browser and is never uploaded by this application. Exported CSV and JSON files are generated directly on your device. If you select a country other than Poland, the app sends only the selected year and country code to [Nager.Date](https://date.nager.at/) to load public holidays. Attendance data is not sent.

The direct local-file buttons require a Chromium-based browser on HTTPS (including GitHub Pages). Other browsers can still use CSV and JSON export/import. Data and backups are not encrypted, so use a trusted device and keep exported files private.

Read [Privacy](PRIVACY.md) before using the app with personal data.

## License

MIT
