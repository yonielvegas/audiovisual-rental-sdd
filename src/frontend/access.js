const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const loginStatus = document.querySelector('#login-status');
const registerStatus = document.querySelector('#register-status');
const notice = document.querySelector('#access-notice');

function report(element, state, message) {
  element.dataset.state = state;
  element.textContent = message;
  element.hidden = !message;
}

// Solo se acepta un destino interno. Una ruta que empiece por `//` o que lleve
// esquema podría apuntar a otro sitio, así que se descarta.
function requestedDestination() {
  const next = new URL(window.location.href).searchParams.get('siguiente');
  return next && /^\/(?!\/)/.test(next) ? next : null;
}

async function send(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function arrive(session) {
  // El servidor decide la pantalla según el rol. Un destino pedido antes de
  // identificarse solo se respeta si la cuenta puede abrirlo.
  const requested = requestedDestination();
  const allowed = requested === '/inventario' ? session.user.role === 'ADMIN' : Boolean(requested);
  window.location.assign(allowed ? requested : session.redirect);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  report(loginStatus, 'busy', 'Comprobando las credenciales.');
  try {
    arrive(await send('/api/sessions', {
      username: data.get('username'),
      password: data.get('password'),
    }));
  } catch (error) {
    report(loginStatus, 'error', error.message);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);
  report(registerStatus, 'busy', 'Creando la cuenta.');
  try {
    arrive(await send('/api/users', {
      username: data.get('username'),
      email: data.get('email') || undefined,
      password: data.get('password'),
    }));
  } catch (error) {
    report(registerStatus, 'error', error.message);
  }
});

if (requestedDestination()) {
  report(notice, 'empty', 'Inicia sesión con una cuenta autorizada para abrir esa pantalla.');
}
