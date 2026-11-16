/**
 * Administración del inventario (RF-03).
 *
 * Tres pestañas sobre los mismos contratos de `/api`: categorías, equipos y
 * unidades físicas. El backend ya comprobó el rol ADMIN antes de servir esta
 * página y vuelve a comprobarlo en cada petición, así que este módulo no toma
 * ninguna decisión de permisos: solo traduce respuestas a la interfaz.
 *
 * La sesión viaja en una cookie HttpOnly, de modo que no hay ninguna
 * credencial que este módulo pueda leer ni guardar.
 */

const el = (selector) => document.querySelector(selector);

const state = {
  categories: [],
  equipment: [],
  units: [],
  filters: {
    categories: { search: '' },
    equipment: { search: '', categoryId: '', published: '' },
    units: { search: '', equipmentId: '', active: '' },
  },
};

const pageStatus = el('#inventory-status');
const toasts = el('#toasts');

const count = (total, singular, plural) => `${total} ${total === 1 ? singular : plural}`;

// La tarifa viaja en céntimos enteros; aquí solo se da formato para mostrarla.
const formatRate = (rate) => (rate
  ? new Intl.NumberFormat('es', { style: 'currency', currency: rate.currency }).format(rate.cents / 100)
  : 'Sin fijar');

const normalize = (value) => String(value ?? '')
  .toLocaleLowerCase('es')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

function report(element, state_, message) {
  element.dataset.state = state_;
  element.textContent = message;
  element.hidden = !message;
}

// --- Notificaciones ------------------------------------------------------

function notify(kind, message) {
  const toast = document.createElement('p');
  toast.className = 'toast';
  toast.dataset.kind = kind;

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'icon');
  icon.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', kind === 'error' ? '#icon-alert' : '#icon-check');
  icon.append(use);

  const text = document.createElement('span');
  text.textContent = message;
  toast.append(icon, text);
  toasts.append(toast);

  // Los errores se quedan más tiempo porque suelen exigir una corrección.
  setTimeout(() => toast.remove(), kind === 'error' ? 8000 : 4500);
}

// --- API -----------------------------------------------------------------

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'El servidor no pudo atender la solicitud.');
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload;
}

function describeFailure(error) {
  if (error.status === 401) return 'La sesión caducó o se cerró. Vuelve a iniciar sesión para continuar.';
  if (error.status === 403) return 'La cuenta no tiene permisos para administrar el inventario.';
  return error.message;
}

// --- Ventanas modales ----------------------------------------------------

const dialogs = {
  category: el('#category-dialog'),
  equipment: el('#equipment-dialog'),
  unit: el('#unit-dialog'),
  confirm: el('#confirm-dialog'),
};

let lastTrigger = null;

function openDialog(dialog) {
  lastTrigger = document.activeElement;
  const error = dialog.querySelector('[data-dialog-error]');
  if (error) report(error, 'error', '');
  dialog.showModal();
  const field = dialog.querySelector('input:not([disabled]), select:not([disabled]), textarea');
  (field ?? dialog.querySelector('[data-submit], #confirm-accept'))?.focus();
}

function closeDialog(dialog) {
  dialog.close();
  // Devolver el foco a quien abrió la ventana mantiene usable el teclado.
  lastTrigger?.focus?.();
}

for (const dialog of Object.values(dialogs)) {
  for (const button of dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => closeDialog(dialog));
  }
  // Un clic fuera del recuadro cierra, igual que Escape.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
}

/**
 * Pide confirmación y resuelve a `true` solo si la persona aceptó.
 *
 * Los dos oyentes se registran una sola vez al cargar y comparten un único
 * resolvedor que se consume al primer desenlace. Así la acción no puede
 * dispararse dos veces ni quedarse esperando si la ventana se cierra con
 * Escape, con el botón de cancelar o pulsando fuera del recuadro.
 */
let resolveConfirm = null;

function settleConfirm(value) {
  const resolve = resolveConfirm;
  resolveConfirm = null;
  resolve?.(value);
}

el('#confirm-accept').addEventListener('click', () => {
  settleConfirm(true);
  closeDialog(dialogs.confirm);
});

dialogs.confirm.addEventListener('close', () => settleConfirm(false));

function confirmAction({ title, message, detail, confirmLabel }) {
  // Si quedara una confirmación anterior sin desenlace, se descarta.
  settleConfirm(false);
  el('#confirm-title').textContent = title;
  el('#confirm-message').textContent = message;
  report(el('#confirm-detail'), 'empty', detail ?? '');
  el('#confirm-accept').textContent = confirmLabel;
  openDialog(dialogs.confirm);

  return new Promise((resolve) => { resolveConfirm = resolve; });
}

