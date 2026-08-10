(function () {
  'use strict';

  const HOLIDAY_API = 'https://date.nager.at/api/v3/PublicHolidays';

  function daysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
  }

  function dateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isWeekend(year, month, day) {
    const dayOfWeek = new Date(year, month, day).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  async function fetchHolidaysFromAPI(year, countryCode, signal) {
    const response = await fetch(`${HOLIDAY_API}/${year}/${countryCode}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Invalid holiday API response');

    const holidays = new Set();
    payload.forEach(item => {
      // Nager marks regional holidays with global=false. Do not apply those country-wide.
      if (item && item.global === true && typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
        holidays.add(item.date);
      }
    });
    return holidays;
  }

  function computePolishHolidaysLocally(year) {
    const holidays = new Set();
    const fixedHolidays = [
      [1, 1],   // Nowy Rok
      [1, 6],   // Trzech Króli
      [5, 1],   // Święto Pracy
      [5, 3],   // Konstytucja 3 Maja
      [8, 15],  // Wniebowzięcie NMP
      [11, 11], // Dzień Niepodległości
      ...(year >= 2025 ? [[12, 24]] : []), // Wigilia, ustawowo wolna od 2025 r.
      [12, 25], // Boże Narodzenie (pierwszy dzień)
      [12, 26], // Boże Narodzenie (drugi dzień)
    ];

    fixedHolidays.forEach(([month, day]) => {
      holidays.add(dateKey(year, month - 1, day));
    });

    // Movable holidays calculated with the Gregorian Easter algorithm.
    const easter = computeEaster(year);
    const easterDate = new Date(year, 2, easter);

    const easterMonday = new Date(easterDate);
    easterMonday.setDate(easterMonday.getDate() + 1);
    holidays.add(dateKey(easterMonday.getFullYear(), easterMonday.getMonth(), easterMonday.getDate()));

    const corpusChristi = new Date(easterDate);
    corpusChristi.setDate(corpusChristi.getDate() + 60);
    holidays.add(dateKey(corpusChristi.getFullYear(), corpusChristi.getMonth(), corpusChristi.getDate()));

    return holidays;
  }

  function computeEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return month === 3 ? day : day + 31;
  }

  window.TimeSheetHolidays = Object.freeze({
    daysInMonth,
    dateKey,
    isWeekend,
    fetchHolidaysFromAPI,
    computePolishHolidaysLocally,
  });
})();
