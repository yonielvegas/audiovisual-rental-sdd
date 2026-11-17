const minute = 60_000;
const pad = (value) => String(value).padStart(2, '0');
export const localDateTime = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const dateKey = (date) => localDateTime(date).slice(0, 10);
const fromParts = (day, hour, minutes) => new Date(`${day}T${pad(hour)}:${pad(minutes)}`);
export const hourInPeriod = (hour, period) => Number(hour) % 12 + (period === 'PM' ? 12 : 0);
export const clockTime = (date) => `${pad(date.getHours() % 12 || 12)}:${pad(date.getMinutes())} ${date.getHours() < 12 ? 'AM' : 'PM'}`;

export function minimumScheduleTime(now, start = null) {
  return new Date(Math.max(Math.floor(now.getTime() / minute) * minute + minute, start ? start.getTime() + minute : 0));
}

export function initialSchedule(requested, now = new Date()) {
  const earliest = minimumScheduleTime(now);
  const candidate = new Date(requested.get('start') ?? NaN);
  const start = Number.isFinite(candidate.getTime()) && candidate >= earliest ? candidate : earliest;
  start.setSeconds(0, 0);
  const requestedEnd = new Date(requested.get('end') ?? NaN);
  const end = Number.isFinite(requestedEnd.getTime()) && requestedEnd >= minimumScheduleTime(now, start)
    ? requestedEnd : new Date(start.getTime() + 60 * minute);
  end.setSeconds(0, 0);
  return { start, end };
}

