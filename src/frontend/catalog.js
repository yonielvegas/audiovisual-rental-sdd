const filters = document.querySelector('#category-filters');
const list = document.querySelector('#equipment-list');
const status = document.querySelector('#catalog-status');
const template = document.querySelector('#equipment-card');

const allChip = filters.querySelector('button[data-category=""]');
let selected = '';

function showStatus(state, message) {
  status.dataset.state = state;
  status.textContent = message;
  status.hidden = !message;
}

async function readJson(path) {
  const response = await fetch(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'El servidor no pudo atender la consulta.');
  }
  return body;
}

function renderCategories(categories) {
  for (const category of categories) {
    const item = document.createElement('li');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.category = String(category.id);
    chip.setAttribute('aria-pressed', 'false');
    chip.textContent = `${category.name} (${category.equipmentCount})`;
    item.append(chip);
    filters.append(item);
  }
}

function renderEquipment(equipment) {
  list.replaceChildren();
  for (const item of equipment) {
    const card = template.content.cloneNode(true);
    card.querySelector('[data-field="category"]').textContent = item.category.name;
    card.querySelector('[data-field="name"]').textContent = item.name;

    const description = card.querySelector('[data-field="description"]');
    description.textContent = item.description;
    description.hidden = !item.description;

    card.querySelector('[data-field="units"]').textContent = item.activeUnits === 1
      ? '1 unidad en inventario'
      : `${item.activeUnits} unidades en inventario`;
    list.append(card);
  }
}

function markSelection() {
  for (const chip of filters.querySelectorAll('button[data-category]')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.category === selected));
  }
}

async function loadEquipment() {
  const query = selected ? `?categoryId=${encodeURIComponent(selected)}` : '';
  try {
    const { equipment } = await readJson(`/api/equipment${query}`);
    renderEquipment(equipment);
    if (equipment.length === 0) {
      showStatus('empty', selected
        ? 'Esta categoría todavía no tiene equipos publicados.'
        : 'El catálogo todavía no tiene equipos publicados.');
      return;
    }
    showStatus('ready', '');
  } catch (error) {
    renderEquipment([]);
    showStatus('error', error.message);
  }
}

function select(category) {
  selected = category;
  markSelection();
  const url = new URL(window.location.href);
  if (category) {
    url.searchParams.set('categoria', category);
  } else {
    url.searchParams.delete('categoria');
  }
  window.history.replaceState(null, '', url);
  return loadEquipment();
}

filters.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-category]');
  if (chip && chip.dataset.category !== selected) {
    select(chip.dataset.category);
  }
});

async function start() {
  const requested = new URL(window.location.href).searchParams.get('categoria') ?? '';
  try {
    const { categories } = await readJson('/api/categories');
    renderCategories(categories);
    allChip.textContent = `Todas (${categories.reduce((total, item) => total + item.equipmentCount, 0)})`;
    selected = categories.some((category) => String(category.id) === requested) ? requested : '';
  } catch (error) {
    showStatus('error', error.message);
    return;
  }
  markSelection();
  await loadEquipment();
}

start();
