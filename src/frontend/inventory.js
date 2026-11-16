const nodes = {
  pageStatus: document.querySelector('#inventory-status'),
  categoryForm: document.querySelector('#category-form'),
  categoryStatus: document.querySelector('#category-status'),
  categoryList: document.querySelector('#category-list'),
  equipmentForm: document.querySelector('#equipment-form'),
  equipmentStatus: document.querySelector('#equipment-status'),
  equipmentList: document.querySelector('#equipment-admin-list'),
  equipmentCategory: document.querySelector('#equipment-category'),
  unitForm: document.querySelector('#unit-form'),
  unitStatus: document.querySelector('#unit-status'),
  unitList: document.querySelector('#unit-list'),
  unitEquipment: document.querySelector('#unit-equipment'),
};

function report(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
  element.hidden = !message;
}

const count = (total, singular, plural) => `${total} ${total === 1 ? singular : plural}`;

// Aviso de lista vacía. Recargar una lista no debe borrar el resultado de la
// última acción, así que solo se limpia el aviso que puso esta misma función.
function reportEmpty(element, message) {
  if (message || element.dataset.state === 'empty') {
    report(element, 'empty', message);
  }
}

/**
 * La sesión viaja en una cookie `HttpOnly`, así que no hay ninguna credencial
 * que este módulo pueda leer ni guardar. El backend autoriza cada petición.
 */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'El servidor no pudo atender la solicitud.');
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload;
}

function option(value, label) {
  const element = document.createElement('option');
  element.value = String(value);
  element.textContent = label;
  return element;
}

function record(title, details, controls = []) {
  const item = document.createElement('li');
  item.className = 'record';

  const text = document.createElement('div');
  text.className = 'record-text';
  const heading = document.createElement('p');
  heading.className = 'record-title';
  heading.textContent = title;
  const meta = document.createElement('p');
  meta.className = 'record-meta';
  meta.textContent = details;
  text.append(heading, meta);
  item.append(text);

  if (controls.length > 0) {
    const actions = document.createElement('div');
    actions.className = 'record-actions';
    actions.append(...controls);
    item.append(actions);
  }
  return item;
}

async function loadCategories() {
  const { categories } = await api('/api/categories');
  nodes.categoryList.replaceChildren(...categories.map((category) => record(
    category.name,
    `Identificador ${category.id} · ${count(category.equipmentCount, 'equipo', 'equipos')}`,
  )));
  nodes.equipmentCategory.replaceChildren(
    option('', 'Selecciona una categoría'),
    ...categories.map((category) => option(category.id, category.name)),
  );
  reportEmpty(nodes.categoryStatus, categories.length === 0 ? 'Todavía no hay categorías registradas.' : '');
  return categories;
}

async function loadEquipment() {
  const { equipment } = await api('/api/equipment');
  nodes.equipmentList.replaceChildren(...equipment.map((item) => record(
    item.name,
    `Identificador ${item.id} · ${item.category.name} · ${count(item.activeUnits, 'unidad activa', 'unidades activas')}`,
  )));
  nodes.unitEquipment.replaceChildren(
    option('', 'Selecciona un equipo'),
    ...equipment.map((item) => option(item.id, `${item.name} · ${item.category.name}`)),
  );
  reportEmpty(nodes.equipmentStatus, equipment.length === 0 ? 'Todavía no hay equipos registrados.' : '');
  return equipment;
}

function unitControls(unit) {
  const codeForm = document.createElement('form');
  codeForm.className = 'inline-form';

  const label = document.createElement('label');
  label.className = 'visually-hidden';
  label.htmlFor = `unit-code-${unit.id}`;
  label.textContent = `Código de la unidad ${unit.inventoryCode}`;

  const input = document.createElement('input');
  input.id = `unit-code-${unit.id}`;
  input.type = 'text';
  input.value = unit.inventoryCode;
  input.maxLength = 24;
  input.required = true;

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'button button-secondary button-compact';
  save.textContent = 'Guardar código';
  codeForm.append(label, input, save);

  codeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await patchUnit(unit.id, { inventoryCode: input.value });
  });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'button button-secondary button-compact';
  toggle.textContent = unit.active ? 'Desactivar' : 'Activar';
  toggle.addEventListener('click', () => patchUnit(unit.id, { active: !unit.active }));

  return [codeForm, toggle];
}

