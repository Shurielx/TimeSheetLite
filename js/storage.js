(function () {
  'use strict';

  const STORAGE_KEY = 'tsl-state';
  const MAX_EMPLOYEES = 100;
  const MAX_TEXT_LENGTH = 200;
  const MAX_DATES = 2000;
  const MAX_DATA_ENTRIES = 20000;
  const VALID_COUNTRIES = new Set(['PL', 'GB', 'DE', 'FR', 'ES', 'IT', 'US', 'UA', 'CZ', 'SK']);
  const VALID_WIDTH_PRESETS = new Set(['preset-90-10', 'preset-80-20', 'preset-50-50', 'preset-20-80']);

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function newEmployeeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `emp-${window.crypto.randomUUID()}`;
    }
    return `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function text(value, fallback = '') {
    if (typeof value !== 'string') return fallback;
    return value.trim().slice(0, MAX_TEXT_LENGTH);
  }

  function validDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return year >= 1900 && year <= 2200 && month >= 1 && month <= 12 &&
      day >= 1 && day <= new Date(year, month, 0).getDate() &&
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function normalizeEmployees(input) {
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_EMPLOYEES) {
      throw new Error('Lista pracowników ma nieprawidłowy rozmiar.');
    }

    const ids = new Set();
    const employees = input.map((item, index) => {
      const legacyName = typeof item === 'string';
      const name = text(legacyName ? item : item && item.name, `Pracownik ${index + 1}`);
      let id = legacyName ? newEmployeeId() : item && item.id;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || ids.has(id)) {
        id = newEmployeeId();
      }
      ids.add(id);
      return { id, name: name || `Pracownik ${index + 1}` };
    });

    return { employees, ids, legacy: input.some(item => typeof item === 'string') };
  }

  function normalizeDateSet(value, fieldName) {
    if (value === undefined) return new Set();
    if (!Array.isArray(value) || value.length > MAX_DATES) {
      throw new Error(`${fieldName} ma nieprawidłowy format.`);
    }
    return new Set(value.filter(validDateKey));
  }

  function normalizeData(value, employees, legacyEmployees) {
    if (value === undefined) return Object.create(null);
    if (!isPlainObject(value) || Object.keys(value).length > MAX_DATA_ENTRIES) {
      throw new Error('Wpisy tabeli mają nieprawidłowy format.');
    }

    const ids = new Set(employees.map(employee => employee.id));
    const result = Object.create(null);
    Object.entries(value).forEach(([key, cell]) => {
      const separator = key.lastIndexOf(':');
      if (separator <= 0 || !validDateKey(key.slice(0, separator)) || !isPlainObject(cell)) return;
      const date = key.slice(0, separator);
      const employeeRef = key.slice(separator + 1);
      let employeeId = employeeRef;
      if (/^\d+$/.test(employeeRef) && (legacyEmployees || !ids.has(employeeRef))) {
        employeeId = employees[Number(employeeRef)] && employees[Number(employeeRef)].id;
      }
      if (!employeeId || !ids.has(employeeId)) return;
      result[`${date}:${employeeId}`] = {
        status: text(cell.status),
        hours: text(cell.hours),
      };
    });
    return result;
  }

  function normalizeLabels(value) {
    if (value === undefined) return Object.create(null);
    if (!isPlainObject(value) || Object.keys(value).length > MAX_DATES) {
      throw new Error('Opisy dni mają nieprawidłowy format.');
    }
    const result = Object.create(null);
    Object.entries(value).forEach(([key, label]) => {
      if (validDateKey(key) && typeof label === 'string') result[key] = text(label);
    });
    return result;
  }

  function createStorage(state) {
    function toSerializableState() {
      return {
        month: state.month,
        year: state.year,
        monthLabel: state.monthLabel,
        employees: state.employees.map(employee => ({ id: employee.id, name: employee.name })),
        editMode: state.editMode,
        darkMode: state.darkMode,
        darkSheet: state.darkSheet,
        specialDays: [...state.specialDays],
        normalDays: [...state.normalDays],
        data: { ...state.data },
        dayLabels: { ...state.dayLabels },
        lang: state.lang,
        holidayCountry: state.holidayCountry,
        colStatusName: state.colStatusName,
        colHoursName: state.colHoursName,
        colWidthPreset: state.colWidthPreset,
        pageLayout: state.pageLayout,
      };
    }

    function applyState(data) {
      if (!isPlainObject(data)) throw new Error('Kopia nie zawiera prawidłowego stanu.');
      const employeeInput = data.employees === undefined ? state.employees : data.employees;
      const employeeResult = normalizeEmployees(employeeInput);
      const year = data.year === undefined ? state.year : data.year;
      const month = data.month === undefined ? state.month : data.month;
      if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error('Nieprawidłowy rok.');
      if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error('Nieprawidłowy miesiąc.');

      const next = {
        month,
        year,
        monthLabel: text(data.monthLabel),
        employees: employeeResult.employees,
        editMode: Boolean(data.editMode),
        darkMode: Boolean(data.darkMode),
        darkSheet: Boolean(data.darkSheet),
        specialDays: normalizeDateSet(data.specialDays, 'Dni specjalne'),
        normalDays: normalizeDateSet(data.normalDays, 'Dni robocze'),
        data: normalizeData(data.data, employeeResult.employees, employeeResult.legacy),
        dayLabels: normalizeLabels(data.dayLabels),
        lang: data.lang === 'pl' || data.lang === 'en' ? data.lang : state.lang,
        holidayCountry: VALID_COUNTRIES.has(data.holidayCountry) ? data.holidayCountry : state.holidayCountry,
        colStatusName: text(data.colStatusName),
        colHoursName: text(data.colHoursName),
        colWidthPreset: VALID_WIDTH_PRESETS.has(data.colWidthPreset) ? data.colWidthPreset : 'preset-50-50',
        pageLayout: data.pageLayout === 'landscape' ? 'landscape' : 'portrait',
      };
      Object.assign(state, next);
    }

    function save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSerializableState()));
        return true;
      } catch (error) {
        console.warn('Failed to save state:', error);
        return false;
      }
    }

    function load() {
      let raw = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        if (raw.length > 1024 * 1024) throw new Error('Zapisane dane przekraczają limit 1 MB.');
        applyState(JSON.parse(raw));
        return true;
      } catch (error) {
        console.warn('Failed to load state:', error);
        // Preserve an unreadable state instead of silently replacing it with defaults.
        try {
          if (raw) localStorage.setItem(`${STORAGE_KEY}-recovery`, raw);
        } catch (recoveryError) {
          console.warn('Failed to preserve unreadable state:', recoveryError);
        }
        return false;
      }
    }

    function exportToFile() {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        state: toSerializableState(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `timesheet-${state.year}-${String(state.month + 1).padStart(2, '0')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }

    function importFromFile(file, onImported, onError) {
      const reportError = error => {
        if (typeof onError === 'function') onError(error);
        else alert('Nie udało się zaimportować pliku: ' + error.message);
      };
      if (!file || file.size > 1024 * 1024) {
        reportError(new Error('plik jest pusty albo przekracza limit 1 MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const parsed = JSON.parse(event.target.result);
          const importedState = isPlainObject(parsed) && parsed.state !== undefined ? parsed.state : parsed;
          const previousState = toSerializableState();
          applyState(importedState);
          if (!save()) {
            applyState(previousState);
            throw new Error('Nie udało się zapisać zaimportowanych danych.');
          }
          onImported();
        } catch (error) {
          reportError(error);
        }
      };
      reader.onerror = () => reportError(new Error('Nie udało się odczytać pliku kopii.'));
      reader.readAsText(file);
    }

    function reset() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}-recovery`);
      localStorage.removeItem('tsl-dark-mode');
      localStorage.removeItem('tsl-dark-sheet');
      location.reload();
    }

    // Convert the built-in legacy string list to stable employee records too.
    applyState({});

    return Object.freeze({ save, load, exportToFile, importFromFile, reset });
  }

  window.TimeSheetStorage = Object.freeze({ create: createStorage });
})();
