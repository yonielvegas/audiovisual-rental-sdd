/**
 * Catálogo público (RF-02).
 *
 * Lee el inventario por `/api/categories` y `/api/equipment`, de modo que
 * cualquier cambio de la administración se refleja al recargar. Las dos
 * consultas son públicas: no requieren sesión y el backend solo devuelve los
 * equipos publicados a quien no administra el inventario.
 *
 * Esta pantalla solo consulta. La disponibilidad por fechas y la reserva
 * corresponden a RF-04 y RF-05, que son otra entrega.
 */

const el = (selector) => document.querySelector(selector);

const filters = el('#category-filters');
const list = el('#equipment-list');
const status = el('#catalog-status');
const template = el('#equipment-card');
const detail = el('#detail-dialog');
const allChip = filters.querySelector('button[data-category=""]');

const state = { equipment: [], categories: [], category: '', search: '', order: 'name-asc' };
let lastTrigger = null;

const normalize = (value) => String(value ?? '')
  .toLocaleLowerCase('es')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

const formatRate = (rate) => (rate
  ? new Intl.NumberFormat('es', { style: 'currency', currency: rate.currency }).format(rate.cents / 100)
  : 'Tarifa por confirmar');

const unitsLabel = (total) => (total === 1 ? '1 unidad en servicio' : `${total} unidades en servicio`);

function showStatus(kind, message) {
  status.dataset.state = kind;
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

// --- Selección visible ---------------------------------------------------

const orders = {
  'name-asc': (a, b) => a.name.localeCompare(b.name, 'es'),
  'name-desc': (a, b) => b.name.localeCompare(a.name, 'es'),
  // Un equipo sin tarifa fijada se ordena al final en ambos sentidos, porque
  // no tiene un valor con el que compararse.
  'price-asc': (a, b) => rateOf(a, Infinity) - rateOf(b, Infinity),
  'price-desc': (a, b) => rateOf(b, -Infinity) - rateOf(a, -Infinity),
  'units-desc': (a, b) => b.activeUnits - a.activeUnits || a.name.localeCompare(b.name, 'es'),
};

const rateOf = (item, fallback) => (item.dailyRate ? item.dailyRate.cents : fallback);

function visibleEquipment() {
  const term = normalize(state.search);
  return state.equipment
    .filter((item) => {
      if (state.category && String(item.category.id) !== state.category) return false;
      if (!term) return true;
      return [item.name, item.brand, item.model].some((field) => normalize(field).includes(term));
    })
    .sort(orders[state.order] ?? orders['name-asc']);
}

// --- Tarjetas ------------------------------------------------------------

function fillMedia(container, item) {
  const image = container.querySelector('[data-field="image"]');
  const placeholder = container.querySelector('[data-field="placeholder"]');
  const hasImage = Boolean(item.imageUrl);
  image.hidden = !hasImage;
  placeholder.style.display = hasImage ? 'none' : '';
  if (hasImage) {
    image.src = item.imageUrl;
    // La imagen es decorativa: el nombre del equipo ya está en el título.
    image.alt = '';
    // Si la imagen no carga, la tarjeta vuelve al marcador y conserva su altura.
    image.addEventListener('error', () => {
      image.hidden = true;
      placeholder.style.display = '';
    }, { once: true });
  }
}

function buildCard(item) {
  const card = template.content.cloneNode(true);
  const button = card.querySelector('.card-button');
  button.setAttribute('aria-label', `Ver los detalles de ${item.name}`);
  button.addEventListener('click', () => openDetail(item, button));

  fillMedia(card.querySelector('[data-field="media"]'), item);
  card.querySelector('[data-field="category"]').textContent = item.category.name;
  card.querySelector('[data-field="name"]').textContent = item.name;

  const brand = card.querySelector('[data-field="brand"]');
  const brandText = [item.brand, item.model].filter(Boolean).join(' ');
  brand.textContent = brandText;
  brand.hidden = !brandText;

  const description = card.querySelector('[data-field="description"]');
  description.textContent = item.description;
  description.hidden = !item.description;

  card.querySelector('[data-field="price"]').textContent = formatRate(item.dailyRate);

  const units = card.querySelector('[data-field="units"]');
  units.textContent = item.activeUnits === 0 ? 'Sin unidades en servicio' : unitsLabel(item.activeUnits);
  units.dataset.tone = item.activeUnits === 0 ? 'muted' : 'ok';
  return card;
}

function renderEquipment() {
  const rows = visibleEquipment();
  list.replaceChildren(...rows.map(buildCard));

  if (rows.length > 0) {
    showStatus('ready', '');
    return;
  }
  if (state.equipment.length === 0) {
    showStatus('empty', 'El catálogo todavía no tiene equipos publicados.');
    return;
  }
  showStatus('empty', 'Ningún equipo coincide con la búsqueda o la categoría seleccionada.');
}

// --- Detalle -------------------------------------------------------------

function openDetail(item, trigger) {
  lastTrigger = trigger;
  el('#detail-title').textContent = item.name;
  el('#detail-category').textContent = item.category.name;

  const description = el('#detail-description');
  description.textContent = item.description || 'Este equipo todavía no tiene una descripción.';
  description.classList.toggle('is-muted', !item.description);

  el('#detail-brand').textContent = item.brand || 'Sin indicar';
  el('#detail-model').textContent = item.model || 'Sin indicar';
  el('#detail-price').textContent = formatRate(item.dailyRate);
  el('#detail-units').textContent = item.activeUnits === 0
    ? 'Ninguna en servicio'
    : unitsLabel(item.activeUnits);
  el('#detail-id').textContent = String(item.id);

  const media = el('#detail-media');
  media.replaceChildren();
  if (item.imageUrl) {
    const image = document.createElement('img');
    image.src = item.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove(), { once: true });
    media.append(image);
  }
  media.hidden = !item.imageUrl;

  detail.showModal();
}