// --- Carga de datos ------------------------------------------------------

async function loadAll() {
  const [categories, equipment, units] = await Promise.all([
    api('/api/categories'),
    api('/api/equipment'),
    api('/api/units'),
  ]);
  state.categories = categories.categories;
  state.equipment = equipment.equipment;
  state.units = units.units;
  renderAll();
}

async function refresh() {
  try {
    await loadAll();
    report(pageStatus, 'ready', '');
  } catch (error) {
    report(pageStatus, 'error', describeFailure(error));
  }
}

// --- Opciones de los selectores -----------------------------------------

function option(value, label, selected) {
  const node = document.createElement('option');
  node.value = String(value);
  node.textContent = label;
  node.selected = String(value) === String(selected);
  return node;
}

function fillSelectors() {
  const { equipment: equipmentFilters, units: unitFilters } = state.filters;

  el('#filter-equipment-category').replaceChildren(
    option('', 'Todas', equipmentFilters.categoryId),
    ...state.categories.map((category) => option(category.id, category.name, equipmentFilters.categoryId)),
  );
  el('#filter-units-equipment').replaceChildren(
    option('', 'Todos', unitFilters.equipmentId),
    ...state.equipment.map((item) => option(item.id, `${item.name} · ${item.category.name}`, unitFilters.equipmentId)),
  );
  el('#equipment-category').replaceChildren(
    option('', 'Selecciona una categoría'),
    ...state.categories.map((category) => option(category.id, category.name)),
  );
  el('#unit-equipment').replaceChildren(
    option('', 'Selecciona un equipo'),
    ...state.equipment.map((item) => option(item.id, `${item.name} · ${item.category.name}`)),
  );
}

// --- Construcción de filas ----------------------------------------------

function cell(row, label, content) {
  const td = document.createElement('td');
  td.dataset.label = label;
  if (typeof content === 'string') {
    td.textContent = content;
  } else if (content) {
    td.append(content);
  }
  row.append(td);
  return td;
}

