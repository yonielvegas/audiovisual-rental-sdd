const statusElement = document.querySelector('#system-status');

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

checkStatus();
