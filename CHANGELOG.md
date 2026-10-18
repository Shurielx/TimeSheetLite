# Changelog

## 1.3.0 — 2026-10-18

- Add up to 12 customizable columns per person: text/signature or hours, with independent hour totals.
- Add column names, ordering, visibility, relative widths and removal across months. Hiding preserves entries and JSON backups while excluding the column from print and CSV.
- Support up to 100 people with stable entry ownership, ordering and relative group widths.
- Improve editor text size, wrapping, horizontal scrolling, mobile layout, light/dark themes and keyboard focus. Identify the active date, person and column in the toolbar; make switch labels clickable.
- Replace truncated print text with wrapping and split wide tables into readable A4 parts. Use the same preparation for the print button and Ctrl+P, repeat headers on continuation pages, and preserve totals.
- Add configurable print font size, minimum row height, day-column width and sheet-title visibility.
- Reject hours above 24, keep existing hours when filling working days, preserve custom entries, escape CSV headers and protect formula-like CSV text.
- Introduce version 2 JSON backups with layout migration from older backups. Report local-file write failures while preserving browser data.
- Add automated browser and generated-PDF checks before Pages deployment, including A4 dimensions, text completeness and text/table-border margins.

## 1.2.1

- Add the total-hours visibility toggle and asset cache busting.

## 1.2.0

- Add total hours, CSV export, working-day fill and Polish holidays; refine editing behavior.