// El foco vuelve a la tarjeta de forma explícita en cada camino de cierre. No
// basta con escuchar `close`: hay navegadores que no lo disparan, y entonces
// quien navega con teclado perdería el punto donde estaba.
function closeDetail() {
  detail.close();
  lastTrigger?.focus();
}

for (const button of detail.querySelectorAll('[data-close]')) {
  button.addEventListener('click', closeDetail);
}
detail.addEventListener('click', (event) => {
  if (event.target === detail) closeDetail();
});
// Escape cierra la ventana por su cuenta; aquí solo se recupera el foco.
detail.addEventListener('cancel', () => queueMicrotask(() => lastTrigger?.focus()));
detail.addEventListener('close', () => lastTrigger?.focus());

// --- Filtros y orden -----------------------------------------------------

function markSelection() {
  for (const chip of filters.querySelectorAll('button[data-category]')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.category === state.category));
  }
}

function selectCategory(category) {
  state.category = category;
  markSelection();
  const url = new URL(window.location.href);
  if (category) {
    url.searchParams.set('categoria', category);
  } else {
    url.searchParams.delete('categoria');
  }
  window.history.replaceState(null, '', url);
  renderEquipment();
}

filters.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-category]');
  if (chip && chip.dataset.category !== state.category) selectCategory(chip.dataset.category);
});

el('#catalog-search').addEventListener('input', (event) => {
  state.search = event.target.value;
  renderEquipment();
});

el('#catalog-order').addEventListener('input', (event) => {
  state.order = event.target.value;
  renderEquipment();
});

// --- Carga inicial -------------------------------------------------------

// Los recuentos de las categorías se calculan sobre lo que el catálogo recibe,
// de modo que nunca anuncian equipos que esta pantalla no puede mostrar.
function renderCategories() {
  const published = new Map();
  for (const item of state.equipment) {
    published.set(item.category.id, (published.get(item.category.id) ?? 0) + 1);
  }

  allChip.textContent = `Todas (${state.equipment.length})`;
  const chips = state.categories
    .filter((category) => published.has(category.id))
    .map((category) => {
      const item = document.createElement('li');
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.category = String(category.id);
      chip.setAttribute('aria-pressed', 'false');
      chip.textContent = `${category.name} (${published.get(category.id)})`;
      item.append(chip);
      return item;
    });
  filters.replaceChildren(allChip.parentElement, ...chips);
}

async function start() {
  const requested = new URL(window.location.href).searchParams.get('categoria') ?? '';
  try {
    const [categories, equipment] = await Promise.all([
      readJson('/api/categories'),
      readJson('/api/equipment'),
    ]);
    state.categories = categories.categories;
    state.equipment = equipment.equipment;
  } catch (error) {
    showStatus('error', error.message);
    return;
  }

  renderCategories();
  state.category = state.equipment.some((item) => String(item.category.id) === requested) ? requested : '';
  markSelection();
  renderEquipment();
}

await start();
