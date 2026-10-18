(function () {
  'use strict';
  const safeId = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
  function defaultColumns(data = {}) {
    const ratios = { 'preset-90-10': [9, 1], 'preset-80-20': [4, 1], 'preset-20-80': [1, 4] };
    const [status, hours] = ratios[data.colWidthPreset] || [1, 1];
    return [
      { id: 'status', label: data.colStatusName || '', type: 'text', weight: status, visible: true },
      { id: 'hours', label: data.colHoursName || '', type: 'hours', weight: hours, visible: true },
    ];
  }
  function normalizeColumns(data) {
    if (data.columns === undefined) return defaultColumns(data);
    if (!Array.isArray(data.columns) || !data.columns.length || data.columns.length > 12) throw new Error('Invalid columns (1–12).');
    const ids = new Set();
    const columns = data.columns.map(column => {
      if (!column || !safeId.test(column.id) || ids.has(column.id) || ['__proto__', 'constructor', 'prototype'].includes(column.id)) throw new Error('Invalid column ID.');
      ids.add(column.id);
      return {
        id: column.id,
        label: typeof column.label === 'string' ? column.label.trim().slice(0, 100) : '',
        type: column.type === 'hours' ? 'hours' : 'text',
        weight: clamp(column.weight, 1, 20, 1),
        visible: column.visible !== false,
      };
    });
    if (!columns.some(column => column.visible)) throw new Error('At least one column must be visible.');
    return columns;
  }
  function clamp(value, min, max, fallback) {
    return Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  }
  function validHours(value) {
    return value === '' || (/^\d{1,2}(?:[.,]\d{1,2})?$/.test(value) && Number(value.replace(',', '.')) <= 24);
  }
  window.TimeSheetLayout = Object.freeze({ defaultColumns, normalizeColumns, clamp, validHours });
})();
