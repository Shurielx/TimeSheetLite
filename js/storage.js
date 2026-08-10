(function () {
  'use strict';

  const STORAGE_KEY = 'tsl-state';
  const MAX_EMPLOYEES = 100;
  const MAX_TEXT_LENGTH = 200;
  const MAX_DATES = 2000;
  const MAX_DATA_ENTRIES = 20000;
  const VALID_COUNTRIES = new Set(['PL', 'GB', 'DE', 'FR', 'ES', 'IT', 'US', 'UA', 'CZ', 'SK']);
  const VALID_WIDTH_PRESETS = new Set(['preset-90-10', 'preset-80-20', 'preset-50-50', 'preset-20-80']);
  const MAX_FILE_SIZE = 1024 * 1024;

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

  function message(state, key, fallback, replacements = {}) {
    const translations = window.TimeSheetI18n && window.TimeSheetI18n.I18N;
    let value = translations && translations[state.lang] && translations[state.lang][key];
    if (value === undefined && translations && translations.en) value = translations.en[key];
    value = value || fallback;
    Object.entries(replacements).forEach(([name, replacement]) => {
      value = value.replace(`{${name}}`, replacement);
    });
    return value;
  }

  function parseJson(value, state) {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(message(state, 'invalidJson', 'The file does not contain valid JSON.'));
    }
  }

  function validDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return year >= 1900 && year <= 2200 && month >= 1 && month <= 12 &&
      day >= 1 && day <= new Date(year, month, 0).getDate() &&
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function normalizeEmployees(input, state) {
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_EMPLOYEES) {
      throw new Error(message(state, 'employeeListInvalid', 'The employee list has an invalid size.'));
    }

    const ids = new Set();
    const employees = input.map((item, index) => {
      const legacyName = typeof item === 'string';
      const fallbackName = message(state, 'employeeFallback', 'Employee {index}', { index: index + 1 });
      const name = text(legacyName ? item : item && item.name, fallbackName);
      let id = legacyName ? newEmployeeId() : item && item.id;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || ids.has(id)) {
        id = newEmployeeId();
      }
      ids.add(id);
      return { id, name: name || fallbackName };
    });

    return { employees, ids, legacy: input.some(item => typeof item === 'string') };
  }

  function normalizeDateSet(value, fieldName, state) {
    if (value === undefined) return new Set();
    if (!Array.isArray(value) || value.length > MAX_DATES) {
      throw new Error(message(state, 'invalidFormat', '{field} has an invalid format.', {
        field: message(state, fieldName, fieldName),
      }));
    }
    return new Set(value.filter(validDateKey));
  }

  function normalizeData(value, employees, legacyEmployees, state) {
    if (value === undefined) return Object.create(null);
    if (!isPlainObject(value) || Object.keys(value).length > MAX_DATA_ENTRIES) {
      throw new Error(message(state, 'dataInvalid', 'The table entries have an invalid format.'));
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

  function normalizeLabels(value, state) {
    if (value === undefined) return Object.create(null);
    if (!isPlainObject(value) || Object.keys(value).length > MAX_DATES) {
      throw new Error(message(state, 'labelsInvalid', 'The day labels have an invalid format.'));
    }
    const result = Object.create(null);
    Object.entries(value).forEach(([key, label]) => {
      if (validDateKey(key) && typeof label === 'string') result[key] = text(label);
    });
    return result;
  }

  function createStorage(state) {
    let dataFileHandle = null;
    let dataFileWriteQueue = Promise.resolve();

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
      if (!isPlainObject(data)) throw new Error(message(state, 'stateInvalid', 'The backup does not contain a valid state.'));
      const language = data.lang === 'pl' || data.lang === 'en' ? data.lang : state.lang;
      const messageState = { lang: language };
      const employeeInput = data.employees === undefined ? state.employees : data.employees;
      const employeeResult = normalizeEmployees(employeeInput, messageState);
      const year = data.year === undefined ? state.year : data.year;
      const month = data.month === undefined ? state.month : data.month;
      if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error(message(messageState, 'invalidYear', 'Invalid year.'));
      if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error(message(messageState, 'invalidMonth', 'Invalid month.'));

      const next = {
        month,
        year,
        monthLabel: text(data.monthLabel),
        employees: employeeResult.employees,
        editMode: Boolean(data.editMode),
        darkMode: Boolean(data.darkMode),
        darkSheet: Boolean(data.darkSheet),
        specialDays: normalizeDateSet(data.specialDays, 'specialDays', messageState),
        normalDays: normalizeDateSet(data.normalDays, 'normalDays', messageState),
        data: normalizeData(data.data, employeeResult.employees, employeeResult.legacy, messageState),
        dayLabels: normalizeLabels(data.dayLabels, messageState),
        lang: language,
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
        queueDataFileSave();
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
        if (raw.length > 1024 * 1024) throw new Error(message(state, 'savedDataTooLarge', 'The saved data exceeds the 1 MB limit.'));
        applyState(parseJson(raw, state));
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

    function queueDataFileSave() {
      if (!dataFileHandle) return;
      const payload = JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        state: toSerializableState(),
      }, null, 2);
      dataFileWriteQueue = dataFileWriteQueue
        .then(async () => {
          const writable = await dataFileHandle.createWritable();
          await writable.write(payload);
          await writable.close();
        })
        .catch(error => console.warn('Failed to save data file:', error));
    }

    function assertFilePickerSupport() {
      if (typeof window.showOpenFilePicker !== 'function' || typeof window.showSaveFilePicker !== 'function') {
        throw new Error(message(state, 'filePickerUnsupported', 'This browser does not support direct file selection. Use JSON export/import instead.'));
      }
    }

    function filePickerTypes() {
      return [{ description: 'TimeSheetLite JSON', accept: { 'application/json': ['.json'] } }];
    }

    async function applyFile(file, handle) {
      if (!file || file.size > MAX_FILE_SIZE) throw new Error(message(state, 'fileTooLarge', 'The file is empty or exceeds the 1 MB limit.'));
      const parsed = parseJson(await file.text(), state);
      const importedState = isPlainObject(parsed) && parsed.state !== undefined ? parsed.state : parsed;
      const previousState = toSerializableState();
      applyState(importedState);
      dataFileHandle = handle;
      if (!save()) {
        applyState(previousState);
        dataFileHandle = null;
        throw new Error(message(state, 'saveError', 'Could not save data locally.'));
      }
    }

    async function openDataFile() {
      assertFilePickerSupport();
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: filePickerTypes(),
      });
      await applyFile(await handle.getFile(), handle);
    }

    async function createDataFile() {
      assertFilePickerSupport();
      const handle = await window.showSaveFilePicker({
        suggestedName: `timesheet-${state.year}-${String(state.month + 1).padStart(2, '0')}.json`,
        types: filePickerTypes(),
      });
      dataFileHandle = handle;
      await dataFileWriteQueue;
      queueDataFileSave();
    }

    function getDataFileName() {
      return dataFileHandle ? dataFileHandle.name : '';
    }

    function importFromFile(file, onImported, onError) {
      const reportError = error => {
        if (typeof onError === 'function') onError(error);
        else alert(`${message(state, 'importFailed', 'Import failed')}: ${error.message}`);
      };
      if (!file || file.size > MAX_FILE_SIZE) {
        reportError(new Error(message(state, 'fileTooLarge', 'The file is empty or exceeds the 1 MB limit.')));
        return;
      }
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const parsed = parseJson(event.target.result, state);
          const importedState = isPlainObject(parsed) && parsed.state !== undefined ? parsed.state : parsed;
          const previousState = toSerializableState();
          applyState(importedState);
          if (!save()) {
            applyState(previousState);
            throw new Error(message(state, 'importedSaveFailed', 'Could not save the imported data.'));
          }
          onImported();
        } catch (error) {
          reportError(error);
        }
      };
      reader.onerror = () => reportError(new Error(message(state, 'fileReadFailed', 'Could not read the backup file.')));
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

    return Object.freeze({ save, load, exportToFile, importFromFile, reset, openDataFile, createDataFile, getDataFileName });
  }

  window.TimeSheetStorage = Object.freeze({ create: createStorage });
})();
