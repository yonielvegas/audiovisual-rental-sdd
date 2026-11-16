const storageKey = 'inventario.credencial';

const nodes = {
  accessForm: document.querySelector('#access-form'),
  accessToken: document.querySelector('#access-token'),
  accessClear: document.querySelector('#access-clear'),
  accessStatus: document.querySelector('#access-status'),
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

// La credencial vive solo en la pestaña actual. RF-01 la sustituirá por la
// sesión acordada por el equipo.
let credential = sessionStorage.getItem(storageKey) ?? '';

function report(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
  element.hidden = !message;
}

function headers(withBody) {
  const result = { Accept: 'application/json' };
  if (credential) result.Authorization = `Bearer ${credential}`;
  if (withBody) result['Content-Type'] = 'application/json';
  return result;
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    cache: 'no-store',
    headers: headers(body !== undefined),
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

const count = (total, singular, plural) => `${total} ${total === 1 ? singular : plural}`;

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
  if (categories.length === 0) {
    report(nodes.categoryStatus, 'empty', 'Todavía no hay categorías registradas.');
  }
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
  if (equipment.length === 0) {
    report(nodes.equipmentStatus, 'empty', 'Todavía no hay equipos registrados.');
  }
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
  if (units.length === 0) {
    report(nodes.unitStatus, 'empty', 'Todavía no hay unidades registradas.');
  }
  return units;
}

function describeFailure(error) {
  if (error.status === 401) return 'La credencial no es válida o no se envió. Vuelve a introducirla.';
  if (error.status === 403) return 'La cuenta no tiene permisos para administrar el inventario.';
  return error.message;
}

async function refresh() {
  try {
    await loadCategories();
    await loadEquipment();
    await loadUnits();
    report(nodes.accessStatus, 'ready', 'Credencial aceptada. Puedes administrar el inventario.');
  } catch (error) {
    report(nodes.accessStatus, 'error', describeFailure(error));
  }
}

async function submit(status, work) {
  report(status, 'busy', 'Guardando el cambio.');
  try {
    const message = await work();
    report(status, 'ready', message);
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
    await loadUnits().catch(() => {});
    await loadEquipment().catch(() => {});
  }
}

nodes.accessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  credential = nodes.accessToken.value.trim();
  if (!credential) return;
  sessionStorage.setItem(storageKey, credential);
  await refresh();
});

nodes.accessClear.addEventListener('click', () => {
  credential = '';
  sessionStorage.removeItem(storageKey);
  nodes.accessToken.value = '';
  nodes.categoryList.replaceChildren();
  nodes.equipmentList.replaceChildren();
  nodes.unitList.replaceChildren();
  report(nodes.accessStatus, 'empty', 'Credencial olvidada en esta pestaña.');
});

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
    await loadEquipment().catch(() => {});
    await loadCategories().catch(() => {});
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
    await loadUnits().catch(() => {});
    await loadEquipment().catch(() => {});
  }
});

// El catálogo público se consulta sin credencial, así que las listas de solo
// lectura se cargan de inmediato.
loadCategories()
  .then(loadEquipment)
  .catch(() => {});

if (credential) {
  nodes.accessToken.value = credential;
  refresh();
}