function actionButton({ label, icon, variant = 'secondary', onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button-${variant} button-compact`;
  button.addEventListener('click', onClick);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', icon);
  svg.append(use);

  const text = document.createElement('span');
  text.textContent = label;
  button.append(svg, text);
  return button;
}

function actions(...buttons) {
  const group = document.createElement('div');
  group.className = 'row-actions';
  group.append(...buttons);
  return group;
}

function badge(text, tone) {
  const span = document.createElement('span');
  span.className = 'badge';
  span.dataset.tone = tone;
  span.textContent = text;
  return span;
}

function renderTable(name, rows, buildRow, emptyMessage) {
  const body = el(`#rows-${name}`);
  body.replaceChildren(...rows.map(buildRow));
  const empty = el(`#empty-${name}`);
  report(empty, 'empty', rows.length === 0 ? emptyMessage : '');
  el(`#panel-${name}`).querySelector('.table-wrap').hidden = rows.length === 0;
}

// --- Categorías ----------------------------------------------------------

function visibleCategories() {
  const search = normalize(state.filters.categories.search);
  return state.categories.filter((category) => !search || normalize(category.name).includes(search));
}

function renderCategories() {
  const rows = visibleCategories();
  renderTable('categories', rows, (category) => {
    const row = document.createElement('tr');
    cell(row, 'Nombre', category.name).classList.add('cell-strong');
    cell(row, 'Identificador', String(category.id));
    cell(row, 'Equipos', count(category.equipmentCount, 'equipo', 'equipos'));
    cell(row, 'Acciones', actions(
      actionButton({
        label: 'Editar',
        icon: '#icon-edit',
        onClick: () => openCategoryDialog(category),
      }),
      actionButton({
        label: 'Eliminar',
        icon: '#icon-trash',
        variant: 'danger',
        onClick: () => removeCategory(category),
      }),
    ));
    return row;
  }, state.categories.length === 0
    ? 'Todavía no hay categorías. Crea la primera para poder registrar equipos.'
    : 'Ninguna categoría coincide con la búsqueda.');
}

function openCategoryDialog(category) {
  const form = el('#category-form');
  form.reset();
  form.dataset.id = category?.id ?? '';
  el('#category-dialog-title').textContent = category ? `Editar «${category.name}»` : 'Nueva categoría';
  el('#category-name').value = category?.name ?? '';
  openDialog(dialogs.category);
}

async function removeCategory(category) {
  const blocked = category.equipmentCount > 0;
  const confirmed = await confirmAction({
    title: 'Eliminar categoría',
    message: blocked
      ? `«${category.name}» todavía agrupa ${count(category.equipmentCount, 'equipo', 'equipos')}.`
      : `Se eliminará la categoría «${category.name}».`,
    detail: blocked
      ? 'Mueve o elimina esos equipos antes de eliminar la categoría.'
      : 'La categoría está vacía, así que la acción no afecta a ningún equipo ni unidad.',
    confirmLabel: 'Eliminar',
  });
  if (!confirmed) return;

  try {
    await api(`/api/categories/${category.id}`, { method: 'DELETE' });
    notify('success', `Categoría «${category.name}» eliminada.`);
    await refresh();
  } catch (error) {
    notify('error', describeFailure(error));
  }
}

// --- Equipos -------------------------------------------------------------

function visibleEquipment() {
  const { search, categoryId, published } = state.filters.equipment;
  const term = normalize(search);
  return state.equipment.filter((item) => {
    if (categoryId && String(item.category.id) !== categoryId) return false;
    if (published === 'published' && !item.published) return false;
    if (published === 'unpublished' && item.published) return false;
    if (!term) return true;
    return [item.name, item.description, item.brand, item.model]
      .some((field) => normalize(field).includes(term));
  });
}

function renderEquipment() {
  const rows = visibleEquipment();
  renderTable('equipment', rows, (item) => {
    const row = document.createElement('tr');
    row.dataset.active = String(item.published);
    cell(row, 'Nombre', item.name).classList.add('cell-strong');
    cell(row, 'Categoría', item.category.name);
    cell(row, 'Marca y modelo', [item.brand, item.model].filter(Boolean).join(' ') || '—').classList.add('cell-muted');
    cell(row, 'Tarifa/día', formatRate(item.dailyRate));
    cell(row, 'Unidades activas', String(item.activeUnits));
    cell(row, 'Estado', badge(item.published ? 'Publicado' : 'Sin publicar', item.published ? 'ok' : 'muted'));
    cell(row, 'Acciones', actions(
      actionButton({ label: 'Editar', icon: '#icon-edit', onClick: () => openEquipmentDialog(item) }),
      actionButton({ label: 'Eliminar', icon: '#icon-trash', variant: 'danger', onClick: () => removeEquipment(item) }),
    ));
    return row;
  }, state.equipment.length === 0
    ? 'Todavía no hay equipos. Crea uno para poder registrar sus unidades físicas.'
    : 'Ningún equipo coincide con la búsqueda o el filtro.');
}

function openEquipmentDialog(item) {
  const form = el('#equipment-form');
  form.reset();
  form.dataset.id = item?.id ?? '';
  el('#equipment-dialog-title').textContent = item ? `Editar «${item.name}»` : 'Nuevo equipo';
  el('#equipment-category').value = item ? String(item.category.id) : '';
  el('#equipment-name').value = item?.name ?? '';
  el('#equipment-description').value = item?.description ?? '';
  el('#equipment-brand').value = item?.brand ?? '';
  el('#equipment-model').value = item?.model ?? '';
  // El formulario trabaja en unidades monetarias y convierte a céntimos al enviar.
  el('#equipment-rate').value = item?.dailyRate ? (item.dailyRate.cents / 100).toFixed(2) : '';
  el('#equipment-image').value = item?.imageUrl ?? '';
  el('#equipment-published').checked = item ? item.published : true;
  openDialog(dialogs.equipment);
}

async function removeEquipment(item) {
  const unitCount = state.units.filter((unit) => unit.equipment.id === item.id).length;
  const confirmed = await confirmAction({
    title: 'Eliminar equipo',
    message: unitCount > 0
      ? `«${item.name}» todavía tiene ${count(unitCount, 'unidad registrada', 'unidades registradas')}.`
      : `Se eliminará el equipo «${item.name}».`,
    detail: unitCount > 0
      ? 'Las unidades físicas no se borran, así que un equipo con unidades no se puede eliminar.'
      : 'El equipo no tiene unidades, así que la acción no afecta a ninguna reserva.',
    confirmLabel: 'Eliminar',
  });
  if (!confirmed) return;

  try {
    await api(`/api/equipment/${item.id}`, { method: 'DELETE' });
    notify('success', `Equipo «${item.name}» eliminado.`);
    await refresh();
  } catch (error) {
    notify('error', describeFailure(error));
  }
}

// --- Unidades físicas ----------------------------------------------------

function visibleUnits() {
  const { search, equipmentId, active } = state.filters.units;
  const term = normalize(search);
  return state.units.filter((unit) => {
    if (equipmentId && String(unit.equipment.id) !== equipmentId) return false;
    if (active === 'active' && !unit.active) return false;
    if (active === 'inactive' && unit.active) return false;
    if (!term) return true;
    return normalize(unit.inventoryCode).includes(term)
      || normalize(unit.equipment.name).includes(term)
      || normalize(unit.equipment.category.name).includes(term);
  });
}

function renderUnits() {
  const rows = visibleUnits();
  renderTable('units', rows, (unit) => {
    const row = document.createElement('tr');
    row.dataset.active = String(unit.active);
    cell(row, 'Código', unit.inventoryCode).classList.add('cell-code');
    cell(row, 'Identificador', String(unit.id));
    cell(row, 'Equipo', unit.equipment.name);
    cell(row, 'Categoría', unit.equipment.category.name);
    cell(row, 'Estado', badge(unit.active ? 'En servicio' : 'Retirada', unit.active ? 'ok' : 'muted'));
    cell(row, 'Acciones', actions(
      actionButton({ label: 'Editar', icon: '#icon-edit', onClick: () => openUnitDialog(unit) }),
      actionButton({
        label: unit.active ? 'Retirar' : 'Reactivar',
        icon: '#icon-power',
        variant: unit.active ? 'danger' : 'secondary',
        onClick: () => toggleUnit(unit),
      }),
    ));
    return row;
  }, state.units.length === 0
    ? 'Todavía no hay unidades físicas registradas.'
    : 'Ninguna unidad coincide con la búsqueda o los filtros.');
}

function openUnitDialog(unit) {
  const form = el('#unit-form');
  form.reset();
  form.dataset.id = unit?.id ?? '';
  el('#unit-dialog-title').textContent = unit ? `Editar la unidad ${unit.inventoryCode}` : 'Nueva unidad física';
  const equipmentSelect = el('#unit-equipment');
  equipmentSelect.value = unit ? String(unit.equipment.id) : '';
  // El equipo de una unidad registrada no se cambia: la identidad física no se traslada.
  equipmentSelect.disabled = Boolean(unit);
  el('#unit-code').value = unit?.inventoryCode ?? '';
  openDialog(dialogs.unit);
}

async function toggleUnit(unit) {
  const retiring = unit.active;
  const confirmed = await confirmAction({
    title: retiring ? 'Retirar del servicio' : 'Reactivar unidad',
    message: retiring
      ? `La unidad ${unit.inventoryCode} dejará de aparecer en el catálogo y en la disponibilidad.`
      : `La unidad ${unit.inventoryCode} volverá a estar disponible.`,
    detail: retiring
      ? 'La unidad conserva su identificador y su historial. Puedes reactivarla cuando vuelva al servicio.'
      : '',
    confirmLabel: retiring ? 'Retirar' : 'Reactivar',
  });
  if (!confirmed) return;

  try {
    const { unit: saved } = await api(`/api/units/${unit.id}`, {
      method: 'PATCH',
      body: { active: !unit.active },
    });
    notify('success', `Unidad ${saved.inventoryCode} ${saved.active ? 'reactivada' : 'retirada del servicio'}.`);
    await refresh();
  } catch (error) {
    notify('error', describeFailure(error));
  }
}

// --- Envío de los formularios -------------------------------------------

async function submitForm(dialog, form, work) {
  const errorBox = form.querySelector('[data-dialog-error]');
  const submit = form.querySelector('[data-submit]');
  submit.disabled = true;
  report(errorBox, 'error', '');
  try {
    notify('success', await work());
    closeDialog(dialog);
    await refresh();
  } catch (error) {
    // El error se muestra dentro de la ventana para no perder lo escrito.
    report(errorBox, 'error', describeFailure(error));
  } finally {
    submit.disabled = false;
  }
}

// `FormData` devuelve texto o un archivo. El formulario no tiene campos de
// archivo, pero leer siempre como texto evita convertir un objeto por descuido.
function textField(data, name) {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

el('#category-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const name = textField(new FormData(form), 'name');
  void submitForm(dialogs.category, form, async () => {
    const { category } = id
      ? await api(`/api/categories/${id}`, { method: 'PATCH', body: { name } })
      : await api('/api/categories', { method: 'POST', body: { name } });
    return id
      ? `Categoría actualizada: «${category.name}».`
      : `Categoría «${category.name}» creada con el identificador ${category.id}.`;
  });
});

el('#equipment-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const data = new FormData(form);
  const rate = textField(data, 'dailyRate').trim();
  const payload = {
    categoryId: Number(textField(data, 'categoryId')),
    name: textField(data, 'name'),
    description: textField(data, 'description'),
    brand: textField(data, 'brand'),
    model: textField(data, 'model'),
    // Se redondea al céntimo para no arrastrar errores de coma flotante.
    dailyRateCents: rate === '' ? null : Math.round(Number(rate) * 100),
    imageUrl: textField(data, 'imageUrl').trim() || null,
    published: form.querySelector('#equipment-published').checked,
  };
  void submitForm(dialogs.equipment, form, async () => {
    const { equipment } = id
      ? await api(`/api/equipment/${id}`, { method: 'PATCH', body: payload })
      : await api('/api/equipment', { method: 'POST', body: payload });
    return id
      ? `Equipo actualizado: «${equipment.name}».`
      : `Equipo «${equipment.name}» creado con el identificador ${equipment.id}.`;
  });
});

