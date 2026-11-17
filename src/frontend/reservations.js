import { createSchedulePicker } from './reservation-schedule.js';

const el = (selector) => document.querySelector(selector);
const feedback = el('#reservation-status');
const availabilityForm = el('#availability-form');
const ownList = el('#own-reservations');
const dialog = el('#reservation-confirm');
const formatDate = (value) => new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const intervalLabel = ({ start, end }) => `${formatDate(start)} → ${formatDate(end)}`;
let pendingAction = null;
let lastTrigger = null;
let busy = false;
let version = 0;

function report(state, message) {
  feedback.dataset.state = state;
  feedback.textContent = message;
}

async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method, cache: 'no-store', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error?.message ?? 'No se pudo completar la solicitud. Vuelve a consultar.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function accessUrl(next) {
  return `/acceso?${new URLSearchParams({ siguiente: next })}`;
}

function showError(error) {
  report('error', error.message);
  if (error.status === 401) {
    const link = document.createElement('a');
    link.href = accessUrl(window.location.pathname + window.location.search);
    link.textContent = ' Iniciar sesión para continuar';
    feedback.append(link);
  }
}

function record(title, description, action) {
  const row = document.createElement('li');
  row.className = 'record';
  const copy = document.createElement('div');
  const heading = document.createElement('p');
  heading.className = 'record-title';
  heading.textContent = title;
  const detail = document.createElement('p');
  detail.className = 'record-meta';
  detail.textContent = description;
  copy.append(heading, detail);
  row.append(copy);
  if (action) row.append(action);
  return row;
}

function actionButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-secondary button-compact';
  button.textContent = label;
  button.addEventListener('click', () => handler(button));
  return button;
}

function confirmAction(description, trigger, action) {
  if (busy) return;
  lastTrigger = trigger;
  pendingAction = action;
  el('#confirmation-description').textContent = description;
  dialog.returnValue = 'dismiss';
  dialog.showModal();
}

dialog.addEventListener('close', async () => {
  const action = pendingAction;
  pendingAction = null;
  lastTrigger?.focus();
  if (dialog.returnValue !== 'confirm' || !action || busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('.record button')];
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await action();
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
});

function readInterval() {
  const data = new FormData(availabilityForm);
  const start = new Date(String(data.get('start')));
  const end = new Date(String(data.get('end')));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    throw new Error('Elige un inicio anterior al fin.');
  }
  if (start.getTime() <= Date.now()) throw new Error('Elige una fecha y hora de inicio posteriores al momento actual.');
  return { equipmentId: String(data.get('equipmentId')), start: start.toISOString(), end: end.toISOString() };
}

async function searchAvailability(event) {
  event.preventDefault();
  const current = ++version;
  const list = el('#available-units');
  list.replaceChildren();
  report('busy', 'Consultando unidades libres.');
  try {
    const interval = readInterval();
    window.history.replaceState(null, '', `/disponibilidad?${new URLSearchParams(interval)}`);
    const result = await api(`/api/availability?${new URLSearchParams(interval)}`);
    if (current !== version) return;
    list.replaceChildren(...result.units.map((unit) => record(
      `${unit.equipment.name} · ${unit.inventoryCode}`,
      intervalLabel(interval),
      Date.parse(interval.start) > Date.now() ? actionButton(`Reservar ${unit.inventoryCode}`, (button) => confirmAction(
        `Reservar ${unit.equipment.name}, unidad ${unit.inventoryCode}, del ${intervalLabel(interval)}.`, button,
        async () => {
          report('busy', 'Confirmando tu reserva.');
          await api('/api/reservations', 'POST', { unitId: unit.id, start: interval.start, end: interval.end });
          window.location.assign('/reservas?creada=1');
        },
      )) : null,
    )));
    report(result.units.length ? 'ready' : 'empty', result.units.length
      ? `${result.units.length} unidades disponibles. La disponibilidad se comprueba otra vez al confirmar.`
      : 'No hay unidades libres durante todo ese horario. Prueba otras fechas o elige otro equipo.');
  } catch (error) {
    if (current === version) showError(error);
  }
}

async function startAvailability() {
  const requested = new URLSearchParams(window.location.search);
  const schedule = createSchedulePicker({ form: availabilityForm, requested });
  el('#reservation-zone').textContent = `Horarios en tu zona: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`;
  availabilityForm.addEventListener('submit', searchAvailability);
  availabilityForm.addEventListener('input', () => {
    version++;
    el('#available-units').replaceChildren();
    report('empty', 'Consulta de nuevo para ver la disponibilidad del horario elegido.');
  });
  try {
    const result = await api('/api/equipment');
    const select = el('#reservation-equipment');
    const options = result.equipment.map((item) => new Option(item.name, String(item.id)));
    const requestedId = requested.get('equipmentId');
    if (requestedId && /^[1-9]\d{0,8}$/.test(requestedId) && !options.some((option) => option.value === requestedId)) {
      options.push(new Option(`Equipo #${requestedId} (consulta por enlace)`, requestedId));
    }
    select.replaceChildren(new Option('Elige un equipo', ''), ...options);
    if (options.some((option) => option.value === requestedId)) select.value = requestedId;
    select.disabled = false;
    schedule.refresh();
    report('ready', 'Elige el equipo y el intervalo para consultar.');
  } catch (error) {
    showError(error);
  }
}

async function loadOwn() {
  el('#reload-reservations').disabled = true;
  report('busy', 'Cargando tus reservas.');
  try {
    const result = await api('/api/reservations');
    ownList.replaceChildren(...result.reservations.map((reservation) => {
      const cancellable = reservation.status === 'confirmed' && Date.parse(reservation.start) > Date.now();
      const label = reservation.status === 'cancelled' ? 'Cancelada' : 'Confirmada';
      const retired = reservation.unit.active ? '' : ' · Unidad retirada del servicio';
      return record(
        `${reservation.unit.equipment.name} · ${reservation.unit.inventoryCode}`,
        `Reserva #${reservation.id} · ${intervalLabel(reservation)} · ${label}${retired}`,
        cancellable ? actionButton(`Cancelar reserva #${reservation.id}`, (button) => confirmAction(
          `Cancelar la reserva #${reservation.id} de ${reservation.unit.equipment.name}, del ${intervalLabel(reservation)}. La unidad volverá a estar disponible.`, button,
          async () => {
            await api(`/api/reservations/${reservation.id}`, 'PATCH', { status: 'cancelled' });
            if (await loadOwn()) report('ready', 'Reserva cancelada. El horario quedó libre para otra persona.');
            el('#reload-reservations').focus();
          },
        )) : null,
      );
    }));
    report('ready', result.reservations.length ? 'Estas son tus reservas, incluidas las canceladas.' : 'Todavía no tienes reservas. Consulta la disponibilidad para crear una.');
    return true;
  } catch (error) {
    ownList.replaceChildren();
    showError(error);
    return false;
  } finally {
    el('#reload-reservations').disabled = false;
  }
}

if (availabilityForm) await startAvailability();
if (ownList) {
  el('#reload-reservations').addEventListener('click', loadOwn);
  const loaded = await loadOwn();
  if (loaded && new URLSearchParams(window.location.search).get('creada')) {
    report('ready', 'Reserva confirmada. Puedes cancelarla antes de su inicio.');
    window.history.replaceState(null, '', '/reservas');
  }
}
