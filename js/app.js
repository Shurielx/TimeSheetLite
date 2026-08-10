(function() {
  'use strict';

  const { MONTH_NAMES, MONTH_NAMES_EN, I18N, COUNTRIES } = window.TimeSheetI18n;
  const {
    daysInMonth,
    dateKey,
    isWeekend,
    fetchHolidaysFromAPI,
    computePolishHolidaysLocally,
  } = window.TimeSheetHolidays;

  const state = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    monthLabel: '',
    employees: ['John Smith', 'Anna Johnson', 'Peter Williams'],
    specialDays: new Set(),
    normalDays: new Set(),
    data: {},
    dayLabels: {},
    holidays: new Set(),
    lang: 'en',
    holidayCountry: 'PL',
    editMode: false,
    darkMode: false,
    darkSheet: false,
    colStatusName: '',
    colHoursName: '',
    colWidthPreset: 'preset-50-50',
    pageLayout: 'portrait',
  };

  const monthSelect = document.getElementById('month-select');
  const yearPicker = document.getElementById('year-picker');
  const yearBtn = document.getElementById('year-btn');
  const yearPopup = document.getElementById('year-popup');
  const monthLabelInput = document.getElementById('month-label');
  const editToggle = document.getElementById('edit-toggle');
  const editControls = document.getElementById('edit-controls');
  const employeeList = document.getElementById('employee-list');
  const addEmployeeBtn = document.getElementById('add-employee-btn');
  const printBtn = document.getElementById('print-btn');
  const todayBtn = document.getElementById('today-btn');
  const langSelect = document.getElementById('lang-select');
  const holidaySelect = document.getElementById('holiday-country');
  const holidayStatus = document.getElementById('holiday-status');
  const saveStatus = document.getElementById('save-status');
  const darkToggle = document.getElementById('dark-toggle');
  const darkSheetToggle = document.getElementById('dark-sheet-toggle');
  const colStatusNameInput = document.getElementById('col-status-name');
  const colHoursNameInput = document.getElementById('col-hours-name');
  const columnWidthPreset = document.getElementById('column-width-preset');
  const pageLayoutSelect = document.getElementById('page-layout');
  const sheetPage = document.querySelector('.sheet-page');
  const tableHead = document.getElementById('table-head');
  const tableBody = document.getElementById('table-body');
  const table = document.getElementById('attendance-table');
  const printOrientationStyle = document.getElementById('print-orientation');
  const storage = window.TimeSheetStorage.create(state);
  const MAX_PRINT_EMPLOYEES = 8;

  let holidayRequestId = 0;
  let holidayAbortController = null;
  let saveTimer = null;

  function t(key) {
    return (I18N[state.lang] || I18N.en)[key] || key;
  }

  function createEmployeeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `emp-${window.crypto.randomUUID()}`;
    }
    return `emp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function setSaveStatus(ok) {
    saveStatus.textContent = ok ? t('saved') : t('saveError');
    saveStatus.classList.toggle('save-error', !ok);
  }

  function saveState() {
    setSaveStatus(storage.save());
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveState, 350);
  }

  function singleLine(value, maxLength) {
    return value.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
  }

  function isValidHours(value) {
    return value === '' || /^(?:[0-9]|1[0-9]|2[0-4])(?:[.,][0-9]{1,2})?$/.test(value);
  }

  function makeElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function createIcon(name, className = '') {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.classList.add('icon');
    if (className) icon.classList.add(className);
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#icon-${name}`);
    icon.appendChild(use);
    return icon;
  }

  function applyLanguage(lang) {
    state.lang = lang === 'pl' ? 'pl' : 'en';
    document.documentElement.lang = state.lang;
    const translations = I18N[state.lang];
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.dataset.i18n;
      if (translations[key] !== undefined) element.textContent = translations[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.dataset.i18nPlaceholder;
      if (translations[key] !== undefined) element.placeholder = translations[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.dataset.i18nTitle;
      if (translations[key] !== undefined) element.title = translations[key];
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const key = element.dataset.i18nAriaLabel;
      if (translations[key] !== undefined) element.setAttribute('aria-label', translations[key]);
    });
    table.setAttribute('aria-label', translations.tableLabel);
    initMonthSelect();
    populateHolidaySelect();
    updateHolidayStatus();
    render();
  }

  function initMonthSelect() {
    const names = state.lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES;
    monthSelect.replaceChildren();
    names.forEach((name, index) => {
      const option = makeElement('option', '', name);
      option.value = index;
      monthSelect.appendChild(option);
    });
    monthSelect.value = state.month;
  }

  function populateHolidaySelect() {
    const language = state.lang === 'en' ? 'en' : 'pl';
    holidaySelect.replaceChildren();
    Object.entries(COUNTRIES).forEach(([code, names]) => {
      const option = makeElement('option', '', names[language]);
      option.value = code;
      holidaySelect.appendChild(option);
    });
    holidaySelect.value = state.holidayCountry;
  }

  function updateHolidayStatus(message) {
    holidayStatus.textContent = message || '';
    holidayStatus.classList.toggle('status-warning', Boolean(message && message !== t('holidaysLoading')));
  }

  function computeHolidays() {
    const requestId = ++holidayRequestId;
    if (holidayAbortController) holidayAbortController.abort();
    state.holidays = new Set();
    if (state.holidayCountry === 'PL') {
      updateHolidayStatus();
      state.holidays = computePolishHolidaysLocally(state.year);
      render(false);
      return;
    }

    holidayAbortController = new AbortController();
    updateHolidayStatus(t('holidaysLoading'));
    const requestedYear = state.year;
    const requestedCountry = state.holidayCountry;
    fetchHolidaysFromAPI(requestedYear, requestedCountry, holidayAbortController.signal)
      .then(holidays => {
        if (requestId !== holidayRequestId || state.year !== requestedYear || state.holidayCountry !== requestedCountry) return;
        state.holidays = holidays;
        updateHolidayStatus();
        render(false);
      })
      .catch(error => {
        if (error.name === 'AbortError' || requestId !== holidayRequestId) return;
        console.warn('Holiday API request failed:', error.message);
        state.holidays = new Set();
        updateHolidayStatus(t('holidaysUnavailable'));
        render(false);
      });
  }

  function isSpecialDay(year, month, day) {
    const key = dateKey(year, month, day);
    if (state.normalDays.has(key)) return false;
    if (state.specialDays.has(key)) return true;
    return state.holidays.has(key) || isWeekend(year, month, day);
  }

  function generateMonthLabel() {
    const names = state.lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES;
    return `${t('attendanceList')} - ${names[state.month]} ${state.year}`;
  }

  function updatePrintStyle() {
    printOrientationStyle.textContent = `@page { size: A4 ${state.pageLayout}; margin: 6mm; }`;
  }

  function render(syncEdits = false) {
    if (syncEdits) flushVisibleEdits();

    const days = daysInMonth(state.month, state.year);
    const employees = state.employees;
    const label = state.monthLabel.trim() || generateMonthLabel();
    const employeeCount = employees.length || 1;
    let statusRatio = 50;
    let hoursRatio = 50;
    if (state.colWidthPreset === 'preset-90-10') [statusRatio, hoursRatio] = [90, 10];
    if (state.colWidthPreset === 'preset-80-20') [statusRatio, hoursRatio] = [80, 20];
    if (state.colWidthPreset === 'preset-20-80') [statusRatio, hoursRatio] = [20, 80];
    const statusWidth = `${statusRatio / employeeCount}%`;
    const hoursWidth = `${hoursRatio / employeeCount}%`;

    if (!state.monthLabel.trim()) monthLabelInput.value = label;
    tableHead.replaceChildren();
    const mainRow = makeElement('tr');
    const mainHeader = makeElement('th', 'main-header', label);
    mainHeader.colSpan = 1 + employees.length * 2;
    mainRow.appendChild(mainHeader);
    tableHead.appendChild(mainRow);

    const employeeRow = makeElement('tr');
    employeeRow.appendChild(makeElement('th', 'corner-cell', t('day')));
    employees.forEach(employee => {
      const header = makeElement('th', 'employee-name');
      header.colSpan = 2;
      header.dataset.employeeId = employee.id;
      header.setAttribute('aria-label', `${t('employees')}: ${employee.name}`);
      header.style.width = `${100 / employeeCount}%`;
      if (state.editMode) {
        const input = document.createElement('input');
        input.className = 'table-input employee-name-input';
        input.value = employee.name;
        input.maxLength = 100;
        input.dataset.employeeId = employee.id;
        input.setAttribute('aria-label', `${t('employees')}: ${employee.name}`);
        header.appendChild(input);
      } else {
        header.textContent = employee.name;
      }
      employeeRow.appendChild(header);
    });
    tableHead.appendChild(employeeRow);

    const subHeaderRow = makeElement('tr');
    subHeaderRow.appendChild(makeElement('th', 'corner-cell'));
    const statusLabel = state.colStatusName.trim() || t('status');
    const hoursLabel = state.colHoursName.trim() || t('hours');
    employees.forEach(() => {
      const statusHeader = makeElement('th', 'sub-header cell-status', statusLabel);
      statusHeader.style.width = statusWidth;
      const hoursHeader = makeElement('th', 'sub-header cell-hours', hoursLabel);
      hoursHeader.style.width = hoursWidth;
      subHeaderRow.append(statusHeader, hoursHeader);
    });
    tableHead.appendChild(subHeaderRow);

    tableBody.replaceChildren();
    for (let day = 1; day <= days; day += 1) {
      const key = dateKey(state.year, state.month, day);
      const special = isSpecialDay(state.year, state.month, day);
      const row = makeElement('tr', special ? 'special-day' : '');
      row.dataset.day = day;
      const dayCell = makeElement('td');
      const dayLabel = state.dayLabels[key] || String(day);
      if (state.editMode) {
        const input = document.createElement('input');
        input.className = 'table-input day-label-input';
        input.value = dayLabel;
        input.maxLength = 30;
        input.dataset.date = key;
        input.setAttribute('aria-label', `${t('day')} ${day}`);
        dayCell.appendChild(input);
      } else {
        dayCell.appendChild(makeElement('span', '', dayLabel));
      }
      if (state.editMode) {
        const control = makeElement('label', 'day-special-control');
        control.title = t('specialDayTooltip');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'day-special-toggle';
        checkbox.dataset.day = day;
        checkbox.checked = state.specialDays.has(key) || (special && !state.normalDays.has(key));
        checkbox.setAttribute('aria-label', `${t('specialDayLabel')} ${day}`);
        control.appendChild(checkbox);
        dayCell.appendChild(control);
      }
      row.appendChild(dayCell);

      employees.forEach(employee => {
        const cellData = state.data[`${key}:${employee.id}`] || {};
        const statusCell = makeElement('td', 'cell-status');
        statusCell.style.width = statusWidth;
        statusCell.dataset.employeeId = employee.id;
        const hoursCell = makeElement('td', 'cell-hours');
        hoursCell.style.width = hoursWidth;
        hoursCell.dataset.employeeId = employee.id;
        if (state.editMode) {
          const statusInput = document.createElement('input');
          statusInput.className = 'table-input cell-input';
          statusInput.value = cellData.status || '';
          statusInput.maxLength = 30;
          statusInput.dataset.date = key;
          statusInput.dataset.employeeId = employee.id;
          statusInput.dataset.field = 'status';
          statusInput.setAttribute('aria-label', `${t('status')} ${employee.name}, ${day}`);
          statusCell.appendChild(statusInput);
          const hoursInput = document.createElement('input');
          hoursInput.className = 'table-input cell-input hours-input';
          hoursInput.value = cellData.hours || '';
          hoursInput.maxLength = 5;
          hoursInput.inputMode = 'decimal';
          hoursInput.dataset.date = key;
          hoursInput.dataset.employeeId = employee.id;
          hoursInput.dataset.field = 'hours';
          hoursInput.setAttribute('aria-label', `${t('hours')} ${employee.name}, ${day}`);
          hoursCell.appendChild(hoursInput);
        } else {
          statusCell.textContent = cellData.status || '';
          hoursCell.textContent = cellData.hours || '';
        }
        row.append(statusCell, hoursCell);
      });
      tableBody.appendChild(row);
    }

    sheetPage.className = `sheet-page ${state.pageLayout === 'landscape' ? 'landscape' : 'portrait'}`;
    table.classList.toggle('edit-mode', state.editMode);
    updateEmployeeListUI();
    updatePrintStyle();
  }

  function updateEmployeeListUI() {
    employeeList.replaceChildren();
    state.employees.forEach(employee => {
      const item = makeElement('div', 'employee-item');
      const name = document.createElement('input');
      name.className = 'emp-name form-control';
      name.value = employee.name;
      name.maxLength = 100;
      name.dataset.employeeId = employee.id;
      name.setAttribute('aria-label', `${t('employees')}: ${employee.name}`);
      name.addEventListener('input', onEmployeeNameInput);
       const remove = makeElement('button', 'emp-remove');
       remove.type = 'button';
       remove.appendChild(createIcon('trash'));
      remove.dataset.employeeId = employee.id;
      remove.title = t('removeTitle');
      remove.setAttribute('aria-label', `${t('removeTitle')}: ${employee.name}`);
      remove.addEventListener('click', () => removeEmployee(employee.id));
      item.append(name, remove);
      employeeList.appendChild(item);
    });
  }

  function addEmployee() {
    flushVisibleEdits();
    if (state.employees.length >= MAX_PRINT_EMPLOYEES) {
      window.alert(t('employeeLimit'));
      return;
    }
    state.employees.push({ id: createEmployeeId(), name: `${t('newEmployee')} ${state.employees.length + 1}` });
    render(false);
    saveState();
  }

  function removeEmployee(employeeId) {
    if (state.employees.length <= 1) return;
    const employee = state.employees.find(item => item.id === employeeId);
    if (!employee || !window.confirm(t('removeConfirm').replace('{name}', employee.name))) return;
    flushVisibleEdits();
    state.employees = state.employees.filter(item => item.id !== employeeId);
    Object.keys(state.data).forEach(key => {
      if (key.endsWith(`:${employeeId}`)) delete state.data[key];
    });
    render(false);
    saveState();
  }

  function flushVisibleEdits() {
    window.clearTimeout(saveTimer);
    saveState();
  }

  function onTableInput(event) {
    if (!state.editMode) return;
    const input = event.target;
    if (input.matches('.employee-name-input')) {
      const employee = state.employees.find(item => item.id === input.dataset.employeeId);
      if (employee) employee.name = singleLine(input.value, 100) || employee.name;
    } else if (input.matches('.day-label-input')) {
      state.dayLabels[input.dataset.date] = singleLine(input.value, 30);
    } else if (input.matches('.cell-input')) {
      const value = singleLine(input.value, input.dataset.field === 'hours' ? 5 : 30);
      if (input.dataset.field === 'hours' && !isValidHours(value)) {
        input.setCustomValidity(t('invalidHours'));
        return;
      }
      input.setCustomValidity('');
      const key = `${input.dataset.date}:${input.dataset.employeeId}`;
      const cell = state.data[key] || {};
      cell[input.dataset.field] = value;
      if (cell.status || cell.hours) state.data[key] = cell;
      else delete state.data[key];
    } else {
      return;
    }
    scheduleSave();
  }

  function onEmployeeNameInput(event) {
    const employee = state.employees.find(item => item.id === event.target.dataset.employeeId);
    if (!employee) return;
    employee.name = singleLine(event.target.value, 100) || employee.name;
    scheduleSave();
  }

  function onDayCheckboxChange(event) {
    const checkbox = event.target.closest('.day-special-toggle');
    if (!checkbox || !state.editMode) return;
    const key = dateKey(state.year, state.month, Number(checkbox.dataset.day));
    if (checkbox.checked) {
      state.normalDays.delete(key);
      state.specialDays.add(key);
    } else {
      state.specialDays.delete(key);
      state.normalDays.add(key);
    }
    checkbox.closest('tr').classList.toggle('special-day', checkbox.checked);
    saveState();
  }

  function onMonthChange() {
    flushVisibleEdits();
    state.month = Number(monthSelect.value);
    state.monthLabel = '';
    monthLabelInput.value = '';
    computeHolidays();
    render(false);
    saveState();
  }

  function renderYearPicker() {
    yearPopup.replaceChildren();
    for (let year = state.year - 1; year <= state.year + 3; year += 1) {
      const tile = makeElement('button', `year-tile${year === state.year ? ' selected' : ''}`, year);
      tile.type = 'button';
      tile.addEventListener('click', event => {
        event.stopPropagation();
        selectYear(year);
      });
      yearPopup.appendChild(tile);
    }
    yearPopup.appendChild(makeElement('hr'));
    const currentYear = new Date().getFullYear();
    const currentTile = makeElement('button', `year-tile${currentYear === state.year ? ' selected' : ''}`);
    currentTile.type = 'button';
    currentTile.style.gridColumn = '1 / -1';
    currentTile.append(createIcon('pin'), document.createTextNode(String(currentYear)));
    currentTile.title = t('today');
    currentTile.addEventListener('click', event => {
      event.stopPropagation();
      selectYear(currentYear);
    });
    yearPopup.appendChild(currentTile);
  }

  function selectYear(year) {
    flushVisibleEdits();
    state.year = year;
    yearBtn.textContent = year;
    yearPopup.classList.remove('open');
    yearBtn.setAttribute('aria-expanded', 'false');
    state.monthLabel = '';
    monthLabelInput.value = '';
    computeHolidays();
    render(false);
    saveState();
  }

  function onEditToggle() {
    if (!editToggle.checked) flushVisibleEdits();
    state.editMode = editToggle.checked;
    editControls.classList.toggle('is-visible', state.editMode);
    render(false);
    saveState();
  }

  function onPrint() {
    flushVisibleEdits();
    saveState();
    window.print();
  }

  function applyTheme() {
    const root = document.documentElement;
    root.classList.toggle('dark-mode', state.darkMode);
    root.classList.toggle('dark-sheet', state.darkMode && state.darkSheet);
  }

  function importStateFromFile(file) {
    storage.importFromFile(file, () => {
      initMonthSelect();
      populateHolidaySelect();
      yearBtn.textContent = state.year;
      monthLabelInput.value = state.monthLabel;
      langSelect.value = state.lang;
      holidaySelect.value = state.holidayCountry;
      darkToggle.checked = state.darkMode;
      darkSheetToggle.checked = state.darkSheet;
      colStatusNameInput.value = state.colStatusName;
      colHoursNameInput.value = state.colHoursName;
      columnWidthPreset.value = state.colWidthPreset;
      pageLayoutSelect.value = state.pageLayout;
      applyLanguage(state.lang);
      applyTheme();
      computeHolidays();
      render(false);
    }, error => window.alert(`${t('importFailed')}: ${error.message}`));
  }

  function resetToDefaults() {
    if (window.confirm(t('resetDefaults') + '?')) storage.reset();
  }

  function init() {
    const loaded = storage.load();
    initMonthSelect();
    populateHolidaySelect();
    yearBtn.textContent = state.year;
    monthLabelInput.value = state.monthLabel;
    langSelect.value = state.lang;
    holidaySelect.value = state.holidayCountry;
    darkToggle.checked = state.darkMode;
    darkSheetToggle.checked = state.darkSheet;
    colStatusNameInput.value = state.colStatusName;
    colHoursNameInput.value = state.colHoursName;
    columnWidthPreset.value = state.colWidthPreset;
    pageLayoutSelect.value = state.pageLayout;

    monthSelect.addEventListener('change', onMonthChange);
    yearBtn.addEventListener('click', event => {
      event.stopPropagation();
      renderYearPicker();
      yearPopup.classList.toggle('open');
      yearBtn.setAttribute('aria-expanded', yearPopup.classList.contains('open') ? 'true' : 'false');
      if (yearPopup.classList.contains('open')) {
        const rect = yearBtn.getBoundingClientRect();
        yearPopup.style.left = `${rect.left}px`;
        yearPopup.style.top = `${rect.bottom + 4}px`;
        yearPopup.style.minWidth = `${Math.max(rect.width, 160)}px`;
      }
    });
    document.addEventListener('click', event => {
      if (!yearPicker.contains(event.target)) {
        yearPopup.classList.remove('open');
        yearBtn.setAttribute('aria-expanded', 'false');
      }
    });
    monthLabelInput.addEventListener('input', () => {
      state.monthLabel = monthLabelInput.value.slice(0, 200);
      saveState();
      render(false);
    });
    editToggle.addEventListener('change', onEditToggle);
    table.addEventListener('input', onTableInput);
    tableBody.addEventListener('change', onDayCheckboxChange);
    addEmployeeBtn.addEventListener('click', addEmployee);
    printBtn.addEventListener('click', onPrint);
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      flushVisibleEdits();
      state.month = now.getMonth();
      state.year = now.getFullYear();
      state.monthLabel = '';
      monthLabelInput.value = '';
      yearBtn.textContent = state.year;
      computeHolidays();
      render(false);
      saveState();
    });
    langSelect.addEventListener('change', () => {
      flushVisibleEdits();
      applyLanguage(langSelect.value);
      saveState();
    });
    holidaySelect.addEventListener('change', () => {
      flushVisibleEdits();
      state.holidayCountry = holidaySelect.value;
      computeHolidays();
      render(false);
      saveState();
    });
    darkToggle.addEventListener('change', () => {
      state.darkMode = darkToggle.checked;
      if (state.darkMode) {
        state.darkSheet = true;
        darkSheetToggle.checked = true;
      }
      applyTheme();
      saveState();
    });
    darkSheetToggle.addEventListener('change', () => {
      state.darkSheet = darkSheetToggle.checked;
      applyTheme();
      saveState();
    });
    colStatusNameInput.addEventListener('input', () => {
      flushVisibleEdits();
      state.colStatusName = colStatusNameInput.value.slice(0, 100);
      render(false);
      saveState();
    });
    colHoursNameInput.addEventListener('input', () => {
      flushVisibleEdits();
      state.colHoursName = colHoursNameInput.value.slice(0, 100);
      render(false);
      saveState();
    });
    columnWidthPreset.addEventListener('change', () => {
      flushVisibleEdits();
      state.colWidthPreset = columnWidthPreset.value;
      render(false);
      saveState();
    });
    pageLayoutSelect.addEventListener('change', () => {
      flushVisibleEdits();
      state.pageLayout = pageLayoutSelect.value === 'landscape' ? 'landscape' : 'portrait';
      render(false);
      saveState();
    });
    document.getElementById('export-btn').addEventListener('click', () => {
      flushVisibleEdits();
      saveState();
      storage.exportToFile();
    });
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', event => {
      if (event.target.files.length) importStateFromFile(event.target.files[0]);
      event.target.value = '';
    });
    document.getElementById('reset-btn').addEventListener('click', resetToDefaults);
    window.addEventListener('beforeunload', () => {
      flushVisibleEdits();
      storage.save();
    });

    editToggle.checked = state.editMode;
    editControls.classList.toggle('is-visible', state.editMode);
    applyLanguage(state.lang);
    applyTheme();
    computeHolidays();
    render(false);
    if (loaded) saveState();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