el('#unit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const data = new FormData(form);
  void submitForm(dialogs.unit, form, async () => {
    if (id) {
      const { unit } = await api(`/api/units/${id}`, {
        method: 'PATCH',
        body: { inventoryCode: textField(data, 'inventoryCode') },
      });
      return `Unidad ${unit.id} actualizada. Código ${unit.inventoryCode}.`;
    }
    const { unit } = await api('/api/units', {
      method: 'POST',
      body: { equipmentId: Number(textField(data, 'equipmentId')), inventoryCode: textField(data, 'inventoryCode') },
    });
    return `Unidad ${unit.id} registrada con el código ${unit.inventoryCode}.`;
  });
});

for (const [kind, open] of [
  ['category', () => openCategoryDialog(null)],
  ['equipment', () => openEquipmentDialog(null)],
  ['unit', () => openUnitDialog(null)],
]) {
  el(`[data-create="${kind}"]`).addEventListener('click', open);
}

// --- Buscador y filtros --------------------------------------------------

const controls = [
  ['#search-categories', 'categories', 'search', renderCategories],
  ['#search-equipment', 'equipment', 'search', renderEquipment],
  ['#filter-equipment-category', 'equipment', 'categoryId', renderEquipment],
  ['#filter-equipment-published', 'equipment', 'published', renderEquipment],
  ['#search-units', 'units', 'search', renderUnits],
  ['#filter-units-equipment', 'units', 'equipmentId', renderUnits],
  ['#filter-units-state', 'units', 'active', renderUnits],
];

