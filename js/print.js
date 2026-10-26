(function () {
  'use strict';
  // Keep readable text sizes: split wide sheets by default. 'page' fit keeps
  // everything on one sheet and lets fit() scale it down instead.
  const pageWidth = state => state.pageLayout === 'landscape' ? 285 : 198;
  const pageHeight = state => state.pageLayout === 'landscape' ? 198 : 285;
  function plan(state) {
    const available = pageWidth(state) - state.dayWidth - 1;
    const columns = state.columns.filter(column => column.visible);
    const minWidth = column => (column.type === 'hours' ? 14 : 24) * state.printFontSize / 9;
    function width(group) {
      const total = group.columns.reduce((sum, column) => sum + column.weight, 0);
      return Math.max(...group.columns.map(column => minWidth(column) * total / column.weight)) * group.employee.weight;
    }
    if (state.printFit === 'page') {
      return state.employees.length ? [state.employees.map(employee => ({ employee, columns, width: width({ employee, columns }) }))] : [];
    }
    const groups = [];
    state.employees.forEach(employee => {
      let group = { employee, columns: [] };
      columns.forEach(column => {
        const candidate = { employee, columns: [...group.columns, column] };
        if (group.columns.length && width(candidate) > available) {
          groups.push(group);
          group = { employee, columns: [column] };
        } else group = candidate;
      });
      groups.push(group);
    });
    const panels = [];
    let panel = [], used = 0;
    groups.forEach(group => {
      const required = Math.min(available, width(group));
      if (panel.length && (used + required > available || panel.some(item => item.employee.id === group.employee.id))) {
        panels.push(panel);
        panel = []; used = 0;
      }
      panel.push({ ...group, width: required });
      used += required;
    });
    if (panel.length) panels.push(panel);
    return panels;
  }

  function css(state) {
    return `
      @page { size: A4 ${state.pageLayout}; margin: 6mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: white; color: black; font-family: Arial, sans-serif; }
      .print-panel { width: ${state.pageLayout === 'landscape' ? 285 : 198}mm; margin: 0; padding: 0; break-after: page; }
      .print-panel:last-child { break-after: auto; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; color: black; font-size: ${state.printFontSize}pt; }
      th, td { border: .25mm solid #333; padding: .5mm .8mm; text-align: center; vertical-align: middle;
        white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; line-height: 1.25; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      tbody td { height: ${state.rowHeight}mm; }
      .main-header { font-size: ${state.printFontSize + 2}pt; padding: 2mm; }
      .sub-header { font-weight: normal; }
      .total-row { font-weight: bold; }
      .special-day { background: #eee; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-panel-note { margin: 0 0 2mm; font-size: 8pt; line-height: 1.3; overflow-wrap: anywhere; }
      .print-toolbar { padding: 12px; margin-bottom: 12px; background: #f0f2f5; display: flex; align-items: center; gap: 12px; }
      .print-toolbar button { padding: 8px 16px; cursor: pointer; }
      #print-root .print-panel { min-width: 0; min-height: 0; max-width: none; padding: 0; margin: 0; overflow: visible; border: 0; background: white; }
      #print-root table { font: ${state.printFontSize}pt Arial, sans-serif; color: black; }
      #print-root thead { position: static; }
      #print-root th, #print-root td { font-size: inherit; padding: .5mm .8mm; line-height: 1.25;
        white-space: pre-wrap; overflow: visible; overflow-wrap: anywhere; color: black; background: transparent; height: auto; }
      #print-root tbody td { height: ${state.rowHeight}mm; }
      #print-root .main-header { font-size: ${state.printFontSize + 2}pt; padding: 2mm; }
      #print-root .total-hours-value { color: black; }
      @media print { .print-toolbar { display: none; } }
    `;
  }

  function snapshot(source) {
    const clone = source.cloneNode(true);
    const inputs = source.querySelectorAll('input, textarea');
    clone.querySelectorAll('input, textarea').forEach((input, index) => {
      if (input.type === 'checkbox') input.closest('.day-special-control')?.remove();
      else input.replaceWith(clone.ownerDocument.createTextNode(inputs[index].value || inputs[index].placeholder || ''));
    });
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.classList.remove('edit-mode');
    return clone;
  }

  function build(doc, source, state, strings) {
    const root = doc.createElement('div');
    root.id = 'print-root';
    const panels = plan(state);
    panels.forEach((groups, index) => {
      const page = doc.createElement('section');
      page.className = `print-panel sheet-page ${state.pageLayout}`;
      const selected = (employeeId, columnId) => groups.some(group => group.employee.id === employeeId && group.columns.some(column => column.id === columnId));
      const clone = snapshot(source);
      if (index) clone.removeAttribute('id');
      const leafCount = groups.reduce((sum, group) => sum + group.columns.length, 0);
      clone.querySelectorAll('[data-column-id]').forEach(element => {
        if (!selected(element.dataset.employeeId, element.dataset.columnId)) element.remove();
        else element.style.removeProperty('width');
      });
      clone.querySelectorAll('th.employee-name').forEach(header => {
        const group = groups.find(item => item.employee.id === header.dataset.employeeId);
        if (!group) header.remove();
        else header.colSpan = group.columns.length;
      });
      const title = clone.querySelector('.main-header');
      if (title) {
        title.colSpan = 1 + leafCount;
        if (!state.showTitle) title.closest('tr').remove();
      }
      const totalWidth = groups.reduce((sum, group) => sum + group.width, 0);
      const panelWidth = state.printFit === 'page' ? Math.max(pageWidth(state), state.dayWidth + 1 + totalWidth) : pageWidth(state);
      if (state.printFit === 'page') { page.dataset.fit = 'page'; page.style.width = `${panelWidth}mm`; }
      const colgroup = clone.querySelector('colgroup');
      if (colgroup) {
        const available = panelWidth - state.dayWidth;
        colgroup.firstElementChild.style.width = `${state.dayWidth}mm`;
        groups.forEach(group => {
          const weight = group.columns.reduce((sum, column) => sum + column.weight, 0);
          group.columns.forEach(column => {
            const col = Array.from(colgroup.children).find(item => item.dataset.employeeId === group.employee.id && item.dataset.columnId === column.id);
            col.style.width = `${available * group.width / totalWidth * column.weight / weight}mm`;
          });
        });
      }
      if (panels.length > 1) {
        const note = doc.createElement('p');
        note.className = 'print-panel-note';
        note.textContent = `${strings.part} ${index + 1}/${panels.length} · ${groups.map(group => group.employee.name).join(', ')}`;
        page.appendChild(note);
      }
      page.appendChild(doc.importNode(clone, true));
      root.appendChild(page);
    });
    return root;
  }

  // Scale one-page panels to the printable A4 area. Needs the print CSS active.
  function fit(root, state) {
    const mm = 96 / 25.4;
    root.querySelectorAll('.print-panel[data-fit="page"]').forEach(page => {
      page.style.zoom = '';
      const box = page.getBoundingClientRect();
      const scale = Math.min(1, pageWidth(state) * mm / box.width, (pageHeight(state) - 2) * mm / box.height);
      if (scale < 1) page.style.zoom = String(Math.floor(scale * 1000) / 1000);
    });
  }

  function open(source, state, strings) {
    const popup = window.open('', '_blank');
    if (!popup) { window.print(); return; }
    const doc = popup.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="UTF-8"><title>TimeSheetLite</title></head><body></body></html>');
    doc.close();
    doc.documentElement.lang = state.lang;
    const style = doc.createElement('style'); style.textContent = css(state); doc.head.appendChild(style);
    const toolbar = doc.createElement('div'); toolbar.className = 'print-toolbar';
    const button = doc.createElement('button'); button.textContent = strings.print;
    button.addEventListener('click', () => popup.print());
    const hint = doc.createElement('span'); hint.textContent = strings.printHint;
    toolbar.append(button, hint); doc.body.appendChild(toolbar);
    const container = doc.createElement('main'); container.id = 'sheet-container';
    const root = build(doc, source, state, strings);
    container.appendChild(root); doc.body.appendChild(container); fit(root, state);
    popup.setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print(); } }, 100);
  }
  window.TimeSheetPrint = Object.freeze({ plan, css, build, fit, open });
})();