export function createSchedulePicker({ form, requested }) {
  const el = (selector) => document.querySelector(selector);
  const state = initialSchedule(requested);
  const calendar = el('#reservation-calendar');
  const days = el('#calendar-days');
  const longDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
  let editing = 'start';
  let month = new Date(state.start.getFullYear(), state.start.getMonth(), 1);
  let trigger;
  let wasValid = true;

  const minimum = (field) => minimumScheduleTime(new Date(), field === 'end' ? state.start : null);
  const changed = () => form.dispatchEvent(new Event('input', { bubbles: true }));

  function validTime(day, hour, minutes, min) {
    const date = fromParts(day, hour, minutes);
    // También descarta horas inexistentes durante un cambio de horario local.
    return dateKey(date) === day && date.getHours() === hour && date.getMinutes() === minutes && date >= min;
  }

  function fillTimeOptions(field) {
    const selected = state[field];
    const min = minimum(field);
    const day = dateKey(selected);
    const hour = el(`#${field}-hour`);
    const minutes = el(`#${field}-minute`);
    const period = el(`#${field}-period`);
    period.value = selected.getHours() < 12 ? 'AM' : 'PM';
    if (!hour.options.length) hour.replaceChildren(...Array.from({ length: 12 }, (_, n) => new Option(pad(n + 1), String(n + 1))));
    if (!minutes.options.length) minutes.replaceChildren(...Array.from({ length: 60 }, (_, n) => new Option(pad(n), String(n))));
    for (const option of hour.options) {
      const value = hourInPeriod(option.value, period.value);
      option.disabled = !Array.from({ length: 60 }, (_, n) => n).some((n) => validTime(day, value, n, min));
    }
    for (const option of minutes.options) option.disabled = !validTime(day, selected.getHours(), Number(option.value), min);
    for (const option of period.options) {
      option.disabled = !Array.from({ length: 12 }, (_, n) => n + 1).some((h) =>
        Array.from({ length: 60 }, (_, n) => n).some((m) => validTime(day, hourInPeriod(h, option.value), m, min)));
    }
    hour.value = String(selected.getHours() % 12 || 12);
    minutes.value = String(selected.getMinutes());
  }

  function refresh() {
    for (const field of ['start', 'end']) {
      el(`#reservation-${field}`).value = localDateTime(state[field]);
      el(`#${field}-date-value`).textContent = shortDate.format(state[field]);
      fillTimeOptions(field);
      const min = minimum(field);
      const sameDay = dateKey(min) === dateKey(state[field]);
      el(`#${field}-hint`).textContent = sameDay
        ? `Disponible desde las ${clockTime(min)}.`
        : 'Elige la hora, los minutos y AM o PM.';
    }
    const valid = state.start >= minimum('start') && state.end >= minimum('end');
    el('#availability-submit').disabled = el('#reservation-equipment').disabled || !valid;
    const totalMinutes = Math.round((state.end - state.start) / minute);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const duration = [hours ? `${hours} h` : '', minutes || !hours ? `${minutes} min` : ''].filter(Boolean).join(' ');
    el('#schedule-summary').textContent = valid
      ? `Duración del alquiler: ${duration}.`
      : 'El horario de inicio ya pasó. Elige una nueva hora para consultar.';
    if (wasValid && !valid) changed();
    wasValid = valid;
  }

  function commit(field, value) {
    const min = minimum(field);
    state[field] = value < min ? min : value;
    if (field === 'start' && state.end <= state.start) state.end = new Date(state.start.getTime() + 60 * minute);
    refresh();
    changed();
  }

  function dayButton(day, minimumDay) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.date = dateKey(day);
    button.textContent = String(day.getDate());
    button.setAttribute('aria-label', longDate.format(day));
    button.setAttribute('aria-pressed', String(dateKey(day) === dateKey(state[editing])));
    button.disabled = dateKey(day) < minimumDay;
    button.tabIndex = -1;
    if (dateKey(day) === dateKey(new Date())) button.setAttribute('aria-current', 'date');
    button.addEventListener('click', () => {
      // Volver a comprobar al pulsar, por si el diálogo cruzó la medianoche.
      if (dateKey(day) < dateKey(minimum(editing))) return;
      const previous = state[editing];
      commit(editing, fromParts(dateKey(day), previous.getHours(), previous.getMinutes()));
      calendar.close();
    });
    return button;
  }

  function renderCalendar(focusDate = dateKey(state[editing]), focus = false) {
    const min = minimum(editing);
    const minimumMonth = new Date(min.getFullYear(), min.getMonth(), 1);
    if (month < minimumMonth) month = minimumMonth;
    el('#calendar-month').textContent = monthLabel.format(month);
    el('#calendar-prev').disabled = month <= minimumMonth;
    el('#calendar-today').disabled = dateKey(new Date()) < dateKey(min);
    const blanks = (month.getDay() + 6) % 7;
    const cells = Array.from({ length: blanks }, () => document.createElement('span'));
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let n = 1; n <= length; n++) cells.push(dayButton(new Date(month.getFullYear(), month.getMonth(), n), dateKey(min)));
    days.replaceChildren(...cells);
    const active = [...days.querySelectorAll('button:not(:disabled)')];
    const target = active.find((button) => button.dataset.date === focusDate) ?? active[0];
    if (target) {
      target.tabIndex = 0;
      if (focus) target.focus();
    }
  }

  function openCalendar(field, button) {
    editing = field;
    trigger = button;
    refresh();
    const selected = state[field];
    month = new Date(selected.getFullYear(), selected.getMonth(), 1);
    el('#calendar-title').textContent = field === 'start' ? 'Fecha de recogida' : 'Fecha de devolución';
    renderCalendar();
    calendar.showModal();
    days.querySelector('[tabindex="0"]')?.focus();
  }

  function keyboardDate(event) {
    const selected = event.target.closest('button[data-date]');
    if (!selected) return;
    const day = new Date(`${selected.dataset.date}T12:00`);
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(day.getDay() + 6) % 7, End: 6 - (day.getDay() + 6) % 7 };
    if (Object.hasOwn(steps, event.key)) day.setDate(day.getDate() + steps[event.key]);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const n = day.getDate();
      day.setDate(1);
      day.setMonth(day.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      day.setDate(Math.min(n, new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()));
    } else return;
    event.preventDefault();
    const min = minimum(editing);
    const target = dateKey(day) < dateKey(min) ? min : day;
    month = new Date(target.getFullYear(), target.getMonth(), 1);
    renderCalendar(dateKey(target), true);
  }

  for (const field of ['start', 'end']) {
    const button = el(`#${field}-date`);
    button.addEventListener('click', () => openCalendar(field, button));
    for (const part of ['hour', 'minute', 'period']) {
      el(`#${field}-${part}`).addEventListener('focus', refresh);
      el(`#${field}-${part}`).addEventListener('change', () => {
        const day = dateKey(state[field]);
        const hour = hourInPeriod(el(`#${field}-hour`).value, el(`#${field}-period`).value);
        const minutes = Number(el(`#${field}-minute`).value);
        commit(field, fromParts(day, hour, minutes));
      });
    }
  }
  for (const [selector, step] of [['#calendar-prev', -1], ['#calendar-next', 1]]) {
    el(selector).addEventListener('click', () => { month.setMonth(month.getMonth() + step); renderCalendar(); });
  }
  days.addEventListener('keydown', keyboardDate);
  el('#calendar-close').addEventListener('click', () => calendar.close());
  el('#calendar-today').addEventListener('click', () => {
    const min = minimum(editing);
    month = new Date(min.getFullYear(), min.getMonth(), 1);
    renderCalendar(dateKey(min), true);
  });
  calendar.addEventListener('close', () => trigger?.focus());
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  // Mantiene los límites vigentes aunque el formulario permanezca abierto.
  let timer;
  function watchClock() {
    clearTimeout(timer);
    refresh();
    if (calendar.open) {
      const focusedDate = document.activeElement.dataset.date;
      renderCalendar(focusedDate, Boolean(focusedDate));
    }
    timer = setTimeout(watchClock, minute - Date.now() % minute + 25);
  }
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', watchClock);
  watchClock();
  return { refresh };
}