async function loadUnits() {
  const { units } = await api('/api/units');
  nodes.unitList.replaceChildren(...units.map((unit) => {
    const item = record(
      unit.inventoryCode,
      `Unidad ${unit.id} · ${unit.equipment.name} · ${unit.equipment.category.name} · ${unit.active ? 'activa' : 'inactiva'}`,
      unitControls(unit),
    );
    item.dataset.active = String(unit.active);
    return item;
  }));
  reportEmpty(nodes.unitStatus, units.length === 0 ? 'Todavía no hay unidades registradas.' : '');
  return units;
}

function describeFailure(error) {
  if (error.status === 401) return 'La sesión caducó o se cerró. Vuelve a iniciar sesión para continuar.';
  if (error.status === 403) return 'La cuenta no tiene permisos para administrar el inventario.';
  return error.message;
}

async function submit(status, work) {
  report(status, 'busy', 'Guardando el cambio.');
  try {
    report(status, 'ready', await work());
    return true;
  } catch (error) {
    report(status, 'error', describeFailure(error));
    return false;
  }
}

async function patchUnit(id, patch) {
  const saved = await submit(nodes.unitStatus, async () => {
    const { unit } = await api(`/api/units/${id}`, { method: 'PATCH', body: patch });
    return `Unidad ${unit.id} actualizada. Código ${unit.inventoryCode}, ${unit.active ? 'activa' : 'inactiva'}.`;
  });
  if (saved) {
    await Promise.all([loadUnits().catch(() => {}), loadEquipment().catch(() => {})]);
  }
}

nodes.categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = new FormData(nodes.categoryForm).get('name');
  const saved = await submit(nodes.categoryStatus, async () => {
    const { category } = await api('/api/categories', { method: 'POST', body: { name } });
    return `Categoría «${category.name}» creada con el identificador ${category.id}.`;
  });
  if (saved) {
    nodes.categoryForm.reset();
    await loadCategories().catch(() => {});
  }
});

nodes.equipmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(nodes.equipmentForm);
  const saved = await submit(nodes.equipmentStatus, async () => {
    const { equipment } = await api('/api/equipment', {
      method: 'POST',
      body: {
        categoryId: Number(data.get('categoryId')),
        name: data.get('name'),
        description: data.get('description') ?? '',
      },
    });
    return `Equipo «${equipment.name}» creado con el identificador ${equipment.id}.`;
  });
  if (saved) {
    nodes.equipmentForm.reset();
    await Promise.all([loadEquipment().catch(() => {}), loadCategories().catch(() => {})]);
  }
});

nodes.unitForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(nodes.unitForm);
  const saved = await submit(nodes.unitStatus, async () => {
    const { unit } = await api('/api/units', {
      method: 'POST',
      body: { equipmentId: Number(data.get('equipmentId')), inventoryCode: data.get('inventoryCode') },
    });
    return `Unidad ${unit.id} registrada con el código ${unit.inventoryCode}.`;
  });
  if (saved) {
    nodes.unitForm.reset();
    await Promise.all([loadUnits().catch(() => {}), loadEquipment().catch(() => {})]);
  }
});

// El backend ya comprobó el rol antes de servir esta página. Si la sesión se
// cierra en otra pestaña, la primera consulta lo detecta y lo informa.
try {
  await Promise.all([loadCategories(), loadEquipment(), loadUnits()]);
  report(nodes.pageStatus, 'ready', '');
} catch (error) {
  report(nodes.pageStatus, 'error', describeFailure(error));
}