for (const [selector, section, key, render] of controls) {
  el(selector).addEventListener('input', (event) => {
    state.filters[section][key] = event.target.value;
    render();
  });
}

// --- Pestañas ------------------------------------------------------------

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab, { focus = true } = {}) {
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    el(`#${candidate.getAttribute('aria-controls')}`).hidden = !selected;
  }
  if (focus) tab.focus();
  const section = tab.id.replace('tab-', '');
  window.history.replaceState(null, '', `#${section}`);
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab, { focus: false }));
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    selectTab(tabs[(index + step + tabs.length) % tabs.length]);
  });
}

// --- Resumen y primer pintado -------------------------------------------

function renderSummary() {
  const totals = {
    categories: state.categories.length,
    equipment: state.equipment.length,
    units: state.units.length,
    active: state.units.filter((unit) => unit.active).length,
    inactive: state.units.filter((unit) => !unit.active).length,
  };
  for (const node of document.querySelectorAll('[data-summary]')) {
    node.textContent = String(totals[node.dataset.summary]);
  }
}

function renderAll() {
  fillSelectors();
  renderSummary();
  renderCategories();
  renderEquipment();
  renderUnits();
}

// Permite enlazar una pestaña concreta, también al cambiar el fragmento sin
// recargar la página.
function selectTabFromHash({ focus = false } = {}) {
  const requested = tabs.find((tab) => tab.id === `tab-${window.location.hash.slice(1)}`);
  if (requested) selectTab(requested, { focus });
}

window.addEventListener('hashchange', () => selectTabFromHash());
selectTabFromHash();

await refresh();
