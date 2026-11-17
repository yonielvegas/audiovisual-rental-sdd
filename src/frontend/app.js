const statusElement = document.querySelector('#system-status');
const sessionArea = document.querySelector('#site-session');
const accessLink = document.querySelector('#session-access');
const userLabel = document.querySelector('#session-user');
const logoutButton = document.querySelector('#session-logout');
const inventoryLink = document.querySelector('#nav-inventory');
const reservationsLink = document.querySelector('#nav-reservations');

function showStatus(state, message) {
  statusElement.dataset.state = state;
  statusElement.textContent = message;
}

async function checkStatus() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const health = await response.json();

    if (response.ok && health.status === 'ok' && health.database === 'up') {
      showStatus('ready', 'Servidor y base de datos disponibles.');
      return;
    }

    if (response.status === 503 && health.status === 'unavailable' && health.database === 'down') {
      showStatus('unavailable', 'Servidor disponible. La base de datos no responde.');
      return;
    }
  } catch {
    // Los fallos de conexión o una respuesta ilegible usan el mismo mensaje.
  }

  showStatus('unavailable', 'No se pudo comprobar la conexión con el servidor.');
}

// El estado de sesión se consulta al cargar, de modo que el layout pueda
// servirse igual para todas las personas y el navegador no cachee un nombre.
function showSession(user) {
  const signedIn = Boolean(user);
  sessionArea.dataset.state = signedIn ? 'signed-in' : 'anonymous';
  accessLink.hidden = signedIn;
  userLabel.hidden = !signedIn;
  logoutButton.hidden = !signedIn;
  inventoryLink.hidden = !(signedIn && user.role === 'ADMIN');
  reservationsLink.hidden = !signedIn;
  userLabel.textContent = signedIn ? user.username : '';
  userLabel.title = signedIn ? `Rol ${user.role}` : '';
}

async function loadSession() {
  try {
    const response = await fetch('/api/sessions/current', { cache: 'no-store' });
    const payload = await response.json();
    showSession(response.ok ? payload.user : null);
  } catch {
    showSession(null);
  }
}

logoutButton?.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await fetch('/api/sessions/current', { method: 'DELETE', cache: 'no-store' });
  } finally {
    // Tras cerrar sesión se vuelve al inicio, porque la pantalla actual puede
    // requerir permisos que la cuenta ya no tiene.
    window.location.assign('/');
  }
});

// Las dos consultas iniciales no dependen entre sí.
await Promise.all([checkStatus(), loadSession()]);
