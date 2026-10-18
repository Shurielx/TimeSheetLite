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

  function detectBrowserLanguage() {
    const browserLanguage = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
    return browserLanguage.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  }

  const state = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    monthLabel: '',
    employees: [
      { id: 'emp-default-1', name: 'Employee 1' },
      { id: 'emp-default-2', name: 'Employee 2' },
      { id: 'emp-default-3', name: 'Employee 3' },
    ],
    specialDays: new Set(),
    normalDays: new Set(),
    data: {},
    dayLabels: {},
    holidays: new Set(),
    lang: detectBrowserLanguage(),
    holidayCountry: 'PL',
    editMode: false,
    showTotals: true,
    darkMode: false,
    darkSheet: false,
    colStatusName: '',
    colHoursName: '',
    colWidthPreset: 'preset-50-50',
    pageLayout: 'portrait',
    columns: window.TimeSheetLayout.defaultColumns(),
    dayWidth: 14, printFontSize: 9, rowHeight: 5, showTitle: true,
  };

  const monthSelect = document.getElementById('month-select');
  const yearPicker = document.getElementById('year-picker');
  const yearBtn = document.getElementById('year-btn');
  const yearPopup = document.getElementById('year-popup');
  const monthLabelInput = document.getElementById('month-label');
  const editToggle = document.getElementById('edit-toggle');
  const showTotalsToggle = document.getElementById('show-totals-toggle');
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
  const columnWidthPreset = document.getElementById('column-width-preset');
  const pageLayoutSelect = document.getElementById('page-layout');
  const settingsDetails = document.getElementById('dev-settings');
  const dataFileStatus = document.getElementById('data-file-status');
  const openDataFileBtn = document.getElementById('open-data-file-btn');
  const createDataFileBtn = document.getElementById('create-data-file-btn');
  const sheetPage = document.querySelector('.sheet-page');
  const tableColgroup = document.getElementById('table-colgroup');
  const tableHead = document.getElementById('table-head');
  const tableBody = document.getElementById('table-body');
  const tableFoot = document.getElementById('table-foot');
  const table = document.getElementById('attendance-table');
  const fillWorkdaysBtn = document.getElementById('fill-workdays-btn');
  const clearMonthBtn = document.getElementById('clear-month-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const printOrientationStyle = document.getElementById('print-orientation');
  const storage = window.TimeSheetStorage.create(state);
  const MAX_PRINT_EMPLOYEES = 100;

  let yearPickerBase = state.year;

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

  function updateDataFileStatus(message) {
    const fileName = storage.getDataFileName();
    dataFileStatus.textContent = message || (fileName
      ? t('dataFileSelected').replace('{name}', fileName)
      : t('browserStorage'));
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

  const isValidHours = window.TimeSheetLayout.validHours;

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
    document.querySelectorAll('[data-i18n-href]').forEach(element => {
      const key = element.dataset.i18nHref;
      if (translations[key] !== undefined) element.href = translations[key];
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

  function visibleColumns() { return state.columns.filter(column => column.visible); }
  function columnLabel(column) { return column.label || t(column.id === 'status' || column.id === 'hours' ? column.id : 'newColumn'); }
  function calculateEmployeeTotals() {
    const totals = {};
    state.employees.forEach(employee => state.columns.filter(column => column.type === 'hours').forEach(column => {
      let sum = 0;
      for (let day = 1; day <= daysInMonth(state.month, state.year); day += 1) {
        const value = state.data[`${dateKey(state.year, state.month, day)}:${employee.id}`]?.[column.id] || '';
        if (isValidHours(value)) sum += Number(value.replace(',', '.'));
      }
      totals[`${employee.id}:${column.id}`] = Math.round(sum * 100) / 100;
    }));
    return totals;
  }

  function formatHoursNumber(num) {
    if (!num || num === 0) return '0';
    const rounded = Math.round(num * 100) / 100;
    const str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
    return state.lang === 'pl' ? str.replace('.', ',') : str;
  }

  function tagColumn(element, employee, column) {
    element.dataset.employeeId = employee.id;
    element.dataset.columnId = column.id;
    return element;
  }
  function renderFoot() {
    tableFoot.replaceChildren();
    if (!state.showTotals || !visibleColumns().some(column => column.type === 'hours')) return;
    const row = makeElement('tr', 'total-row');
    const label = makeElement('th', 'total-label-cell', t('total'));
    label.scope = 'row'; row.appendChild(label);
    const totals = calculateEmployeeTotals();
    state.employees.forEach(employee => visibleColumns().forEach(column => {
      const cell = tagColumn(makeElement('td', `total-cell cell-${column.id}`), employee, column);
      if (column.type === 'hours') {
        cell.classList.add('total-hours-value');
        cell.textContent = formatHoursNumber(totals[`${employee.id}:${column.id}`]);
        cell.setAttribute('aria-label', `${employee.name}: ${columnLabel(column)}, ${t('total')} ${cell.textContent}`);
      }
      row.appendChild(cell);
    }));
    tableFoot.appendChild(row);
  }
  function updateTotalsUI() { renderFoot(); }
  function resizeText(input) {
    if (input.tagName !== 'TEXTAREA') return;
    input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`;
  }
  function updateLayoutStatus() {
    const count = window.TimeSheetPrint.plan(state).length;
    document.getElementById('layout-status').textContent = t('layoutSummary').replace('{people}', state.employees.length).replace('{columns}', visibleColumns().length).replace('{parts}', count);
  }
  function updateInteractionStatus(input) {
    const status = document.getElementById('active-cell-status');
    if (!input || !table.contains(input)) {
      status.textContent = t(state.editMode ? 'editingReady' : 'previewReady');
      return;
    }
    const employee = state.employees.find(item => item.id === input.dataset.employeeId);
    const column = state.columns.find(item => item.id === input.dataset.field);
    const date = input.dataset.date || (input.dataset.day ? dateKey(state.year, state.month, Number(input.dataset.day)) : '');
    const details = [date, employee?.name, column ? columnLabel(column) : ''].filter(Boolean);
    if (input.matches('.day-label-input, .day-special-toggle')) details.push(t('day'));
    if (input.matches('.employee-name-input')) details.push(t('employees'));
    status.textContent = `${t('editingNow')}: ${details.join(' · ')}`;
  }
  function updateColumnWidths() {
    const dayPercent = Math.min(25, state.dayWidth * 96 / 25.4 / Math.max(1, table.getBoundingClientRect().width) * 100);
    const employeeWeight = state.employees.reduce((sum, employee) => sum + employee.weight, 0);
    const columns = visibleColumns();
    const columnWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    tableColgroup.firstElementChild.style.width = `${dayPercent}%`;
    Array.from(tableColgroup.children).slice(1).forEach(col => {
      const employee = state.employees.find(item => item.id === col.dataset.employeeId);
      const column = columns.find(item => item.id === col.dataset.columnId);
      col.style.width = `${(100 - dayPercent) * employee.weight / employeeWeight * column.weight / columnWeight}%`;
    });
  }
  function render(syncEdits = false, animate = false) {
    if (syncEdits) flushVisibleEdits();
    const columns = visibleColumns();
    monthLabelInput.placeholder = generateMonthLabel();
    if (document.activeElement !== monthLabelInput) monthLabelInput.value = state.monthLabel;
    tableColgroup.replaceChildren();
    const dayCol = document.createElement('col'); dayCol.style.width = `${state.dayWidth}mm`; tableColgroup.appendChild(dayCol);
    state.employees.forEach(employee => columns.forEach(column => {
      const col = tagColumn(document.createElement('col'), employee, column);
      tableColgroup.appendChild(col);
    }));
    tableHead.replaceChildren();
    if (state.showTitle) {
      const row = makeElement('tr');
      const title = makeElement('th', 'main-header', state.monthLabel.trim() || generateMonthLabel());
      title.colSpan = 1 + state.employees.length * columns.length; row.appendChild(title); tableHead.appendChild(row);
    }
    const peopleRow = makeElement('tr');
    const dayHeader = makeElement('th', 'corner-cell', t('day')); dayHeader.rowSpan = 2; dayHeader.scope = 'col'; peopleRow.appendChild(dayHeader);
    const columnRow = makeElement('tr');
    state.employees.forEach(employee => {
      const header = makeElement('th', 'employee-name');
      header.colSpan = columns.length; header.dataset.employeeId = employee.id; header.scope = 'colgroup';
      header.setAttribute('aria-label', `${t('employees')}: ${employee.name}`);
      if (state.editMode) {
        const input = makeElement('textarea', 'table-input employee-name-input'); input.rows = 1;
        input.value = employee.name; input.maxLength = 100; input.dataset.employeeId = employee.id;
        input.setAttribute('aria-label', `${t('employees')}: ${employee.name}`); header.appendChild(input);
      } else header.textContent = employee.name;
      peopleRow.appendChild(header);
      columns.forEach(column => {
        const th = tagColumn(makeElement('th', `sub-header cell-${column.id}`), employee, column); th.scope = 'col';
        if (state.editMode) th.appendChild(createColumnHeaderInput(column));
        else th.textContent = columnLabel(column);
        columnRow.appendChild(th);
      });
    });
    tableHead.append(peopleRow, columnRow);
    tableBody.replaceChildren();
    for (let day = 1; day <= daysInMonth(state.month, state.year); day += 1) {
      const date = dateKey(state.year, state.month, day);
      const special = isSpecialDay(state.year, state.month, day);
      const row = makeElement('tr', special ? 'special-day' : ''); row.dataset.day = day;
      const dayCell = makeElement('td');
      if (state.editMode) {
        const input = makeElement('textarea', 'table-input day-label-input'); input.rows = 1;
        input.value = state.dayLabels[date] || String(day); input.maxLength = 30; input.dataset.date = date;
        input.setAttribute('aria-label', `${t('day')} ${day}`); dayCell.appendChild(input);
        const control = makeElement('label', 'day-special-control'); control.title = t('specialDayTooltip');
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'day-special-toggle';
        checkbox.dataset.day = day; checkbox.checked = special; checkbox.setAttribute('aria-label', t('specialDayLabel').replace('{day}', day));
        control.appendChild(checkbox); dayCell.appendChild(control);
      } else dayCell.textContent = state.dayLabels[date] || String(day);
      row.appendChild(dayCell);
      state.employees.forEach(employee => columns.forEach(column => {
        const value = state.data[`${date}:${employee.id}`]?.[column.id] || '';
        const cell = tagColumn(makeElement('td', `cell-${column.id}`), employee, column);
        if (state.editMode) {
          const input = makeElement(column.type === 'hours' ? 'input' : 'textarea', `table-input cell-input${column.type === 'hours' ? ' hours-input' : ''}`);
          if (column.type === 'text') input.rows = 1;
          input.value = value; input.maxLength = column.type === 'hours' ? 5 : 200;
          if (column.type === 'hours') input.inputMode = 'decimal';
          input.dataset.date = date; input.dataset.employeeId = employee.id; input.dataset.field = column.id;
          input.setAttribute('aria-label', `${columnLabel(column)} ${employee.name}, ${day}`); cell.appendChild(input);
        } else cell.textContent = value;
        row.appendChild(cell);
      }));
      tableBody.appendChild(row);
    }
    renderFoot();
    sheetPage.className = `sheet-page ${state.pageLayout}`;
    sheetPage.style.setProperty('--day-width', `${state.dayWidth}mm`);
    const peopleWeight = state.employees.reduce((sum, employee) => sum + employee.weight, 0);
    const fieldWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    const minimum = Math.max(...state.employees.flatMap(employee => columns.map(column => (column.type === 'hours' ? 64 : 95) * peopleWeight / employee.weight * fieldWeight / column.weight)));
    sheetPage.style.minWidth = `${Math.max(state.pageLayout === 'landscape' ? 1050 : 750, state.dayWidth * 96 / 25.4 + minimum + 32)}px`;
    table.classList.toggle('edit-mode', state.editMode);
    updateColumnWidths();
    table.querySelectorAll('textarea').forEach(resizeText);
    updateEmployeeListUI(); updateColumnListUI(); syncLayoutControls(); updateLayoutStatus(); updateInteractionStatus(); updatePrintStyle();
    if (animate) animateSheet();
  }
  function createColumnHeaderInput(column) {
    const input = makeElement('textarea', 'table-input column-header-input'); input.rows = 1;
    input.value = column.label; input.placeholder = columnLabel(column); input.maxLength = 100;
    input.dataset.field = column.id; input.setAttribute('aria-label', columnLabel(column)); return input;
  }

  function actionButton(text, title, action, disabled = false) {
    const button = makeElement('button', 'btn btn-secondary btn-small', text);
    button.type = 'button'; button.title = title; button.setAttribute('aria-label', title);
    button.disabled = disabled; button.addEventListener('click', action); return button;
  }
  function moveItem(list, index, direction) {
    const moved = list[index];
    [list[index], list[index + direction]] = [list[index + direction], list[index]];
    render(); saveState();
    document.querySelector(list === state.employees ? `.emp-name[data-employee-id="${moved.id}"]` : `.column-name[data-column-id="${moved.id}"]`)?.focus();
  }
  function updateColumnListUI() {
    const list = document.getElementById('column-list'); list.replaceChildren();
    state.columns.forEach((column, index) => {
      const card = makeElement('div', 'column-card'); card.dataset.columnId = column.id;
      const top = makeElement('div', 'column-top');
      const visible = document.createElement('input'); visible.type = 'checkbox'; visible.checked = column.visible;
      visible.setAttribute('aria-label', `${t('showColumn')}: ${columnLabel(column)}`);
      visible.disabled = column.visible && visibleColumns().length === 1;
      visible.addEventListener('change', () => { column.visible = visible.checked; state.colWidthPreset = 'custom'; render(); saveState(); });
      const name = makeElement('input', 'form-control column-name'); name.value = column.label;
      name.placeholder = columnLabel(column); name.maxLength = 100; name.dataset.columnId = column.id;
      name.setAttribute('aria-label', `${t('columnName')} ${index + 1}`);
      name.addEventListener('input', () => {
        column.label = singleLine(name.value, 100);
        tableHead.querySelectorAll(`.column-header-input[data-field="${column.id}"]`).forEach(input => { input.value = name.value; resizeText(input); });
        if (!state.editMode) tableHead.querySelectorAll(`[data-column-id="${column.id}"]`).forEach(header => { header.textContent = columnLabel(column); });
        scheduleSave();
      });
      top.append(visible, name); card.appendChild(top);
      const options = makeElement('div', 'column-options');
      const typeLabel = makeElement('label', '', t('columnType'));
      const type = makeElement('select', 'form-control column-type');
      [['text', t('textColumn')], ['hours', t('hoursColumn')]].forEach(([value, label]) => {
        const option = makeElement('option', '', label); option.value = value; type.appendChild(option);
      });
      type.value = column.type;
      type.addEventListener('change', () => {
        if (type.value === 'hours' && Object.values(state.data).some(entry => !isValidHours(entry[column.id] || ''))) {
          window.alert(t('columnHoursConflict')); type.value = column.type; return;
        }
        column.type = type.value; render(); saveState();
      });
      typeLabel.appendChild(type);
      const weightLabel = makeElement('label', '', t('relativeWidth'));
      const weight = makeElement('input', 'form-control column-weight'); weight.type = 'number'; weight.min = 1; weight.max = 20; weight.step = 1; weight.value = column.weight;
      weight.addEventListener('change', () => { column.weight = window.TimeSheetLayout.clamp(weight.value, 1, 20, 1); state.colWidthPreset = 'custom'; render(); saveState(); });
      weightLabel.appendChild(weight); options.append(typeLabel, weightLabel);
      const actions = makeElement('div', 'column-actions');
      actions.append(
        actionButton('↑', t('moveEarlier'), () => moveItem(state.columns, index, -1), index === 0),
        actionButton('↓', t('moveLater'), () => moveItem(state.columns, index, 1), index === state.columns.length - 1),
        actionButton(t('remove'), `${t('remove')}: ${columnLabel(column)}`, () => {
          if (!window.confirm(t('removeColumnConfirm').replace('{name}', columnLabel(column)))) return;
          state.columns.splice(index, 1);
          Object.values(state.data).forEach(entry => { delete entry[column.id]; });
          render(); saveState();
        }, column.visible && visibleColumns().length === 1)
      );
      card.append(options, actions); list.appendChild(card);
    });
    document.getElementById('add-column-btn').disabled = state.columns.length >= 12;
    fillWorkdaysBtn.disabled = !visibleColumns().some(column => column.type === 'hours');
  }
  function syncLayoutControls() {
    document.getElementById('day-width').value = state.dayWidth;
    document.getElementById('print-font-size').value = state.printFontSize;
    document.getElementById('row-height').value = state.rowHeight;
    document.getElementById('show-title').checked = state.showTitle;
    columnWidthPreset.value = state.colWidthPreset;
    columnWidthPreset.disabled = !visibleColumns().some(column => column.id === 'status') || !visibleColumns().some(column => column.id === 'hours');
  }
  function initLayoutEditor() {
    document.getElementById('add-column-btn').addEventListener('click', () => {
      if (state.columns.length >= 12) return;
      state.columns.push({ id: createEmployeeId().replace('emp-', 'col-'), label: t('newColumn'), type: 'text', weight: 2, visible: true });
      state.colWidthPreset = 'custom'; render(); saveState();
      document.querySelector('.column-card:last-child .column-name')?.focus();
    });
    [['day-width', 'dayWidth', 12, 35], ['print-font-size', 'printFontSize', 8, 12], ['row-height', 'rowHeight', 5, 12]].forEach(([id, field, min, max]) => {
      document.getElementById(id).addEventListener('change', event => {
        state[field] = window.TimeSheetLayout.clamp(event.target.value, min, max, min); render(); saveState();
      });
    });
    document.getElementById('show-title').addEventListener('change', event => { state.showTitle = event.target.checked; render(); saveState(); });
  }

  function animateSheet() {
    sheetPage.classList.remove('is-changing');
    void sheetPage.offsetWidth;
    sheetPage.classList.add('is-changing');
    window.setTimeout(() => sheetPage.classList.remove('is-changing'), 450);
  }

  function animateControl(control) {
    control.classList.remove('has-changed');
    void control.offsetWidth;
    control.classList.add('has-changed');
    window.setTimeout(() => control.classList.remove('has-changed'), 350);
  }

  function updateEmployeeListUI() {
    employeeList.replaceChildren();
    state.employees.forEach((employee, index) => {
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
      remove.disabled = state.employees.length === 1;
      const weightLabel = makeElement('label', 'employee-weight-label', t('relativeWidth'));
      const weight = makeElement('input', 'form-control emp-weight'); weight.type = 'number'; weight.min = 1; weight.max = 5; weight.value = employee.weight;
      weight.setAttribute('aria-label', `${t('relativeWidth')}: ${employee.name}`);
      weight.addEventListener('change', () => { employee.weight = window.TimeSheetLayout.clamp(weight.value, 1, 5, 1); render(); saveState(); });
      weightLabel.appendChild(weight);
      const moves = makeElement('div', 'employee-moves');
      moves.append(actionButton('↑', `${t('moveEarlier')}: ${employee.name}`, () => moveItem(state.employees, index, -1), index === 0), actionButton('↓', `${t('moveLater')}: ${employee.name}`, () => moveItem(state.employees, index, 1), index === state.employees.length - 1));
      item.append(name, weightLabel, moves, remove);
      employeeList.appendChild(item);
    });
    addEmployeeBtn.disabled = state.employees.length >= MAX_PRINT_EMPLOYEES;
  }

  function addEmployee() {
    flushVisibleEdits();
    if (state.employees.length >= MAX_PRINT_EMPLOYEES) {
      window.alert(t('employeeLimit'));
      return;
    }
    state.employees.push({ id: createEmployeeId(), name: `${t('newEmployee')} ${state.employees.length + 1}`, weight: 1 });
    render(false, true);
    saveState();
    employeeList.querySelector('.employee-item:last-child .emp-name')?.focus();
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
    resizeText(input);
    if (input.matches('.employee-name-input')) {
      const employee = state.employees.find(item => item.id === input.dataset.employeeId);
      if (employee) {
        employee.name = singleLine(input.value, 100) || employee.name;
        const sidebarInput = employeeList.querySelector(`.emp-name[data-employee-id="${input.dataset.employeeId}"]`);
        if (sidebarInput && sidebarInput.value !== input.value) {
          sidebarInput.value = input.value;
        }
        input.closest('th')?.setAttribute('aria-label', `${t('employees')}: ${input.value}`);
      }
    } else if (input.matches('.column-header-input')) {
      const column = state.columns.find(item => item.id === input.dataset.field);
      if (!column) return;
      column.label = singleLine(input.value, 100);
      const sidebar = document.querySelector(`.column-name[data-column-id="${column.id}"]`);
      if (sidebar) sidebar.value = input.value;
      document.querySelectorAll(`.column-header-input[data-field="${input.dataset.field}"]`).forEach(other => {
        if (other !== input) { other.value = column.label; resizeText(other); }
      });
      scheduleSave();
      return;
    } else if (input.matches('.day-label-input')) {
      state.dayLabels[input.dataset.date] = singleLine(input.value, 30);
    } else if (input.matches('.cell-input')) {
      const column = state.columns.find(item => item.id === input.dataset.field);
      const value = singleLine(input.value, column.type === 'hours' ? 5 : 200);
      if (column.type === 'hours') {
        const valid = isValidHours(value);
        input.classList.toggle('is-invalid', !valid);
        input.setAttribute('aria-invalid', String(!valid));
        input.title = valid ? '' : t('invalidHours');
        if (!valid) {
          input.setCustomValidity(t('invalidHours'));
          return;
        }
        input.setCustomValidity('');
      }
      const key = `${input.dataset.date}:${input.dataset.employeeId}`;
      const cell = state.data[key] || {};
      cell[input.dataset.field] = value;
      if (Object.values(cell).some(Boolean)) state.data[key] = cell;
      else delete state.data[key];
      if (column.type === 'hours') updateTotalsUI();
    } else {
      return;
    }
    scheduleSave();
  }

  function onEmployeeNameInput(event) {
    const employeeId = event.target.dataset.employeeId;
    const employee = state.employees.find(item => item.id === employeeId);
    if (!employee) return;
    employee.name = singleLine(event.target.value, 100) || employee.name;
    const tableHeader = tableHead.querySelector(`th.employee-name[data-employee-id="${employeeId}"]`);
    if (tableHeader) {
      const tableInput = tableHeader.querySelector('.employee-name-input');
      if (tableInput && tableInput.value !== event.target.value) {
        tableInput.value = event.target.value; resizeText(tableInput);
      } else if (!tableInput) {
        tableHeader.textContent = event.target.value;
      }
      tableHeader.setAttribute('aria-label', `${t('employees')}: ${event.target.value}`);
    }
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
    animateControl(monthSelect);
    state.month = Number(monthSelect.value);
    state.monthLabel = '';
    monthLabelInput.value = '';
    computeHolidays();
    render(false, true);
    saveState();
  }

  function renderYearPicker() {
    yearPopup.replaceChildren();

    const header = makeElement('div', 'year-popup-header');
    const prevBtn = makeElement('button', 'year-nav-btn', '‹');
    prevBtn.type = 'button';
    prevBtn.setAttribute('aria-label', t('previousYears'));
    prevBtn.disabled = yearPickerBase <= 1902;
    prevBtn.addEventListener('click', event => {
      event.stopPropagation();
      yearPickerBase = Math.max(1902, yearPickerBase - 6);
      renderYearPicker();
    });

    const rangeLabel = makeElement('span', 'year-range-label', `${yearPickerBase - 2} – ${yearPickerBase + 3}`);

    const nextBtn = makeElement('button', 'year-nav-btn', '›');
    nextBtn.type = 'button';
    nextBtn.setAttribute('aria-label', t('nextYears'));
    nextBtn.disabled = yearPickerBase >= 2197;
    nextBtn.addEventListener('click', event => {
      event.stopPropagation();
      yearPickerBase = Math.min(2197, yearPickerBase + 6);
      renderYearPicker();
    });
    header.append(prevBtn, rangeLabel, nextBtn);
    yearPopup.appendChild(header);

    for (let year = yearPickerBase - 2; year <= yearPickerBase + 3; year += 1) {
      const tile = makeElement('button', `year-tile${year === state.year ? ' selected' : ''}`, year);
      tile.type = 'button';
      tile.disabled = year < 1900 || year > 2200;
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
      yearPickerBase = currentYear;
      selectYear(currentYear);
    });
    yearPopup.appendChild(currentTile);
  }

  function selectYear(year) {
    flushVisibleEdits();
    state.year = Math.round(window.TimeSheetLayout.clamp(year, 1900, 2200, state.year));
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

  function printStrings() { return { part: t('part'), print: t('print'), printHint: t('printHint') }; }
  function openPrintPreview() { window.TimeSheetPrint.open(table, state, printStrings()); }
  function prepareNativePrint() {
    document.getElementById('print-root')?.remove();
    document.getElementById('native-print-style')?.remove();
    const style = document.createElement('style'); style.id = 'native-print-style'; style.media = 'print';
    style.textContent = window.TimeSheetPrint.css(state) + '\nbody > #app, body > #save-status { display: none !important; } #print-root { display: block !important; }';
    document.head.appendChild(style);
    document.body.appendChild(window.TimeSheetPrint.build(document, table, state, printStrings()));
  }

  function toggleSettings(event) {
    event.preventDefault();
    const opening = !settingsDetails.open;
    if (opening) {
      settingsDetails.classList.remove('is-closing');
      settingsDetails.open = true;
      requestAnimationFrame(() => settingsDetails.classList.add('is-opening'));
      window.setTimeout(() => settingsDetails.classList.remove('is-opening'), 350);
      return;
    }
    settingsDetails.classList.remove('is-opening');
    settingsDetails.classList.add('is-closing');
    window.setTimeout(() => {
      settingsDetails.open = false;
      settingsDetails.classList.remove('is-closing');
    }, 300);
  }

  function onPrint() {
    flushVisibleEdits();
    saveState();
    if (table.querySelector('.is-invalid')) { table.querySelector('.is-invalid').reportValidity(); return; }
    openPrintPreview();
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
      if (showTotalsToggle) showTotalsToggle.checked = state.showTotals;
      darkSheetToggle.checked = state.darkSheet;
      columnWidthPreset.value = state.colWidthPreset;
      pageLayoutSelect.value = state.pageLayout;
      applyLanguage(state.lang);
      applyTheme();
      computeHolidays();
      render(false);
    }, error => window.alert(`${t('importFailed')}: ${error.message}`));
  }

  function refreshAfterDataFileChange() {
    initMonthSelect();
    populateHolidaySelect();
    yearBtn.textContent = state.year;
    monthLabelInput.value = state.monthLabel;
    langSelect.value = state.lang;
    holidaySelect.value = state.holidayCountry;
    darkToggle.checked = state.darkMode;
    if (showTotalsToggle) showTotalsToggle.checked = state.showTotals;
    darkSheetToggle.checked = state.darkSheet;
    columnWidthPreset.value = state.colWidthPreset;
    pageLayoutSelect.value = state.pageLayout;
    applyLanguage(state.lang);
    applyTheme();
    computeHolidays();
    render(false);
    updateDataFileStatus();
  }

  async function openDataFile() {
    try {
      await storage.openDataFile();
      refreshAfterDataFileChange();
    } catch (error) {
      if (error.name !== 'AbortError') window.alert(`${t('dataFileFailed')}: ${error.message}`);
    }
  }

  async function createDataFile() {
    try {
      await storage.createDataFile();
      updateDataFileStatus();
    } catch (error) {
      if (error.name !== 'AbortError') window.alert(`${t('dataFileFailed')}: ${error.message}`);
    }
  }

  function resetToDefaults() {
    if (window.confirm(t('resetDefaults') + '?')) storage.reset();
  }

  function fillWorkingDays() {
    flushVisibleEdits();
    const days = daysInMonth(state.month, state.year);
    state.employees.forEach(employee => {
      for (let day = 1; day <= days; day += 1) {
        if (!isSpecialDay(state.year, state.month, day)) {
          const key = `${dateKey(state.year, state.month, day)}:${employee.id}`;
          const current = state.data[key] || {};
          const entry = { ...current };
          visibleColumns().filter(column => column.type === 'hours').forEach(column => { if (!entry[column.id]) entry[column.id] = '8'; });
          if (Object.values(entry).some(Boolean)) state.data[key] = entry;
        }
      }
    });
    render(false, true);
    saveState();
  }

  function clearMonth() {
    if (!window.confirm(t('clearMonthConfirm'))) return;
    flushVisibleEdits();
    const days = daysInMonth(state.month, state.year);
    state.employees.forEach(employee => {
      for (let day = 1; day <= days; day += 1) {
        const key = `${dateKey(state.year, state.month, day)}:${employee.id}`;
        delete state.data[key];
      }
    });
    render(false, true);
    saveState();
  }

  function exportToCsv() {
    flushVisibleEdits();
    saveState();
    const days = daysInMonth(state.month, state.year);
    const columns = visibleColumns();
    const csv = value => {
      let text = String(value ?? '');
      if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const sep = ';';
    const lines = [];

    const title = state.monthLabel.trim() || generateMonthLabel();
    lines.push(csv(title));
    lines.push('');

    const headers = [`"${t('day')}"`];
    state.employees.forEach(emp => {
      columns.forEach(column => headers.push(csv(`${emp.name} - ${columnLabel(column)}`)));
    });
    lines.push(headers.join(sep));

    const totals = calculateEmployeeTotals();

    for (let day = 1; day <= days; day += 1) {
      const key = dateKey(state.year, state.month, day);
      const dayLabel = state.dayLabels[key] || String(day);
      const special = isSpecialDay(state.year, state.month, day);
      const row = [csv(`${dayLabel}${special ? ' *' : ''}`)];
      state.employees.forEach(emp => {
        const cell = state.data[`${key}:${emp.id}`] || {};
        columns.forEach(column => row.push(csv(cell[column.id] || '')));
      });
      lines.push(row.join(sep));
    }

    if (state.showTotals && columns.some(column => column.type === 'hours')) {
      const totalRow = [`"${t('total')}"`];
      state.employees.forEach(emp => {
        columns.forEach(column => totalRow.push(csv(column.type === 'hours' ? formatHoursNumber(totals[`${emp.id}:${column.id}`]) : '')));
      });
      lines.push(totalRow.join(sep));
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet-${state.year}-${String(state.month + 1).padStart(2, '0')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function onTableKeyDown(event) {
    if (!state.editMode) return;
    const input = event.target;
    if (!input || !input.matches('.table-input')) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      const currentCell = input.closest('td, th');
      const currentRow = currentCell?.closest('tr');
      if (!currentRow) return;

      const cellIndex = Array.from(currentRow.children).indexOf(currentCell);
      const targetRow = event.shiftKey ? currentRow.previousElementSibling : currentRow.nextElementSibling;
      if (targetRow) {
        const targetCell = targetRow.children[cellIndex];
        const targetInput = targetCell?.querySelector('.table-input');
        if (targetInput) {
          targetInput.focus();
          targetInput.select();
        }
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const currentCell = input.closest('td, th');
      const currentRow = currentCell?.closest('tr');
      if (!currentRow) return;
      const cellIndex = Array.from(currentRow.children).indexOf(currentCell);
      const targetRow = event.key === 'ArrowDown' ? currentRow.nextElementSibling : currentRow.previousElementSibling;
      if (targetRow) {
        const targetCell = targetRow.children[cellIndex];
        const targetInput = targetCell?.querySelector('.table-input');
        if (targetInput) {
          event.preventDefault();
          targetInput.focus();
          targetInput.select();
        }
      }
    } else if (event.key === 'Escape') {
      input.blur();
    }
  }

  function onTableClick(event) {
    if (state.editMode) return;
    const cell = event.target.closest('td, th');
    if (!cell || cell.closest('tfoot') || cell.classList.contains('main-header') || cell.classList.contains('corner-cell')) return;

    editToggle.checked = true;
    onEditToggle();

    const day = cell.closest('tr')?.dataset.day;
    const employeeId = cell.dataset.employeeId;
    const field = cell.dataset.columnId;
    if (day && employeeId) {
      const key = dateKey(state.year, state.month, Number(day));
      const targetInput = tableBody.querySelector(`.cell-input[data-date="${key}"][data-employee-id="${employeeId}"][data-field="${field}"]`);
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    } else if (employeeId && cell.classList.contains('employee-name')) {
      const nameInput = tableHead.querySelector(`.employee-name-input[data-employee-id="${employeeId}"]`);
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    } else if (field && employeeId) {
      tableHead.querySelector(`th[data-employee-id="${employeeId}"][data-column-id="${field}"] .column-header-input`)?.focus();
    } else if (day) {
      tableBody.querySelector(`tr[data-day="${day}"] .day-label-input`)?.focus();
    }
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
    if (showTotalsToggle) showTotalsToggle.checked = state.showTotals;
    darkSheetToggle.checked = state.darkSheet;
    columnWidthPreset.value = state.colWidthPreset;
    pageLayoutSelect.value = state.pageLayout;

    monthSelect.addEventListener('change', onMonthChange);
    yearBtn.addEventListener('click', event => {
      event.stopPropagation();
      yearPickerBase = state.year;
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
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && yearPopup.classList.contains('open')) {
        yearPopup.classList.remove('open'); yearBtn.setAttribute('aria-expanded', 'false'); yearBtn.focus();
      }
    });
    monthLabelInput.addEventListener('input', () => {
      state.monthLabel = monthLabelInput.value.slice(0, 200);
      const displayLabel = state.monthLabel.trim() || generateMonthLabel();
      const mainHeader = tableHead.querySelector('.main-header');
      if (mainHeader) mainHeader.textContent = displayLabel;
      scheduleSave();
    });
    initLayoutEditor();
    new ResizeObserver(() => { if (tableColgroup.children.length) { updateColumnWidths(); table.querySelectorAll('textarea').forEach(resizeText); } }).observe(sheetPage);
    window.addEventListener('beforeprint', prepareNativePrint);
    window.addEventListener('afterprint', () => { document.getElementById('print-root')?.remove(); document.getElementById('native-print-style')?.remove(); });
    window.addEventListener('timesheet-file-error', () => updateDataFileStatus(t('dataFileWriteFailed')));
    editToggle.addEventListener('change', onEditToggle);
    settingsDetails.querySelector('summary').addEventListener('click', toggleSettings);
    table.addEventListener('input', onTableInput);
    document.addEventListener('focusin', event => updateInteractionStatus(event.target));
    table.addEventListener('focusout', event => {
      const input = event.target;
      if (!input.matches('.is-invalid')) return;
      input.value = state.data[`${input.dataset.date}:${input.dataset.employeeId}`]?.[input.dataset.field] || '';
      input.setCustomValidity(''); input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid');
      saveStatus.textContent = t('invalidHoursRejected'); saveStatus.classList.add('save-error');
    });
    table.addEventListener('keydown', onTableKeyDown);
    table.addEventListener('click', onTableClick);
    tableBody.addEventListener('change', onDayCheckboxChange);
    addEmployeeBtn.addEventListener('click', addEmployee);
    if (fillWorkdaysBtn) fillWorkdaysBtn.addEventListener('click', fillWorkingDays);
    if (clearMonthBtn) clearMonthBtn.addEventListener('click', clearMonth);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCsv);
    printBtn.addEventListener('click', onPrint);
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      flushVisibleEdits();
      animateControl(todayBtn);
      state.month = now.getMonth();
      state.year = now.getFullYear();
      state.monthLabel = '';
      monthLabelInput.value = '';
      yearBtn.textContent = state.year;
      computeHolidays();
      render(false, true);
      saveState();
    });
    langSelect.addEventListener('change', () => {
      flushVisibleEdits();
      animateControl(langSelect);
      applyLanguage(langSelect.value);
      saveState();
    });
    holidaySelect.addEventListener('change', () => {
      flushVisibleEdits();
      animateControl(holidaySelect);
      state.holidayCountry = holidaySelect.value;
      computeHolidays();
      render(false);
      saveState();
    });
    showTotalsToggle.addEventListener('change', () => {
      flushVisibleEdits();
      state.showTotals = showTotalsToggle.checked;
      render(false, true);
      saveState();
    });
    darkToggle.addEventListener('change', () => {
      state.darkMode = darkToggle.checked;
      applyTheme();
      saveState();
    });
    darkSheetToggle.addEventListener('change', () => {
      state.darkSheet = darkSheetToggle.checked;
      applyTheme();
      saveState();
    });
    columnWidthPreset.addEventListener('change', () => {
      flushVisibleEdits();
      state.colWidthPreset = columnWidthPreset.value;
      if (state.colWidthPreset !== 'custom') {
        const defaults = window.TimeSheetLayout.defaultColumns(state);
        state.columns.forEach(column => { const match = defaults.find(item => item.id === column.id); if (match) column.weight = match.weight; });
      }
      animateControl(columnWidthPreset);
      render(false, true);
      saveState();
    });
    pageLayoutSelect.addEventListener('change', () => {
      flushVisibleEdits();
      state.pageLayout = pageLayoutSelect.value === 'landscape' ? 'landscape' : 'portrait';
      animateControl(pageLayoutSelect);
      render(false, true);
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
    openDataFileBtn.addEventListener('click', openDataFile);
    createDataFileBtn.addEventListener('click', createDataFile);
    document.getElementById('reset-btn').addEventListener('click', resetToDefaults);
    window.addEventListener('beforeunload', () => {
      flushVisibleEdits();
      storage.save();
    });

    editToggle.checked = state.editMode;
    editControls.classList.toggle('is-visible', state.editMode);
    applyLanguage(state.lang);
    applyTheme();
    updateDataFileStatus();
    computeHolidays();
    render(false);
    if (loaded) saveState();
    if (loaded === false) { saveStatus.textContent = t('loadError'); saveStatus.classList.add('save-error'); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
