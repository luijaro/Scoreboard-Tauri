// ================================
// Guardar manualmente el token de Nightbot desde el input
function guardarNightbotTokenManual() {
  const token = document.getElementById('nightbotToken').value.trim();
  if (!token) {
    mostrarNotificacion('❌ Ingresa un token para guardar', 'error');
    return;
  }

  // También obtener client ID y secret si están presentes
  const clientId = document.getElementById('nbClientId') ? document.getElementById('nbClientId').value.trim() : '';
  const clientSecret = document.getElementById('nbClientSecret') ? document.getElementById('nbClientSecret').value.trim() : '';
  const redirectUri = document.getElementById('nbRedirectUri') ? document.getElementById('nbRedirectUri').value.trim() : 'http://localhost';

  // Guardar el token y credentials en apikey.json usando ipcRenderer
  if (window && window.__TAURI__) {
    const dataToSave = { nightbotToken: token };
    if (clientId) dataToSave.nightbotClientId = clientId;
    if (clientSecret) dataToSave.nightbotClientSecret = clientSecret;
    if (redirectUri) dataToSave.nightbotRedirectUri = redirectUri;

    window.__TAURI__.core.invoke('save-api-key', { data: dataToSave })
      .then(() => {
        mostrarNotificacion('✅ Token guardado en apikey.json', 'success');
      })
      .catch(() => {
        mostrarNotificacion('❌ Error al guardar el token', 'error');
      });
  } else {
    mostrarNotificacion('No se puede guardar el token (ipcRenderer no disponible)', 'error');
  }
}
//   Nightbot OAuth2: Generación de código (URL/curl)
// ================================
function generarNightbotAuthUrl() {
  const clientId = document.getElementById('nbClientId').value.trim();
  const redirectUri = document.getElementById('nbRedirectUri').value.trim();
  const div = document.getElementById('nbAuthUrl');
  if (!clientId || !redirectUri) {
    div.innerHTML = '<span class="text-error">Faltan datos</span>';
    return;
  }
  const url = `https://api.nightbot.tv/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=commands`;
  div.innerHTML = `<b>URL de autorización:</b> <a href="${url}" target="_blank">${url}</a>`;
}

function generarNightbotCurl() {
  const clientId = document.getElementById('nbClientId').value.trim();
  const clientSecret = document.getElementById('nbClientSecret').value.trim();
  const code = document.getElementById('nbAuthCode').value.trim();
  const redirectUri = document.getElementById('nbRedirectUri').value.trim();
  if (!clientId || !clientSecret || !code || !redirectUri) {
    document.getElementById('nbCurl').innerHTML = '<span class="text-error">Faltan datos</span>';
    return;
  }
  const curl = `curl -X POST https://api.nightbot.tv/oauth2/token \\\n  -d "client_id=${clientId}" \\\n  -d "client_secret=${clientSecret}" \\\n  -d "grant_type=authorization_code" \\\n  -d "code=${code}" \\\n  -d "redirect_uri=${redirectUri}"`;
  document.getElementById('nbCurl').innerHTML = `<b>Comando curl:</b><br><pre style="white-space:pre-wrap;">${curl}</pre>`;
}

// ================================
//   Nightbot OAuth2: Solicitud y manejo de token
// ================================
async function obtenerYGuardarNightbotToken() {
  const clientId = document.getElementById('nbClientId').value.trim();
  const clientSecret = document.getElementById('nbClientSecret').value.trim();
  const code = document.getElementById('nbAuthCode').value.trim();
  const redirectUri = document.getElementById('nbRedirectUri').value.trim();
  const msg = document.getElementById('nbJsonMsg');
  msg.textContent = '';
  if (!clientId || !clientSecret || !code || !redirectUri) {
    msg.textContent = 'Completa todos los campos.';
    msg.className = 'sb-message error';
    return;
  }
  msg.textContent = 'Solicitando token...';
  msg.className = 'sb-message';
  try {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    const res = await fetch('https://api.nightbot.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const json = await res.json();
    const nbJsonPaste = document.getElementById('nbJsonPaste');
    if (nbJsonPaste) nbJsonPaste.value = JSON.stringify(json, null, 2);
    if (json.access_token) {
      const nightbotTokenInput = document.getElementById('nightbotToken');
      if (nightbotTokenInput) nightbotTokenInput.value = json.access_token;
      // Guardar en apikey.json usando la función global para asegurar consistencia
      if (typeof guardarApiKey === 'function') {
        await guardarApiKey();
      } else if (window.electronAPI && window.electronAPI.guardarApiKey) {
        await window.electronAPI.guardarApiKey({ nightbotToken: json.access_token });
      } else if (window.__TAURI__) {
        window.__TAURI__.core.invoke('save-api-key', { data: { nightbotToken: json.access_token } });
      }
      msg.textContent = '¡Token guardado en apikey.json!';
      msg.className = 'sb-message success';
    } else {
      msg.textContent = 'Respuesta recibida, pero no se encontró access_token.';
      msg.className = 'sb-message error';
    }
  } catch (e) {
    msg.textContent = 'Error al solicitar el token: ' + e.message;
    msg.className = 'sb-message error';
  }
}

function extraerNightbotToken() {
  const txt = document.getElementById('nbJsonPaste').value.trim();
  const msg = document.getElementById('nbJsonMsg');
  msg.textContent = '';
  if (!txt) {
    msg.textContent = 'Pega el JSON de respuesta.';
    msg.className = 'sb-message error';
    return;
  }
  let obj;
  try {
    obj = JSON.parse(txt);
  } catch (e) {
    msg.textContent = 'JSON inválido.';
    msg.className = 'sb-message error';
    return;
  }
  if (!obj.access_token) {
    msg.textContent = 'No se encontró access_token.';
    msg.className = 'sb-message error';
    return;
  }
  document.getElementById('nightbotToken').value = obj.access_token;
  msg.textContent = '¡Token pegado abajo!';
  msg.className = 'sb-message success';
}
// ================================
//   NIGHTBOT: Setear comando custom
// ================================
async function setNightbotCommand() {
  const command = document.getElementById('nightbotCommand').value.trim();
  const response = document.getElementById('nightbotResponse').value.trim();
  const token = document.getElementById('nightbotToken').value.trim();
  const msg = document.getElementById('msgNightbot');
  if (!command || !response || !token) {
    msg.textContent = '❌ Faltan datos';
    return;
  }
  msg.textContent = 'Enviando...';
  try {
    // Intentar crear el comando
    let res = await fetch('https://api.nightbot.tv/1/commands', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: command,
        message: response,
        userLevel: 'everyone'
      })
    });
    let data = await res.json();
    if (res.ok) {
      msg.textContent = '✅ Comando creado en Nightbot';
      return;
    }
    // Si el error es que el comando ya existe, buscar el ID y reemplazarlo
    if (data.message && data.message.includes('already exists')) {
      msg.textContent = 'Comando ya existe, reemplazando...';
      // Buscar el comando existente
      const listRes = await fetch('https://api.nightbot.tv/1/commands', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const listData = await listRes.json();
      const found = (listData.commands || []).find(cmd => cmd.name.toLowerCase() === command.toLowerCase());
      if (found) {
        // Editar el comando existente
        const editRes = await fetch(`https://api.nightbot.tv/1/commands/${found._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: response,
            userLevel: 'everyone'
          })
        });
        const editData = await editRes.json();
        if (editRes.ok) {
          msg.textContent = '✅ Comando reemplazado en Nightbot';
        } else {
          msg.textContent = '❌ ' + (editData.message || 'Error al reemplazar el comando');
        }
      } else {
        msg.textContent = '❌ No se encontró el comando para reemplazar.';
      }
    } else {
      msg.textContent = '❌ ' + (data.message || 'Error al crear el comando');
    }
  } catch (e) {
    msg.textContent = '❌ Error: ' + e.message;
  }
}
// ================================
//   SUB-TABS TWITCH (internos)
// ================================
function showTwitchSubTab(n) {
  document.querySelectorAll('.twitch-subtab-btn').forEach((btn, i) => btn.classList.toggle('active', i === n));
  document.querySelectorAll('.twitch-subtab-panel').forEach((panel, i) => panel.classList.toggle('active', i === n));
}
let timerInterval = null;
let timerEndTimestamp = null;

// ================================
//      TEMPORIZADOR (declaraciones globales)
// ================================

// ================================
//      STREAM DECK LISTENERS
// ================================


// Escuchar comandos del Stream Deck
window.__TAURI__.event.listen('stream-deck-score-change', (event) => {
  const data = event.payload;

  console.log('[Stream Deck] Score change received:', data);
  const scoreElement = document.getElementById(data.player === 'player1' ? 'p1Score' : 'p2Score');
  if (scoreElement) {
    scoreElement.textContent = data.newScore;
    // Animar el cambio
    animateScore(scoreElement.id, data.newScore);
  }
});

window.__TAURI__.event.listen('stream-deck-reset-scores', (event) => {

  console.log('[Stream Deck] Reset scores received');
  document.getElementById('p1Score').textContent = 0;
  document.getElementById('p2Score').textContent = 0;
  // Animar ambos scores
  animateScore('p1Score', 0);
  animateScore('p2Score', 0);
});

window.__TAURI__.event.listen('stream-deck-swap-players', (event) => {

  console.log('[Stream Deck] Swap players received');
  // Ejecutar la función swap existente
  swap();
});

window.__TAURI__.event.listen('stream-deck-reset-timer', (event) => {

  console.log('[Stream Deck] Reset timer received');
  // Resetear el timer usando la función existente
  if (typeof resetearTimer === 'function') {
    resetearTimer();
  } else {
    // Fallback manual
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerEndTimestamp = null;
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
      timerDisplay.textContent = '00:00';
    }
  }
});

window.__TAURI__.event.listen('stream-deck-set-timer', (event) => {
  const data = event.payload;

  console.log('[Stream Deck] Set timer received:', data);

  // Establecer el timestamp global
  timerEndTimestamp = data.endTimestamp;

  // Limpiar cualquier timer anterior
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // Actualizar el input de minutos en la UI
  const timerInput = document.getElementById('timerInput');
  if (timerInput) {
    timerInput.value = data.minutes;
  }

  // Iniciar el countdown
  timerInterval = setInterval(() => {
    const restante = timerEndTimestamp - Date.now();
    if (restante <= 0) {
      mostrarTimer(0);
      clearInterval(timerInterval);
      const msgTimer = document.getElementById('msgTimer');
      if (msgTimer) {
        msgTimer.textContent = '⏰ ¡Tiempo finalizado!';
        setTimeout(() => msgTimer.textContent = '', 3000);
      }
    } else {
      mostrarTimer(restante);
    }
  }, 1000);

  // Mostrar inmediatamente el tiempo restante
  mostrarTimer(timerEndTimestamp - Date.now());

  // Mostrar mensaje de confirmación
  const msgTimer = document.getElementById('msgTimer');
  if (msgTimer) {
    msgTimer.textContent = `⏱️ Timer fijado a ${data.minutes} minutos`;
    setTimeout(() => msgTimer.textContent = '', 2000);
  }
});

window.__TAURI__.event.listen('stream-deck-change-game', (event) => {
  const gameCode = event.payload;

  console.log('[Stream Deck] Change game received:', gameCode);

  // Actualizar el selector de juego en la UI
  const gameSelect = document.getElementById('gameSel');
  if (gameSelect) {
    gameSelect.value = gameCode;

    // Simular el evento change para cargar personajes y actualizar la UI
    const changeEvent = new Event('change', { bubbles: true });
    gameSelect.dispatchEvent(changeEvent);
  }

  // Mostrar mensaje de confirmación
  const gameDisplay = document.getElementById('gameDisplay');
  if (gameDisplay) {
    gameDisplay.textContent = `🎮 Juego cambiado a ${gameCode}`;
    setTimeout(() => {
      if (gameDisplay.textContent.includes('🎮 Juego cambiado')) {
        gameDisplay.textContent = '';
      }
    }, 3000);
  } else {
    // Si no hay gameDisplay, usar console para confirmar
    console.log(`[Stream Deck] Game changed to ${gameCode}`);
  }

  // Guardar el cambio
  if (typeof guardarScoreboard === 'function') {
    guardarScoreboard();
  }
});

// ================================
//      MOSTRAR COMENTARISTAS EN SCOREBOARD
// ================================
function mostrarComentaristasEnScoreboard(coms) {
  const el1 = document.getElementById('comm1');
  const el2 = document.getElementById('comm2');
  if (el1 && coms && coms[0]) {
    el1.innerHTML = `<i class='fa fa-microphone'></i> ${coms[0].nombre || ''}${coms[0].twitter ? ` <span class='text-accent'>@${coms[0].twitter}</span>` : ''}`;
  } else if (el1) {
    el1.innerHTML = `<i class='fa fa-microphone'></i> Commentator #1`;
  }
  if (el2 && coms && coms[1]) {
    el2.innerHTML = `<i class='fa fa-microphone'></i> ${coms[1].nombre || ''}${coms[1].twitter ? ` <span class='text-accent'>@${coms[1].twitter}</span>` : ''}`;
  } else if (el2) {
    el2.innerHTML = `<i class='fa fa-microphone'></i> Commentator #2`;
  }
}

// ================================
//      CARGAR COMENTARISTAS AL INICIAR
// ================================
async function cargarComentaristasAlAbrir() {
  const res = await window.__TAURI__.core.invoke('load-json', { tipo: 'casters' });
  if (res.ok && res.data && res.data.comentaristas) {
    const coms = res.data.comentaristas;
    if (coms[0]) {
      document.getElementById('com1Name').value = coms[0].nombre || '';
      document.getElementById('com1Twitter').value = coms[0].twitter || '';
    }
    if (coms[1]) {
      document.getElementById('com2Name').value = coms[1].nombre || '';
      document.getElementById('com2Twitter').value = coms[1].twitter || '';
    }
    mostrarComentaristasEnScoreboard(coms);
  } else {
    // Si no hay datos, intentar cargar del scoreboard antiguo por si acaso (migración)
    const resOld = await window.__TAURI__.core.invoke('load-json', { tipo: 'scoreboard' });
    if (resOld.ok && resOld.data && resOld.data.comentaristas) {
      // Migración silenciosa: si existen en scoreboard pero no en casters, usarlos
      mostrarComentaristasEnScoreboard(resOld.data.comentaristas);
    } else {
      mostrarComentaristasEnScoreboard([]);
    }
  }
}

// Llamar al cambiar de pestaña a Comentaristas
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    if (btn.textContent.includes('Comentaristas')) {
      btn.addEventListener('click', () => {
        cargarComentaristasAlAbrir();
        cargarTimerAlAbrir();
      });
    }
  });
  // Mostrar comentaristas en Scoreboard al iniciar
  cargarComentaristasAlAbrir();
  cargarTimerAlAbrir();
});

// ================================
//      COMENTARISTAS TAB
// ================================
async function guardarComentaristas() {
  const com1 = document.getElementById('com1Name').value.trim();
  const tw1 = document.getElementById('com1Twitter').value.trim();
  const com2 = document.getElementById('com2Name').value.trim();
  const tw2 = document.getElementById('com2Twitter').value.trim();
  // Cargar casters actual para preservar otros datos si los hubiera
  const resLoad = await window.__TAURI__.core.invoke('load-json', { tipo: 'casters' });
  let data = resLoad.ok && resLoad.data ? resLoad.data : {};
  // Guardar comentaristas y twitters
  data.comentaristas = [
    { nombre: com1, twitter: tw1 },
    { nombre: com2, twitter: tw2 }
  ];
  // Guardar en casters.json
  const resSave = await window.__TAURI__.core.invoke('save-json', { data: data, tipo: 'casters' });

  // Actualizar también la vista en scoreboard
  mostrarComentaristasEnScoreboard(data.comentaristas);

  document.getElementById('msgComentaristas').textContent = resSave.ok ? 'Comentaristas guardados.' : 'Error al guardar.';
  setTimeout(() => document.getElementById('msgComentaristas').textContent = '', 2000);
}

// ================================
//         CARGA INICIAL
// ================================
let obsEscenas = [];

let ultimoTorneoMatches = null; // <-- Declaración global
window.scoreboardGameApplied = false;

(async function cargarScoreboardAlAbrir() {
  const res = await window.__TAURI__.core.invoke('load-json', { tipo: 'scoreboard' }); // Carga explícita scoreboard
  if (res.ok && res.data) {
    window.ultimoScoreboardData = res.data;
    const d = res.data;
    if (d.player1) document.getElementById('p1NameInput').value = d.player1;
    if (d.player2) document.getElementById('p2NameInput').value = d.player2;
    if (typeof d.score1 === "number") document.getElementById('p1Score').textContent = d.score1;
    if (typeof d.score2 === "number") document.getElementById('p2Score').textContent = d.score2;
    if (d.tag1) document.getElementById('p1TagInput').value = d.tag1;
    if (d.tag2) document.getElementById('p2TagInput').value = d.tag2;
    if (d.char1 && document.getElementById('p1CharSelect')) document.getElementById('p1CharSelect').value = d.char1;
    if (d.char2 && document.getElementById('p2CharSelect')) document.getElementById('p2CharSelect').value = d.char2;
    const savedGame = localStorage.getItem('scoreboard-last-game') || '';
    const gameToRestore = d.game || savedGame;
    if (gameToRestore) document.getElementById('gameSel').value = gameToRestore;
    if (d.event) document.getElementById('sbEvent').textContent = d.event;
    if (d.round) document.getElementById('sbRound').value = d.round;
    window.currentEventText = d.event || '';
    if (typeof updateVisual === "function") updateVisual();

    if (gameToRestore && typeof cambiarJuego === 'function') {
      window.scoreboardGameApplied = true;
      await cambiarJuego();
    }

    if (d.game) {
      localStorage.setItem('scoreboard-last-game', d.game);
    }

    // Cargar comentaristas SEPARADO para mostrarlos en el scoreboard
    const resCasters = await window.__TAURI__.core.invoke('load-json', { tipo: 'casters' });
    if (resCasters.ok && resCasters.data && resCasters.data.comentaristas) {
      mostrarComentaristasEnScoreboard(resCasters.data.comentaristas);
    } else if (d.comentaristas) {
      // Fallback a scoreboard antiguo si existen
      mostrarComentaristasEnScoreboard(d.comentaristas);
    }

    // RESETEAR TIMER AL ABRIR LA APP
    timerEndTimestamp = null;
    // Detener cualquier interval que pueda estar corriendo
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // Mostrar 00:00 en el display
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) timerDisplay.textContent = '00:00';

    // Guardar el JSON del timer reseteado
    await window.__TAURI__.core.invoke('save-json', { data: { timerEndTimestamp: null }, tipo: 'timestamp' });
  }
})();

// Inicializar sub-tabs cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
  // Asegurar que el primer sub-tab de Main esté visible
  showMainSubTab(0);

  // Asegurar que el primer sub-tab de Challonge esté preparado (cuando se acceda)
  // showChallongeSubTab(0); // No necesario hasta que se acceda a la pestaña
});

window.addEventListener('DOMContentLoaded', () => {
  const gameSelect = document.getElementById('gameSel');
  if (window.scoreboardGameApplied) return;

  const savedGame = localStorage.getItem('scoreboard-last-game') || '';
  if (gameSelect && !gameSelect.value && savedGame) {
    gameSelect.value = savedGame;
  }

  if (gameSelect && gameSelect.value) {
    window.scoreboardGameApplied = true;
    cambiarJuego();
  }
});

// ================================
//           TABS
// ================================
function showTab(n) {
  document.querySelectorAll('.tab-btn').forEach((btn, i) => btn.classList.toggle('active', i === n));
  document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === n));

  // Tab 0: Scoreboard
  if (n === 0) {
    // Cargar comentaristas al entrar a Scoreboard
    cargarComentaristasAlAbrir();
    cargarTimerAlAbrir();

    // Configurar listener de estilo si no está configurado
    const styleSel = document.getElementById('styleSel');
    if (styleSel && !styleSel.dataset.listener) {
      styleSel.addEventListener('change', function () {
        const val = this.value;
        if (val === 'light') {
          document.body.classList.add('light-mode');
          localStorage.setItem('scoreboard-style', 'light');
        } else {
          document.body.classList.remove('light-mode');
          localStorage.setItem('scoreboard-style', 'dark');
        }
      });
      styleSel.dataset.listener = "true";
    }
    // Aplica el modo guardado
    const saved = localStorage.getItem('scoreboard-style');
    if (saved === 'light') {
      document.body.classList.add('light-mode');
      if (styleSel) styleSel.value = 'light';
    } else {
      document.body.classList.remove('light-mode');
      if (styleSel) styleSel.value = 'dark';
    }
  }

  // Tab 1: Comentaristas
  if (n === 1) {
    cargarComentaristasAlAbrir();
    cargarTimerAlAbrir();
  }

  // Tab 2: Challonge (unified tab with sub-tabs)
  if (n === 2) {
    // Cargar funciones de Challonge al entrar
    buscarTorneosMatches(); // Para credenciales
    cargarTorneosBracket(); // Para bracket  
    cargarTorneosTop8(); // Para top8
  }

  // Tab 3: Comandos y Escenas (Twitch + OBS)
  if (n === 3) {
    // No specific loading required for Twitch commands or OBS
  }

  // Tab 4: Start.gg (was 5, now 4)
  if (n === 4) {
    if (typeof cargarStartggToken === 'function') cargarStartggToken();
  }

  // Tab 5: Configurar rutas
  if (n === 5) {
    console.log('[showTab] Entrando a pestaña de rutas, cargando rutas...');
    if (typeof cargarRutas === 'function') {
      setTimeout(cargarRutas, 100); // Pequeño delay para asegurar que la pestaña esté visible
    }
  }

  // Cambiar hojas de estilo dinámicas según la pestaña
  const styles = {
    0: ['scoreboard'],
    1: [],
    2: ['bracket', 'top8'],
    3: [],
    4: ['startgg'],
    5: []
  };

  // Desactivar todas las hojas de estilo dinámicas
  ['scoreboard', 'bracket', 'top8', 'startgg'].forEach(id => {
    const link = document.getElementById('css-' + id);
    if (link) link.disabled = true;
  });

  // Activar las de la pestaña actual
  const activeStyles = styles[n] || [];
  activeStyles.forEach(id => {
    const link = document.getElementById('css-' + id);
    if (link) link.disabled = false;
  });
}

// ================================
//           SUB-TABS DE MAIN
// ================================
function showMainSubTab(n) {
  console.log('showMainSubTab called with:', n);

  // Solo afectar los botones y paneles dentro de #tab-main
  const mainTab = document.getElementById('tab-main');
  if (!mainTab) {
    console.error('tab-main not found');
    return;
  }

  const buttons = mainTab.querySelectorAll('.sub-tab-btn');
  const panels = mainTab.querySelectorAll('.sub-tab-panel');

  console.log('Found buttons:', buttons.length, 'panels:', panels.length);

  buttons.forEach((btn, i) => btn.classList.toggle('active', i === n));
  panels.forEach((p, i) => p.classList.toggle('active', i === n));

  // Cargar datos específicos según el sub-tab
  if (n === 0) {
    // Scoreboard - ya se carga automáticamente
  } else if (n === 1) {
    // Comentaristas
    cargarComentaristasAlAbrir();
    cargarTimerAlAbrir();
  } else if (n === 2) {
    // Comandos Twitch - no requiere carga especial
  } else if (n === 3) {
    // OBS - no requiere carga especial
  }
}

// ================================
//           SUB-TABS DE CHALLONGE
// ================================
function showChallongeSubTab(n) {
  console.log('showChallongeSubTab called with:', n);

  // Solo afectar los botones y paneles dentro de #tab-challonge
  const challongeTab = document.getElementById('tab-challonge');
  if (!challongeTab) {
    console.error('tab-challonge not found');
    return;
  }

  const buttons = challongeTab.querySelectorAll('.sub-tab-btn');
  const panels = challongeTab.querySelectorAll('.sub-tab-panel');

  console.log('Found buttons:', buttons.length, 'panels:', panels.length);

  buttons.forEach((btn, i) => btn.classList.toggle('active', i === n));
  panels.forEach((p, i) => p.classList.toggle('active', i === n));

  // Cargar datos específicos según el sub-tab
  if (n === 0) {
    // Credenciales - ya se carga automáticamente
    buscarTorneosMatches();
  } else if (n === 1) {
    // Bracket
    cargarTorneosBracket();
  } else if (n === 2) {
    // Top 8
    cargarTorneosTop8();
  }
}

// ================================
//           TWITCH BOT
// ================================
let ultimoSlugBracket = '';
let twitchClient = null;

async function conectarTwitchBot() {
  const username = document.getElementById('twitchUser').value.trim();
  const oauth = document.getElementById('twitchOAuth').value.trim();
  const channel = document.getElementById('twitchChannel').value.trim();
  if (!username || !oauth || !channel) {
    document.getElementById('msgTwitch').textContent = "❌ Faltan datos";
    return;
  }
  
  if (twitchClient) {
    twitchClient.disconnect();
  }
  
  twitchClient = new tmi.Client({
    options: { debug: false },
    identity: {
      username: username,
      password: oauth.startsWith('oauth:') ? oauth : `oauth:${oauth}`
    },
    channels: [channel]
  });
  
  try {
    await twitchClient.connect();
    document.getElementById('msgTwitch').textContent = "✅ Conectado a Twitch";
  } catch (e) {
    document.getElementById('msgTwitch').textContent = "❌ " + e.toString();
  }
}

async function enviarBracketBot() {
  if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
    document.getElementById('msgTwitch').textContent = "❌ No conectado a Twitch";
    return;
  }
  const channel = document.getElementById('twitchChannel').value.trim();
  try {
    await twitchClient.say(channel, '!bracket');
    document.getElementById('msgTwitch').textContent = "✅ !bracket enviado";
  } catch(e) {
    document.getElementById('msgTwitch').textContent = "❌ " + e.toString();
  }
}

async function enviarComandoBot(cmd) {
  if (!cmd) return;
  if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
    document.getElementById('msgTwitch').textContent = "❌ No conectado a Twitch";
    return;
  }
  const channel = document.getElementById('twitchChannel').value.trim();
  try {
    await twitchClient.say(channel, cmd);
    document.getElementById('msgTwitch').textContent = `✅ "${cmd}" enviado`;
  } catch(e) {
    document.getElementById('msgTwitch').textContent = "❌ " + e.toString();
  }
}

// ================================
//          SCOREBOARD
// ================================

// Listeners para los campos integrados en el marcador principal
['p1NameInput', 'p1TagInput', 'p2NameInput', 'p2TagInput', 'p1CharSelect', 'p2CharSelect'].forEach(id => {
  const el = document.getElementById(id) || document.getElementById(id.replace('Select', ''));
  if (el) {
    el.addEventListener('input', updateVisual);
    el.addEventListener('change', updateVisual);
  }
});

// Agregar listener de auto-guardado para el campo round
document.addEventListener('DOMContentLoaded', function () {
  const sbRoundElement = document.getElementById('sbRound');
  if (sbRoundElement) {
    sbRoundElement.addEventListener('input', function () {
      // Auto-guardar datos después de un delay para evitar muchas escrituras
      clearTimeout(window.roundSaveTimeout);
      window.roundSaveTimeout = setTimeout(async () => {
        const data = getScoreboardData();
        await window.__TAURI__.core.invoke('save-json', { data: data, tipo: 'scoreboard' });
      }, 1000); // Guardar 1 segundo después de que el usuario termine de escribir
    });
  }
});

function updateVisual() {
  // Actualizar tag debajo del score
  const p1TagInput = document.getElementById('p1TagInput');
  const p2TagInput = document.getElementById('p2TagInput');
  const p1TagValue = p1TagInput ? p1TagInput.value : '';
  const p2TagValue = p2TagInput ? p2TagInput.value : '';
  
  const p1TagDisplay = document.getElementById('p1TagDisplay');
  const p2TagDisplay = document.getElementById('p2TagDisplay');
  if (p1TagDisplay) p1TagDisplay.textContent = p1TagValue;
  if (p2TagDisplay) p2TagDisplay.textContent = p2TagValue;

  // Actualizar fila de tags y nombres debajo del score
  const tag1 = p1TagInput ? p1TagInput.value : '';
  const tag2 = p2TagInput ? p2TagInput.value : '';
  const p1NameInput = document.getElementById('p1NameInput');
  const p2NameInput = document.getElementById('p2NameInput');
  const name1 = p1NameInput ? p1NameInput.value : '';
  const name2 = p2NameInput ? p2NameInput.value : '';
  if (document.getElementById('sbTagName1')) document.getElementById('sbTagName1').textContent = tag1 || '';
  if (document.getElementById('sbTagName2')) document.getElementById('sbTagName2').textContent = tag2 || '';
  if (document.getElementById('sbPlayerName1')) document.getElementById('sbPlayerName1').textContent = name1 || 'Player1';
  if (document.getElementById('sbPlayerName2')) document.getElementById('sbPlayerName2').textContent = name2 || 'Player2';
  // Banderas removidas del UI; no actualizar
  // Actualizar personaje visual
  const p1Char = document.getElementById('p1CharSelect') ? document.getElementById('p1CharSelect').value : '';
  const p2Char = document.getElementById('p2CharSelect') ? document.getElementById('p2CharSelect').value : '';
  if (window.imgPersonajes) {
    const p1Img = imgPersonajes[p1Char];
    const p2Img = imgPersonajes[p2Char];
    if (document.getElementById('p1CharImg')) {
      document.getElementById('p1CharImg').src = p1Img ? (p1Img.startsWith('http') ? p1Img : window.__TAURI__.core.convertFileSrc(p1Img)) : '';
    }
    if (document.getElementById('p2CharImg')) {
      document.getElementById('p2CharImg').src = p2Img ? (p2Img.startsWith('http') ? p2Img : window.__TAURI__.core.convertFileSrc(p2Img)) : '';
    }
  }
}

function changeScore(player, delta) {
  const id = player === 1 ? 'p1Score' : 'p2Score';
  let score = parseInt(document.getElementById(id).textContent) || 0;
  score = Math.max(0, score + delta);
  animateScore(id, score);
}

function swap() {
  let p1Name = document.getElementById('p1NameInput').value;
  let p2Name = document.getElementById('p2NameInput').value;
  let p1Tag = document.getElementById('p1TagInput').value;
  let p2Tag = document.getElementById('p2TagInput').value;
  let p1Score = document.getElementById('p1Score').textContent;
  let p2Score = document.getElementById('p2Score').textContent;
  let p1Char = document.getElementById('p1CharSelect') ? document.getElementById('p1CharSelect').value : '';
  let p2Char = document.getElementById('p2CharSelect') ? document.getElementById('p2CharSelect').value : '';

  // Capturar lunas actuales
  let p1Moon = document.getElementById('p1MoonSelect') ? document.getElementById('p1MoonSelect').value : '';
  let p2Moon = document.getElementById('p2MoonSelect') ? document.getElementById('p2MoonSelect').value : '';

  // Intercambiar valores básicos
  document.getElementById('p1NameInput').value = p2Name;
  document.getElementById('p2NameInput').value = p1Name;
  document.getElementById('p1TagInput').value = p2Tag;
  document.getElementById('p2TagInput').value = p1Tag;
  document.getElementById('p1Score').textContent = p2Score;
  document.getElementById('p2Score').textContent = p1Score;

  // Intercambiar personajes
  if (document.getElementById('p1CharSelect') && document.getElementById('p2CharSelect')) {
    document.getElementById('p1CharSelect').value = p2Char;
    document.getElementById('p2CharSelect').value = p1Char;
  }

  // Intercambiar lunas si existen
  if (document.getElementById('p1MoonSelect') && document.getElementById('p2MoonSelect')) {
    document.getElementById('p1MoonSelect').value = p2Moon;
    document.getElementById('p2MoonSelect').value = p1Moon;
  }

  updateVisual();
}

function resetScores() {
  document.getElementById('p1Score').textContent = 0;
  document.getElementById('p2Score').textContent = 0;
}

function getScoreboardData() {
  // NOTA: Comentaristas y Temporizador se han movido a casters.json y timestamp.json
  // Esta función ahora solo retorna datos del scoreboard puro.

  const game = document.getElementById('gameSel').value;
  const round = document.getElementById('sbRound').value;

  // Mapeo de códigos de juego a nombres completos
  const gameNames = {
    'UNI2': 'Under Night In-Birth II [Sys:Celes]',
    'VSAV': 'Vampire Savior (Darkstalkers 3)',
    'BBCF': 'BlazBlue: Central Fiction',
    'COTW': 'Fatal Fury: City of the Wolves',
    'GBVSR': 'Granblue Fantasy Versus: Rising',
    'GGST': 'Guilty Gear -Strive-',
    'HFTF': 'JoJo: Heritage for the Future',
    'MBAACC': 'Melty Blood: Actress Again Current Code',
    'MBTL': 'Melty Blood: Type Lumina',
    'SCON4': 'Super Naruto: Clash of Ninja 4',
    'SF3': 'Street Fighter III: 3rd Strike',
    'SF6': 'Street Fighter 6',
    'T8': 'Tekken 8'
  };

  // Obtener nombre completo del juego
  const gameName = gameNames[game] || game;

  // Generar event como "nombre del juego - ronda"
  const eventText = document.getElementById('sbEvent') ? document.getElementById('sbEvent').textContent.trim() : '';
  const event = eventText || (round ? `${gameName} - ${round}` : gameName);

  if (document.getElementById('sbEvent')) {
    document.getElementById('sbEvent').textContent = event;
  }

  return {
    player1: document.getElementById('p1NameInput').value,
    player2: document.getElementById('p2NameInput').value,
    score1: Number(document.getElementById('p1Score').textContent),
    score2: Number(document.getElementById('p2Score').textContent),
    tag1: document.getElementById('p1TagInput').value,
    tag2: document.getElementById('p2TagInput').value,
    char1: document.getElementById('p1CharSelect')?.value || '',
    char2: document.getElementById('p2CharSelect')?.value || '',
    moon1: game === 'MBAACC' ? (document.getElementById('p1MoonSelect')?.value || '') : '',
    moon2: game === 'MBAACC' ? (document.getElementById('p2MoonSelect')?.value || '') : '',
    game: game,
    gameName: gameName,
    event: event,
    round: round,
    fase_original: window.currentFaseOriginal || '',
    country1: document.getElementById('p1FlagSelect') ? document.getElementById('p1FlagSelect').value : '',
    country2: document.getElementById('p2FlagSelect') ? document.getElementById('p2FlagSelect').value : '',
    // temporizador: temporizador, // Eliminado
    // comentaristas: comentaristas // Eliminado
  };
}


async function guardarScoreboard() {
  console.log('[GuardarScoreboard] Iniciando guardado manual...');
  console.log('[GuardarScoreboard] Comentaristas actuales en window.ultimoScoreboardData:', window.ultimoScoreboardData?.comentaristas);

  // Si no hay comentaristas preservados de Start.gg y hay datos previos, preservarlos
  if (!window.comentaristasPreservados && window.ultimoScoreboardData && window.ultimoScoreboardData.comentaristas) {
    console.log('[GuardarScoreboard] Preservando comentaristas existentes para el guardado manual');
    window.comentaristasPreservados = [...window.ultimoScoreboardData.comentaristas];
  }

  const data = getScoreboardData();
  console.log('[GuardarScoreboard] Datos a guardar:', data);

  const res = await window.__TAURI__.core.invoke('save-json', { data: data, tipo: 'scoreboard' });
  if (res.ok) {
    // Actualizar los datos después del guardado exitoso
    window.ultimoScoreboardData = data;
    mostrarNotificacion('✅ ¡Guardado!', 'success');
  } else {
    mostrarNotificacion('❌ Error al guardar', 'error');
  }
}

async function abrirOutput() {
  await window.__TAURI__.core.invoke('open-folder');
}
// ================================
//          EFECTOS
// ================================
function animateScore(id, newScore) {
  const el = document.getElementById(id);
  el.textContent = newScore;
  el.classList.remove('animated');
  void el.offsetWidth; // Forzar reflow para reiniciar animación
  el.classList.add('animated');
}

// ================================
//          PERSONAJES
// ================================
let listaPersonajes = [];
let imgPersonajes = {};
window.imgPersonajes = imgPersonajes;

async function cambiarJuego() {
  const juegoFolder = document.getElementById('gameSel').value;
  const selectedChars = {
    p1Char: document.getElementById('p1CharSelect') ? document.getElementById('p1CharSelect').value : '',
    p2Char: document.getElementById('p2CharSelect') ? document.getElementById('p2CharSelect').value : '',
  };
  const selectedTop8Chars = [];
  for (let i = 0; i < 8; ++i) {
    const el = document.getElementById('top8char' + i);
    selectedTop8Chars[i] = el ? el.value : '';
  }

  localStorage.setItem('scoreboard-last-game', juegoFolder);

  // Mostrar/ocultar selectores de Moon para MBAACC
  if (typeof toggleMoonSelectors === 'function') {
    toggleMoonSelectors();
  }

  const res = await window.__TAURI__.core.invoke('get-personajes', { juegoFolder });

  if (res.personajes && res.personajes.length) {
    listaPersonajes = res.personajes.map(p => p.nombre);
    imgPersonajes = {};
    window.imgPersonajes = imgPersonajes;
    res.personajes.forEach(p => { imgPersonajes[p.nombre] = window.__TAURI__.core.convertFileSrc(p.imagen); });
    llenarSelectPersonajes('p1CharSelect');
    llenarSelectPersonajes('p2CharSelect');
    for (let i = 0; i < 8; ++i) llenarSelectPersonajes('top8char' + i);
    if (document.getElementById('p1CharSelect')) document.getElementById('p1CharSelect').value = selectedChars.p1Char;
    if (document.getElementById('p2CharSelect')) document.getElementById('p2CharSelect').value = selectedChars.p2Char;
    for (let i = 0; i < 8; ++i) {
      const select = document.getElementById('top8char' + i);
      if (select) select.value = selectedTop8Chars[i];
    }
    updateVisual();
  } else {
    listaPersonajes = [];
    imgPersonajes = {};
    window.imgPersonajes = imgPersonajes;
    llenarSelectPersonajes('p1CharSelect');
    llenarSelectPersonajes('p2CharSelect');
    for (let i = 0; i < 8; ++i) llenarSelectPersonajes('top8char' + i);
    if (document.getElementById('p1CharSelect')) document.getElementById('p1CharSelect').value = selectedChars.p1Char;
    if (document.getElementById('p2CharSelect')) document.getElementById('p2CharSelect').value = selectedChars.p2Char;
    for (let i = 0; i < 8; ++i) {
      const select = document.getElementById('top8char' + i);
      if (select) select.value = selectedTop8Chars[i];
    }
    updateVisual();
  }
}

function llenarSelectPersonajes(id) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = listaPersonajes.map(
    char => `<option value="${char}">${char}</option>`
  ).join('');
}

// ================================
//              TOP 8
// ================================
async function cargarTop8() {
  const slug = document.getElementById('tournamentTop8').value.trim();
  const msg = document.getElementById('msgTop8');
  if (!slug) {
    msg.textContent = "❌ Selecciona un torneo.";
    return;
  }
  msg.textContent = "Cargando...";
  const r = await window.__TAURI__.core.invoke('get-top8', { slug });
  if (r.error || !r.top8) {
    msg.textContent = r.error || "No se pudo obtener el top 8.";
    document.getElementById('top8Table').innerHTML = "";
    return;
  }
  msg.textContent = "Top 8 cargado.";
  const tbody = document.getElementById('top8Table');
  tbody.innerHTML = "";
  r.top8.forEach((p, idx) => {
    tbody.innerHTML += `
      <tr>
        <td style="padding:0.5em 1em;">${p.final_rank}</td>
        <td style="padding:0.5em 1em;">${p.name}</td>
        <td style="padding:0.5em 1em;">
          <select class="sb-dropdown" id="top8char${idx}" onchange="sincronizarCambioTop8('char', ${idx}, this.value)">
            ${listaPersonajes.map(char => `<option value="${char}">${char}</option>`).join("")}
          </select>
        </td>
        <td style="padding:0.5em 1em;">
          <select class="sb-dropdown" id="top8twitter${idx}" onchange="sincronizarCambioTop8('twitter', ${idx}, this.value)"></select>
        </td>
      </tr>
    `;
  });

  // ¡Aquí!
  await llenarUsuariosTop8DesdeTxt();

  // --- Obtén el nombre del torneo desde Challonge y guárdalo globalmente ---
  const titleRes = await window.__TAURI__.core.invoke('get-tournament-title', { slug });
  const nombreTorneo = titleRes.title || slug;
  window.nombreTorneoActual = nombreTorneo;
  // mostrarMensajeTop8(nombreTorneo, r.top8); // <-- comenta o elimina esta línea

  setTimeout(() => msg.textContent = '', 2500);
}




async function guardarTop8() {
  const tbody = document.getElementById('top8Table');
  if (!tbody.children.length) return;
  const top8Data = [];
  const juego = document.getElementById('gameSel').value;

  const nombreTorneo = window.nombreTorneoActual || "Torneo sin nombre";
  const fechaInput = document.getElementById('fechaTop8');
  if (fechaInput && !fechaInput.value) {
    const hoy = new Date();
    fechaInput.value = hoy.toISOString().slice(0, 10); // yyyy-mm-dd
  }
  const fecha = fechaInput && fechaInput.value ? fechaInput.value : new Date().toLocaleDateString('es-CL');

  for (let i = 0; i < tbody.children.length; ++i) {
    const jugador = tbody.children[i].children[1].textContent;
    const personaje = document.getElementById('top8char' + i).value;
    const twitter = document.getElementById('top8twitter' + i).value; // <-- ahora es select
    top8Data.push({ nombre: jugador, personaje, juego, twitter });
  }

  const dataToSave = {
    evento: nombreTorneo,
    fecha: fecha,
    top8: top8Data
  };

  const res = await window.__TAURI__.core.invoke('save-json', {
    data: dataToSave,
    tipo: 'top8'
  });
  if (res.ok) {
    mostrarNotificacion("✅ Top 8 guardado.", "success");
  } else {
    mostrarNotificacion("❌ Error al guardar", "error");
  }
}

// ================================
//         CHALLONGE TAB
// ================================
async function guardarApiKey() {
  const apiKey = document.getElementById('apikey').value.trim();
  const twitchOAuth = document.getElementById('twitchOAuth') ? document.getElementById('twitchOAuth').value.trim() : "";
  const twitchUser = document.getElementById('twitchUser') ? document.getElementById('twitchUser').value.trim() : "";
  const twitchChannel = document.getElementById('twitchChannel') ? document.getElementById('twitchChannel').value.trim() : "";
  if (!apiKey) {
    mostrarNotificacion("API Key vacía", "error");
    return;
  }
  const nightbotToken = document.getElementById('nightbotToken') ? document.getElementById('nightbotToken').value.trim() : '';
  const nightbotClientId = document.getElementById('nbClientId') ? document.getElementById('nbClientId').value.trim() : '';
  const nightbotClientSecret = document.getElementById('nbClientSecret') ? document.getElementById('nbClientSecret').value.trim() : '';
  const nightbotRedirectUri = document.getElementById('nbRedirectUri') ? document.getElementById('nbRedirectUri').value.trim() : 'http://localhost';
  await window.__TAURI__.core.invoke('save-api-key', { data: { apiKey, twitchOAuth, twitchUser, twitchChannel, nightbotToken, nightbotClientId, nightbotClientSecret, nightbotRedirectUri } });
  mostrarNotificacion("Datos guardados.", "success");
}

(async function cargarCredencialesAlIniciar() {
  const res = await window.__TAURI__.core.invoke('load-api-key');
  if (res.ok && res.data) {
    const d = res.data;
    if ('apiKey' in d && document.getElementById('apikey'))
      document.getElementById('apikey').value = d.apiKey;
    if ('twitchOAuth' in d && document.getElementById('twitchOAuth'))
      document.getElementById('twitchOAuth').value = d.twitchOAuth;
    if ('twitchUser' in d && document.getElementById('twitchUser'))
      document.getElementById('twitchUser').value = d.twitchUser;
    if ('twitchChannel' in d && document.getElementById('twitchChannel'))
      document.getElementById('twitchChannel').value = d.twitchChannel;
    if ('nightbotToken' in d && document.getElementById('nightbotToken'))
      document.getElementById('nightbotToken').value = d.nightbotToken;
    if ('nightbotClientId' in d && document.getElementById('nbClientId'))
      document.getElementById('nbClientId').value = d.nightbotClientId;
    if ('nightbotClientSecret' in d && document.getElementById('nbClientSecret'))
      document.getElementById('nbClientSecret').value = d.nightbotClientSecret;
    if ('nightbotRedirectUri' in d && document.getElementById('nbRedirectUri'))
      document.getElementById('nbRedirectUri').value = d.nightbotRedirectUri;
  }
})();

async function cargarJugadoresChallonge() {
  const slug = document.getElementById('slugChallonge').value.trim();
  if (!slug) return;
  document.getElementById('msgChallonge').textContent = "Consultando...";
  const r = await window.__TAURI__.core.invoke('get-participants', { slug });
  if (r.error) {
    mostrarNotificacion(r.error, "error");
    return;
  }
  let opts = '<option value="">Selecciona jugador</option>';
  (r.participants || []).forEach(p => {
    opts += `<option value="${p.name}">${p.name}</option>`;
  });
  document.getElementById('jugadoresChallonge').innerHTML = opts;
  document.getElementById('msgChallonge').textContent = "Jugadores cargados.";
  setTimeout(() => document.getElementById('msgChallonge').textContent = "", 2000);
}

function ponerJugador1() {
  const name = document.getElementById('jugadoresChallonge').value;
  if (name) document.getElementById('p1NameInput').value = name;
  updateVisual();
}

function ponerJugador2() {
  const name = document.getElementById('jugadoresChallonge').value;
  if (name) document.getElementById('p2NameInput').value = name;
  updateVisual();
}

// ================================
//          BRACKET
// ================================
function mostrarBracket() {
  const slug = document.getElementById('tournamentBracket').value.trim();
  const iframe = document.getElementById('challongeBracket');
  if (!iframe) return; // <-- Evita el error si no existe
  if (!slug) {
    iframe.src = '';
    return;
  }
  iframe.src = `https://challonge.com/${slug}/module?theme=2&show_standings=1&show_tournament_name=1`;
}

// ================================
//          MATCHES
// ================================
let matchesCargados = [];
let tournamentParticipantsCount = 0;

// Hacer accesible globalmente para el widget
window.tournamentParticipantsCount = 0;

// Calcular estructura teórica del torneo basada en número de participantes
function calcularEstructuraTorneo(numParticipants) {
  if (!numParticipants || numParticipants < 2) {
    return { maxWinners: 1, minLosers: -1, maxLosers: -1 };
  }

  // En un torneo de doble eliminación:
  // Winners: ceil(log2(N)) rondas - funciona para cualquier N (con byes si no es potencia de 2)
  const winnersRounds = Math.ceil(Math.log2(numParticipants));

  // Losers: (2 × Winners) - 2 rondas
  // Esta fórmula funciona para cualquier número de participantes
  // Ejemplos con potencias de 2: 8p→3W,4L | 16p→4W,6L | 32p→5W,8L | 64p→6W,10L
  // Ejemplos con otros números: 13p→4W,6L | 24p→5W,8L | 50p→6W,10L
  const losersRounds = Math.max(1, (winnersRounds * 2) - 2);

  const result = {
    maxWinners: winnersRounds,
    minLosers: -losersRounds,
    maxLosers: -1
  };

  console.log(`📊 Estructura calculada para ${numParticipants} participantes:`);
  console.log(`   Winners=${winnersRounds}, Losers=${losersRounds}`);
  console.log(`   Objeto retornado:`, JSON.stringify(result));

  return result;
}

function nombreDeRonda(round, roundsInfo) {
  // roundsInfo: { maxWinners: N, minLosers: -N, maxLosers: -1 }
  console.log(`\n🔄 nombreDeRonda llamado con round=${round}, roundsInfo=`, JSON.stringify(roundsInfo));

  if (round > 0) {
    // Winners Bracket
    // Determinar cuántas rondas hay en total en el Winners Bracket
    const totalWinnersRounds = roundsInfo.maxWinners;

    console.log(`🏆 Winners Bracket - Round ${round}:`);
    console.log(`  - Total rondas en Winners: ${totalWinnersRounds}`);
    console.log(`  - maxWinners: ${roundsInfo.maxWinners}`);
    console.log(`  - typeof maxWinners: ${typeof roundsInfo.maxWinners}`);
    console.log(`  - totalWinnersRounds === 3? ${totalWinnersRounds === 3}`);
    console.log(`  - totalWinnersRounds === 2? ${totalWinnersRounds === 2}`);

    // En torneos de doble eliminación, la lógica típica es:
    // - Si hay 1 ronda: debe ser Winners Final
    // - Si hay 2 rondas: ronda 2 = Winners Final, ronda 1 = Winners Semis  
    // - Si hay 3 rondas: ronda 3 = Winners Final, ronda 2 = Winners Semis, ronda 1 = Winners Quarters
    // - Si hay 4+ rondas: usar la lógica original

    if (totalWinnersRounds === 1) {
      console.log(`  → Solo 1 ronda en Winners: Round ${round} = Winners Final`);
      return "Winners Final";
    } else if (totalWinnersRounds === 2) {
      console.log(`  → 2 rondas en Winners: Round ${round} = ${round === 2 ? 'Winners Final' : 'Winners Semis'}`);
      if (round === 2) return "Winners Final";
      if (round === 1) return "Winners Semis";
    } else if (totalWinnersRounds === 3) {
      console.log(`  → 3 rondas en Winners: Round ${round} = ${round === 3 ? 'Winners Final' : round === 2 ? 'Winners Semis' : 'Winners Quarters'}`);
      if (round === 3) {
        console.log(`✅ RETORNANDO: "Winners Final"`);
        return "Winners Final";
      }
      if (round === 2) {
        console.log(`✅ RETORNANDO: "Winners Semis"`);
        return "Winners Semis";
      }
      if (round === 1) {
        console.log(`✅ RETORNANDO: "Winners Quarters"`);
        return "Winners Quarters";
      }
    } else {
      console.log(`  → ${totalWinnersRounds} rondas en Winners, usando lógica original`);
      // Lógica original para torneos más grandes
      if (round === roundsInfo.maxWinners) {
        console.log(`✅ RETORNANDO: "Winners Final"`);
        return "Winners Final";
      }
      if (round === roundsInfo.maxWinners - 1) {
        console.log(`✅ RETORNANDO: "Winners Semis"`);
        return "Winners Semis";
      }
      if (round === roundsInfo.maxWinners - 2) {
        console.log(`✅ RETORNANDO: "Winners Quarters"`);
        return "Winners Quarters";
      }
      if (round === roundsInfo.maxWinners - 3) {
        console.log(`✅ RETORNANDO: "Winners Round 1"`);
        return "Winners Round 1";
      }
      if (round === 1) {
        console.log(`✅ RETORNANDO: "Winners Round 1"`);
        return "Winners Round 1";
      }
      console.log(`✅ RETORNANDO: "Winners Round ${round}"`);
      return `Winners Round ${round}`;
    }
  }

  if (round < 0) {
    // Losers Bracket - mientras más negativo, mejor ronda
    // Con la estructura completa del torneo, podemos usar la lógica correcta
    console.log(`🎯 Losers Bracket - Round ${round}:`);
    console.log(`  - minLosers: ${roundsInfo.minLosers}, maxLosers: ${roundsInfo.maxLosers}`);
    console.log(`  - Comparaciones: round=${round}, minLosers=${roundsInfo.minLosers}, +1=${roundsInfo.minLosers + 1}, +2=${roundsInfo.minLosers + 2}`);

    if (round === roundsInfo.minLosers) {
      console.log(`✅ RETORNANDO: "Losers Final"`);
      return "Losers Final";
    }
    if (round === roundsInfo.minLosers + 1) {
      console.log(`✅ RETORNANDO: "Losers Semis"`);
      return "Losers Semis";
    }
    if (round === roundsInfo.minLosers + 2) {
      console.log(`✅ RETORNANDO: "Losers Quarters"`);
      return "Losers Quarters";
    }

    // Para rondas tempranas del losers bracket
    const roundsFromStart = Math.abs(round);
    console.log(`✅ RETORNANDO: "Losers Round ${roundsFromStart}"`);
    return `Losers Round ${roundsFromStart}`;
  }

  if (round === 0) {
    console.log(`✅ RETORNANDO: "Grand Finals"`);
    return "Grand Finals";
  }

  console.log(`✅ RETORNANDO (fallback): "Round ${round}"`);
  return `Round ${round}`;
}


async function cargarMatches() {
  const tournamentList = document.getElementById('tournamentList');
  if (tournamentList) {
    await cargarMatchesChallonge(tournamentList.value);
  }
}

function mostrarMatchEnScoreboard() {
  const select = document.getElementById('selectMatch');
  const matchId = select.value;
  const match = matchesCargados.find(m => String(m.id) === String(matchId));
  if (!match) return;

  // Determinar el nombre de la ronda/evento
  let roundName = "";

  if (match.group_name) {
    // Es un match de grupos
    roundName = match.group_name;
  } else if (match.round !== undefined && match.round !== null) {
    // Es un match de eliminatorias con información de ronda
    // Calcular estructura basada en participantes (más preciso que contar matches existentes)
    let roundsInfo;
    if (tournamentParticipantsCount > 0) {
      roundsInfo = calcularEstructuraTorneo(tournamentParticipantsCount);
      console.log(`🔍 Debug rondas para match ${match.id} (basado en ${tournamentParticipantsCount} participantes):`);
    } else {
      // Fallback: usar matches existentes si no hay info de participantes
      const allWinnerRounds = matchesCargados
        .filter(m => m.round !== undefined && m.round !== null && m.round > 0)
        .map(m => m.round);
      const allLoserRounds = matchesCargados
        .filter(m => m.round !== undefined && m.round !== null && m.round < 0)
        .map(m => m.round);

      const maxWinners = allWinnerRounds.length ? Math.max(...allWinnerRounds) : 1;
      const minLosers = allLoserRounds.length ? Math.min(...allLoserRounds) : -1;
      const maxLosers = allLoserRounds.length ? Math.max(...allLoserRounds) : -1;

      roundsInfo = { maxWinners, minLosers, maxLosers };
      console.log(`🔍 Debug rondas para match ${match.id} (contando matches existentes):`);
    }

    console.log(`  - Round actual: ${match.round}`);
    console.log(`  - Participantes del torneo: ${tournamentParticipantsCount}`);
    console.log(`  - Estructura calculada - maxWinners: ${roundsInfo.maxWinners}, minLosers: ${roundsInfo.minLosers}, maxLosers: ${roundsInfo.maxLosers}`);
    roundName = nombreDeRonda(match.round, roundsInfo);

    console.log(`  - Nombre de ronda calculado: "${roundName}"`);
  } else {
    // Match sin información específica de ronda
    roundName = `Match #${match.id}`;
  }

  document.getElementById('sbEvent').value = roundName;
  window.currentRoundName = roundName;

  // --- NUEVO: Separar tag y nombre si corresponde ---
  function splitTagAndName(fullName) {
    if (typeof fullName === "string" && fullName.includes(" | ")) {
      const [tag, ...rest] = fullName.split(" | ");
      return { tag: tag.trim(), name: rest.join(" | ").trim() };
    }
    return { tag: "", name: fullName };
  }

  // Jugador 1
  const p1 = splitTagAndName(match.player1_name);
  document.getElementById('p1NameInput').value = p1.name;
  document.getElementById('p1TagInput').value = p1.tag;

  // Jugador 2
  const p2 = splitTagAndName(match.player2_name);
  document.getElementById('p2NameInput').value = p2.name;
  document.getElementById('p2TagInput').value = p2.tag;

  if (match.scores_csv) {
    const parts = match.scores_csv.split('-');
    if (parts.length === 2) {
      document.getElementById('p1Score').textContent = parts[0].trim();
      document.getElementById('p2Score').textContent = parts[1].trim();
    }
  } else {
    document.getElementById('p1Score').textContent = "0";
    document.getElementById('p2Score').textContent = "0";
  }
  if (typeof updateVisual === "function") updateVisual();
}


// ================================
//      REPORTAR RESULTADO
// ================================
async function reportarResultadoChallonge() {
  const select = document.getElementById('selectMatch');
  const matchId = select && select.value;
  console.log('[REPORT] selectMatch value:', matchId);
  console.log('[REPORT] matchesCargados:', matchesCargados);

  if (!matchId || !matchesCargados.length) {
    mostrarNotificacion("Selecciona un match primero.", "error");
    return;
  }
  // CAMBIO: Usar el slug del select de torneos
  const slug = document.getElementById('tournamentList').value.trim();
  console.log('[REPORT] slug:', slug);

  if (!slug) {
    mostrarNotificacion("Falta slug del torneo.", "error");
    return;
  }
  const score1 = document.getElementById('p1Score').textContent.trim();
  const score2 = document.getElementById('p2Score').textContent.trim();
  console.log('[REPORT] scores:', score1, '-', score2);

  const match = matchesCargados.find(m => String(m.id) === String(matchId));
  console.log('[REPORT] match found:', match);

  if (!match) {
    mostrarNotificacion("Match no encontrado.", "error");
    return;
  }
  const scoreCsv = `${score1}-${score2}`;
  let winnerId = null;
  if (Number(score1) > Number(score2)) winnerId = match.player1_id;
  else if (Number(score2) > Number(score1)) winnerId = match.player2_id;
  else {
    mostrarNotificacion("Empate no permitido.", "error");
    return;
  }

  console.log('[REPORT] Sending to API:', { slug, matchId, scoreCsv, winnerId });

  document.getElementById('msgReportChallonge').textContent = "Enviando...";
  const res = await window.__TAURI__.core.invoke('report-match-score', { slug, matchId, scoreCsv, winnerId });
  console.log('[REPORT] Response:', res);

  if (res.ok) {
    mostrarNotificacion("✅ Resultado reportado correctamente.", "success");
    document.getElementById('msgReportChallonge').textContent = "";
  } else {
    mostrarNotificacion("❌ " + res.error, "error");
    document.getElementById('msgReportChallonge').textContent = "";
  }
}

function confirmarYReportar() {
  if (confirm("¿Estás seguro que quieres reportar el resultado a Challonge? Esta acción no se puede deshacer.")) {
    reportarResultadoChallonge();
  }
}

// ================================
//     Top 8 Redes
// ================================

function generarMensajeTop8(nombreTorneo, top8) {
  let mensaje = `Resultados ${nombreTorneo}\n\n`;

  let prevRank = null;
  let rankNum = 0;
  top8.forEach((p, i) => {
    // Si la posición anterior es igual, repite el número (para empates)
    if (prevRank !== p.final_rank) {
      rankNum = p.final_rank;
      prevRank = p.final_rank;
    }
    // Busca el input de twitter si existe (cuando se edita manualmente)
    let twitterInput = document.getElementById('top8twitter' + i);
    let twitter = twitterInput ? twitterInput.value.trim() : (p.twitter || "");
    let tag = twitter
      ? (twitter.startsWith('@') ? twitter : '@' + twitter)
      : `@${p.name.replace(/\s/g, '_')}`;
    mensaje += `${rankNum}) ${tag}\n`;
  });

  mensaje += `\n¡Gracias por participar!`;
  return mensaje;
}

function mostrarMensajeTop8(nombreTorneo, top8) {
  top8 = top8.slice().sort((a, b) => a.final_rank - b.final_rank);
  const mensaje = generarMensajeTop8(nombreTorneo, top8);
  document.getElementById('mensajeTop8Text').value = mensaje;
}

function copiarMensajeTop8() {
  const textarea = document.getElementById('mensajeTop8Text');
  textarea.select();
  textarea.setSelectionRange(0, 99999); // Para móviles
  document.execCommand('copy');
  mostrarNotificacion("¡Mensaje copiado!", "success");
}

function generarMensajeTop8DesdeInputs() {
  const tbody = document.getElementById('top8Table');
  let mensaje = `Resultados ${window.nombreTorneoActual || ""}\n\n`;
  for (let i = 0; i < tbody.children.length; ++i) {
    const puesto = tbody.children[i].children[0].textContent;
    let twitter = document.getElementById('top8twitter' + i).value.trim();
    if (!twitter) {
      const jugador = tbody.children[i].children[1].textContent;
      twitter = '@' + jugador.replace(/\s/g, '_');
    }
    if (!twitter.startsWith('@')) twitter = '@' + twitter;
    mensaje += `${puesto}) ${twitter}\n`;
  }
  mensaje += `\n¡Gracias por participar!`;
  document.getElementById('mensajeTop8Text').value = mensaje;
}

// ================================
//     OBS
// ================================

let obs = new OBSWebSocket();

async function conectarOBS() {
  const host = document.getElementById('obsHost').value.trim() || "localhost";
  const port = document.getElementById('obsPort').value.trim() || "4455";
  const password = document.getElementById('obsPassword').value.trim() || "";
  
  try {
    await obs.connect(`ws://${host}:${port}`, password);
    document.getElementById('msgOBS').innerHTML = '<span class="text-success">&#x2705; OBS conectado</span>';
    setTimeout(cargarEscenasOBS, 400);
  } catch (e) {
    document.getElementById('msgOBS').innerHTML = '<span class="text-error">&#x274C; ' + (e.message || "No se pudo conectar") + '</span>';
    document.getElementById('obsScenesContainer').innerHTML = "";
  }
}

async function cargarEscenasOBS() {
  const contenedor = document.getElementById('obsScenesContainer');
  contenedor.innerHTML = "";
  try {
    const res = await obs.call('GetSceneList');
    console.log('Respuesta escenas OBS:', res);
    if (res.scenes && res.scenes.length) {
      obsEscenas = res.scenes.map(s => s.sceneName).reverse();
      obsEscenas.forEach(scene => {
        const btn = document.createElement('button');
        btn.textContent = scene;
        btn.className = "sb-btn";
        btn.onclick = () => cambiarEscenaOBS(scene);
        contenedor.appendChild(btn);
      });
    } else {
      contenedor.innerHTML = "<span class='text-error'>No se encontraron escenas.</span>";
    }
  } catch(e) {
    contenedor.innerHTML = "<span class='text-error'>Error obteniendo escenas: " + e.message + "</span>";
  }
}

async function cambiarEscenaOBS(scene) {
  try {
    await obs.call('SetCurrentProgramScene', { sceneName: scene });
    document.getElementById('msgOBS').innerHTML = `<span class="text-success">&#x2705; Cambiado a "${scene}"</span>`;
  } catch(e) {
    document.getElementById('msgOBS').innerHTML = `<span class="text-error">&#x274C; ${e.message || "No se pudo cambiar"}</span>`;
  }
}

async function capturarEscenaOBS() {
  const msg = document.getElementById('msgCapturaOBS');
  try {
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
    const { imageData } = await obs.call('GetSourceScreenshot', {
      sourceName: currentProgramSceneName,
      imageFormat: 'png',
      imageWidth: 1920,
      imageHeight: 1080
    });
    const res = await fetch(imageData);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    msg.textContent = "✅ Captura copiada al portapapeles";
  } catch (e) {
    msg.textContent = "❌ Error: " + (e.message || "No se pudo capturar");
  }
  setTimeout(() => { msg.textContent = ""; }, 2500);
}

function twittearMensaje() {
  // Genera el mensaje Top 8 actual
  const tbody = document.getElementById('top8Table');
  let mensaje = `Resultados ${window.nombreTorneoActual || ""}\n\n`;
  for (let i = 0; i < tbody.children.length; ++i) {
    const puesto = tbody.children[i].children[0].textContent;
    let twitter = document.getElementById('top8twitter' + i).value.trim();
    if (!twitter) {
      // Si no hay twitter, usa @Jugador_con_guion
      const jugador = tbody.children[i].children[1].textContent;
      twitter = '@' + jugador.replace(/\s/g, '_');
    }
    if (!twitter.startsWith('@')) twitter = '@' + twitter;
    mensaje += `${puesto}) ${twitter}\n`;
  }
  mensaje += `\n¡Gracias por participar!`;
  // Abre Twitter with el mensaje generado
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// ================================
//     TORNEOS
// ================================

async function cargarTorneos() {
  await cargarTodosLosTorneosChallonge();
}

async function cargarTorneosTop8() {
  await cargarTodosLosTorneosChallonge();
  const select = document.getElementById('tournamentTop8');
  if (select) {
    // Restaurar si existe
    if (window.ultimoTorneoTop8) {
      select.value = window.ultimoTorneoTop8;
    }
    select.onchange = () => {
      window.ultimoTorneoTop8 = select.value;
      cargarTop8(); // Se carga el Top 8 automáticamente al seleccionar
      syncChallongeTournament('tournamentTop8');
    };
  }
}

async function cargarTorneosBracket() {
  await cargarTodosLosTorneosChallonge();
  const select = document.getElementById('tournamentBracket');
  if (select) {
    // Restaurar si existe
    if (window.ultimoTorneoBracket) {
      select.value = window.ultimoTorneoBracket;
    }
    select.onchange = async () => {
      window.ultimoTorneoBracket = select.value;
      mostrarBracket();
      syncChallongeTournament('tournamentBracket');
    };
  }
}

async function buscarTorneosMatches() {
  await cargarTodosLosTorneosChallonge();
  const select = document.getElementById('tournamentList');
  if (select) {
    // Restaurar si existe
    if (window.ultimoTorneoMatches) {
      select.value = window.ultimoTorneoMatches;
    }
    select.onchange = () => {
      window.ultimoTorneoMatches = select.value;
      syncChallongeTournament('tournamentList');
    };
  }
}

// Muestra una notificación flotante en la esquina superior derecha
function mostrarNotificacion(mensaje, tipo = "info", duracion = 3000) {
  const contenedor = document.getElementById('notificaciones-app');
  if (!contenedor) return;
  const div = document.createElement('div');
  div.className = `notificacion-flotante ${tipo}`;
  div.textContent = mensaje;
  contenedor.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 400);
  }, duracion);
}

// ================================
//     RUTAS PERSONALIZADAS
// ================================

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function elegirRuta(tipo) {
  const res = await window.__TAURI__.core.invoke('elegir-ruta', { tipo });
  if (res.ok && res.ruta) {
    const input = document.getElementById(rutaId(tipo));
    if (input) {
      input.value = res.ruta;
      // Guarda todas las rutas actuales, incluyendo 'usuarios'
      const rutas = {};
      for (const t of ['scoreboard', 'casters', 'timestamp', 'bracket', 'top8', 'apikey', 'usuarios']) {
        const inp = document.getElementById(rutaId(t));
        rutas[t] = inp ? inp.value : '';
      }
      await window.__TAURI__.core.invoke('guardar-rutas', { rutas });
    }
  }
}

async function guardarTodasLasRutas() {
  const rutas = {};
  for (const t of ['scoreboard', 'casters', 'timestamp', 'bracket', 'top8', 'apikey', 'usuarios']) {
    const inp = document.getElementById(rutaId(t));
    rutas[t] = inp ? inp.value : '';
  }
  console.log('[guardarTodasLasRutas] Rutas a guardar:', rutas);
  const resultado = await window.__TAURI__.core.invoke('guardar-rutas', { rutas });
  console.log('[guardarTodasLasRutas] Resultado del guardado:', resultado);

  if (resultado.ok) {
    alert('¡Rutas guardadas correctamente!');
  } else {
    alert('Error al guardar las rutas');
  }
}

async function cargarRutas() {
  console.log('[cargarRutas] Iniciando carga de rutas...');
  const res = await window.__TAURI__.core.invoke('cargar-rutas');
  console.log('[cargarRutas] Respuesta del servidor:', res);

  if (res.ok && res.rutas) {
    console.log('[cargarRutas] Rutas encontradas:', res.rutas);
    for (const tipo of ['scoreboard', 'casters', 'timestamp', 'bracket', 'top8', 'apikey', 'usuarios']) {
      const inputId = rutaId(tipo);
      const input = document.getElementById(inputId);
      console.log(`[cargarRutas] Procesando ${tipo} -> input ID: ${inputId}, input existe: ${!!input}`);

      if (res.rutas[tipo] !== undefined && input) {
        input.value = res.rutas[tipo];
        console.log(`[cargarRutas] Asignado ${tipo}: "${res.rutas[tipo]}" al input ${inputId}`);
      } else if (!input) {
        console.warn(`[cargarRutas] Input ${inputId} no encontrado en el DOM`);
      }
    }
  } else {
    console.warn('[cargarRutas] No se pudieron cargar las rutas:', res);
  }
}

function rutaId(tipo) {
  if (tipo === 'apikey') return 'rutaApiKey';
  if (tipo === 'usuarios') return 'rutaUsuarios';
  return 'ruta' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

// ================================
//     PREVIEW MATCH
// ================================

function mostrarPreviewMatch() {
  const select = document.getElementById('selectMatch');
  const matchId = select.value;
  const match = matchesCargados.find(m => String(m.id) === String(matchId));
  const div = document.getElementById('preview-match');
  if (!div) return;

  if (!match) {
    div.innerHTML = '';
    return;
  }

  const score1 = document.getElementById('p1Score')?.textContent || '0';
  const score2 = document.getElementById('p2Score')?.textContent || '0';

  div.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;gap:2em;">
      <div>
        <strong>${match.player1_name}</strong>
        <div>Score: <span>${score1}</span></div>
      </div>
      <div style="font-size:2em;">VS</div>
      <div>
        <strong>${match.player2_name}</strong>
        <div>Score: <span>${score2}</span></div>
      </div>
    </div>
  `;
}

// Llama a esta función cada vez que cambies el score
document.getElementById('p1Score').addEventListener('DOMSubtreeModified', mostrarPreviewMatch);
document.getElementById('p2Score').addEventListener('DOMSubtreeModified', mostrarPreviewMatch);

// ================================
//     RUTAS PERSONALIZADAS
// ================================

function abrirRutas() {
  window.__TAURI__.core.invoke('abrir-ventana-rutas');
}

async function llenarPersonajesTop8DesdeTxt() {
  const res = await window.__TAURI__.core.invoke('leer-personajes-txt');
  if (res.ok) {
    for (let i = 0; i < 8; ++i) {
      const select = document.getElementById('top8char' + i);
      if (select) {
        select.innerHTML = res.personajes.map(
          char => `<option value="${char}">${char}</option>`
        ).join('');
      }
    }
  } else {
    // Si falla, puedes dejar la lista por defecto o mostrar un mensaje
    console.warn(res.error);
  }
}
async function llenarUsuariosTop8DesdeTxt() {
  const res = await window.__TAURI__.core.invoke('leer-usuarios-txt');
  if (res.ok) {
    // Ordena alfabéticamente (ignorando mayúsculas/minúsculas)
    const usuariosOrdenados = res.usuarios.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    for (let i = 0; i < 8; ++i) {
      const select = document.getElementById('top8twitter' + i);
      if (select) {
        select.innerHTML = usuariosOrdenados.map(
          usuario => `<option value="${usuario}">${usuario}</option>`
        ).join('');
      }
    }
  } else {
    // Si falla, puedes dejar la lista por defecto o mostrar un mensaje
    console.warn(res.error);
  }
}

// ...al final de scoreboard.js
window.addEventListener('DOMContentLoaded', function () {
  const saved = localStorage.getItem('scoreboard-style');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    const styleSel = document.getElementById('styleSel');
    if (styleSel) styleSel.value = 'light';
  }

  // No cargar rutas automáticamente - se cargan al ir a la pestaña de rutas

  // Initialize Challonge sub-tabs to show first one by default
  showChallongeSubTab(0);
});

// ================================
//      TEMPORIZADOR
// ================================


// ================================
//  CARGAR MATCH CHALLONGE EN SCOREBOARD (desde widget flotante)
// ================================
function cargarMatchChallongeEnScoreboard() {
  // Selector de match en el widget flotante
  const matchSelector = document.getElementById('challongeMatchSelector');
  if (!matchSelector || matchSelector.style.display === 'none') {
    mostrarNotificacion('Selecciona un match válido en el widget.', 'error');
    return;
  }
  const selectedOption = matchSelector.options[matchSelector.selectedIndex];
  if (!selectedOption || !selectedOption.dataset.match) {
    mostrarNotificacion('Selecciona un match válido.', 'error');
    return;
  }
  let match;
  try {
    match = JSON.parse(selectedOption.dataset.match);
  } catch (e) {
    mostrarNotificacion('Error al leer datos del match.', 'error');
    return;
  }

  // Separar tag y nombre si corresponde
  function splitTagAndName(fullName) {
    if (typeof fullName === 'string' && fullName.includes(' | ')) {
      const [tag, ...rest] = fullName.split(' | ');
      return { tag: tag.trim(), name: rest.join(' | ').trim() };
    }
    return { tag: '', name: fullName };
  }

  // Jugador 1
  const p1 = splitTagAndName(match.player1_name);
  document.getElementById('p1NameInput').value = p1.name;
  document.getElementById('p1TagInput').value = p1.tag;

  // Jugador 2
  const p2 = splitTagAndName(match.player2_name);
  document.getElementById('p2NameInput').value = p2.name;
  document.getElementById('p2TagInput').value = p2.tag;

  // Ronda - convertir usando estructura calculada basada en participantes
  let roundName = '';

  // Usar la variable global si la local está en 0
  const participantsCount = tournamentParticipantsCount || window.tournamentParticipantsCount || 0;
  console.log("🎮 cargarMatchChallongeEnScoreboard - participantsCount:", participantsCount);
  console.log("🎮 tournamentParticipantsCount (local):", tournamentParticipantsCount);
  console.log("🎮 window.tournamentParticipantsCount (global):", window.tournamentParticipantsCount);

  if (match.round !== undefined && match.round !== null) {
    // Usar estructura calculada basada en participantes del torneo
    let roundsInfo;
    if (participantsCount > 0) {
      roundsInfo = calcularEstructuraTorneo(participantsCount);
      console.log("✅ Usando estructura calculada basada en participantes:", roundsInfo);
    } else {
      // Fallback: calcular desde matches existentes
      const allWinnerRounds = matchesCargados
        .filter(m => m.round !== undefined && m.round !== null && m.round > 0)
        .map(m => m.round);
      const allLoserRounds = matchesCargados
        .filter(m => m.round !== undefined && m.round !== null && m.round < 0)
        .map(m => m.round);

      const maxWinners = allWinnerRounds.length ? Math.max(...allWinnerRounds) : 1;
      const minLosers = allLoserRounds.length ? Math.min(...allLoserRounds) : -1;
      const maxLosers = allLoserRounds.length ? Math.max(...allLoserRounds) : -1;

      roundsInfo = { maxWinners, minLosers, maxLosers };
    }

    roundName = nombreDeRonda(match.round, roundsInfo);
  } else {
    roundName = `Match #${match.id}`;
  }

  // Actualizar el campo editable de ronda (sbRound)
  document.getElementById('sbRound').value = roundName;
  window.currentRoundName = roundName;

  // Scores
  if (match.scores_csv) {
    const parts = match.scores_csv.split('-');
    if (parts.length === 2) {
      document.getElementById('p1Score').textContent = parts[0].trim();
      document.getElementById('p2Score').textContent = parts[1].trim();
    }
  } else {
    document.getElementById('p1Score').textContent = '0';
    document.getElementById('p2Score').textContent = '0';
  }

  if (typeof updateVisual === 'function') updateVisual();
  mostrarNotificacion('Match cargado en el scoreboard.', 'success');
}
function fijarTimer() {
  const minutos = parseInt(document.getElementById('timerInput').value, 10);
  if (isNaN(minutos) || minutos <= 0) {
    document.getElementById('msgTimer').textContent = '⏱️ Ingresa minutos válidos';
    setTimeout(() => document.getElementById('msgTimer').textContent = '', 2000);
    return;
  }
  // Guardar el tiempo de finalización en el JSON
  const ahora = Date.now();
  timerEndTimestamp = ahora + minutos * 60 * 1000;
  mostrarTimer(timerEndTimestamp - ahora);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const restante = timerEndTimestamp - Date.now();
    if (restante <= 0) {
      mostrarTimer(0);
      clearInterval(timerInterval);
      document.getElementById('msgTimer').textContent = '⏰ ¡Tiempo finalizado!';
      setTimeout(() => document.getElementById('msgTimer').textContent = '', 3000);
    } else {
      mostrarTimer(restante);
    }
  }, 1000);
  document.getElementById('msgTimer').textContent = '⏱️ Timer fijado';
  setTimeout(() => document.getElementById('msgTimer').textContent = '', 2000);
  guardarTimerEnScoreboard(timerEndTimestamp);
}

function resetearTimer() {
  // Detener cualquier timer en curso
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Resetear variables globales
  timerEndTimestamp = null;

  // Mostrar 00:00 en pantalla
  mostrarTimer(0);

  // Limpiar el input
  document.getElementById('timerInput').value = '';

  // Guardar el estado reseteado en el JSON
  guardarTimerEnScoreboard(null);

  // Mostrar mensaje de confirmación
  document.getElementById('msgTimer').textContent = '🔄 Timer reseteado';
  setTimeout(() => document.getElementById('msgTimer').textContent = '', 2000);
}

function mostrarTimer(msRestante) {
  const el = document.getElementById('timerDisplay');
  if (!el) return;
  if (msRestante <= 0) {
    el.textContent = '00:00';
    return;
  }
  const totalSec = Math.floor(msRestante / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  el.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

async function guardarTimerEnScoreboard(timestamp) {
  // Cargar timestamp actual
  const resLoad = await window.__TAURI__.core.invoke('load-json', { tipo: 'timestamp' });
  let data = resLoad.ok && resLoad.data ? resLoad.data : {};
  data.timerEndTimestamp = timestamp;
  await window.__TAURI__.core.invoke('save-json', { data: data, tipo: 'timestamp' });
}

// Al cargar la pestaña comentaristas, mostrar el timer si existe
async function cargarTimerAlAbrir() {
  try {
    const resLoad = await window.__TAURI__.core.invoke('load-json', { tipo: 'timestamp' });
    if (resLoad.ok && resLoad.data && resLoad.data.timerEndTimestamp) {
      const end = Number(resLoad.data.timerEndTimestamp);
      const ahora = Date.now();
      if (end > ahora) {
        timerEndTimestamp = end;
        mostrarTimer(timerEndTimestamp - ahora);
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          const restante = timerEndTimestamp - Date.now();
          if (restante <= 0) {
            mostrarTimer(0);
            clearInterval(timerInterval);
            document.getElementById('msgTimer').textContent = '⏰ ¡Tiempo finalizado!';
            setTimeout(() => document.getElementById('msgTimer').textContent = '', 3000);
          } else {
            mostrarTimer(restante);
          }
        }, 1000);
        return;
      }
    }
  } catch (e) {
    console.warn('Error al cargar timer desde JSON:', e);
  }

  // Fallback / Reset si no hay timer activo
  mostrarTimer(0);
  timerEndTimestamp = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Sincronizar todos los selectores de torneo de Challonge para que actúen como espejo
function syncChallongeTournament(changedId) {
  const changedEl = document.getElementById(changedId);
  if (!changedEl) return;
  const val = changedEl.value;
  const selectedText = changedEl.options[changedEl.selectedIndex]?.textContent || '';

  const ids = ['challongeTournamentSelector', 'tournamentList', 'tournamentBracket', 'tournamentTop8'];
  let updatedAny = false;

  ids.forEach(id => {
    if (id === changedId) return;
    const el = document.getElementById(id);
    if (el) {
      if (el.value === val) return; // Ya sincronizado
      
      // Asegurar que la opción exista en el destino
      let optionExists = false;
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i].value === val) {
          optionExists = true;
          break;
        }
      }
      if (!optionExists && val) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = selectedText;
        el.appendChild(opt);
      }
      el.value = val;
      el.dispatchEvent(new Event('change'));
      updatedAny = true;
    }
  });

  // Si se seleccionó un torneo, cargar matches de manera unificada
  if (val) {
    cargarMatchesChallonge(val);
  }
}

// Cargar todos los torneos desde la API y pueblar los dropdowns
async function cargarTodosLosTorneosChallonge() {
  const apiKeyInput = document.getElementById('apikey');
  if (!apiKeyInput) return;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    console.warn("API Key no ingresada aún.");
    return;
  }

  try {
    const res = await window.__TAURI__.core.invoke('get-tournaments');
    if (!res.ok) throw new Error(res.error || "Error al obtener los torneos.");

    const torneos = res.tournaments || [];
    console.log("[Challonge] Torneos cargados para unificación:", torneos);

    // Ordenar de más nuevo a más antiguo
    const torneosOrdenados = torneos
      .filter(t => t.created_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Actualizar todas las listas de torneos
    actualizarListasDeTorneosChallonge(torneosOrdenados);

    return torneosOrdenados;
  } catch (error) {
    console.error("[Challonge] Error al cargar todos los torneos:", error);
    const ids = ['challongeTournamentSelector', 'tournamentList', 'tournamentBracket', 'tournamentTop8'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<option value="">❌ ${error.message}</option>`;
    });
  }
}

// Poblar los 4 selectores de torneos con la misma lista de torneos
function actualizarListasDeTorneosChallonge(torneos) {
  const ids = ['challongeTournamentSelector', 'tournamentList', 'tournamentBracket', 'tournamentTop8'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    const valPrevio = el.value;
    
    el.innerHTML = '<option value="">Selecciona un torneo...</option>';
    torneos.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.url;
      const estado = t.state ? ` (${t.state})` : '';
      opt.textContent = t.name + estado;
      el.appendChild(opt);
    });
    
    // Restaurar selección previa si aún existe
    if (valPrevio && torneos.some(t => t.url === valPrevio)) {
      el.value = valPrevio;
    }
  });
}

// Carga matches de manera unificada para el slug seleccionado
async function cargarMatchesChallonge(slug = null) {
  if (!slug) {
    const selector = document.getElementById('challongeTournamentSelector') || document.getElementById('tournamentList');
    slug = selector ? selector.value : '';
  }
  
  if (!slug) {
    console.log("No hay slug seleccionado para cargar matches.");
    return;
  }

  const msgMatches = document.getElementById('msgMatches');
  const loadingBar = document.getElementById('challongeMatchLoadingBar');
  const selectMatch = document.getElementById('selectMatch');
  const challongeMatchSelector = document.getElementById('challongeMatchSelector');

  if (msgMatches) msgMatches.textContent = "Cargando matches...";
  if (loadingBar) loadingBar.style.display = 'block';
  if (selectMatch) selectMatch.style.display = 'none';
  if (challongeMatchSelector) challongeMatchSelector.style.display = 'none';

  try {
    console.log("🔍 [Unificado] Cargando matches para slug:", slug);
    const res = await window.__TAURI__.core.invoke('get-all-matches-and-participants', { slug });
    
    let allMatches = [];
    let tipoMatches = "eliminatorias";
    let participantsCount = 0;

    if (res && res.ok) {
      allMatches = res.matches || [];
      participantsCount = res.participantsCount || res.participantes?.length || 0;
    } else {
      const fallbackRes = await window.__TAURI__.core.invoke('get-matches-and-participants', { slug });
      if (fallbackRes.ok) {
        allMatches = fallbackRes.matches || [];
        participantsCount = fallbackRes.participantsCount || fallbackRes.participantes?.length || 0;
      } else {
        throw new Error(res?.error || fallbackRes?.error || "Error al obtener matches.");
      }
    }

    if ((!allMatches || allMatches.length === 0) && res.tournament_type && res.tournament_type.toLowerCase().includes("group")) {
      try {
        const groupRes = await window.__TAURI__.core.invoke('get-group-matches', { slug });
        if (groupRes.ok && groupRes.matches && groupRes.matches.length > 0) {
          allMatches = groupRes.matches;
          tipoMatches = "grupos";
        }
      } catch (groupErr) {
        console.error("Error al obtener matches de grupos:", groupErr);
      }
    }

    window.tournamentParticipantsCount = participantsCount;
    tournamentParticipantsCount = participantsCount;
    matchesCargados = allMatches;

    actualizarSelectoresMatchesChallonge(allMatches, tipoMatches);

    if (msgMatches) msgMatches.textContent = "✅ Matches cargados.";
  } catch (error) {
    console.error("Error en cargarMatchesChallonge unificado:", error);
    if (msgMatches) msgMatches.textContent = `❌ ${error.message}`;
  } finally {
    if (loadingBar) loadingBar.style.display = 'none';
  }
}

// Poblar los dropdowns de matches de la pestaña y del widget
function actualizarSelectoresMatchesChallonge(matches, tipoMatches) {
  const selectMatch = document.getElementById('selectMatch');
  const challongeMatchSelector = document.getElementById('challongeMatchSelector');
  
  if (selectMatch) selectMatch.innerHTML = '';
  if (challongeMatchSelector) challongeMatchSelector.innerHTML = '<option value="">Selecciona un match...</option>';

  const matchesFiltrados = matches.filter(match =>
    match.player1_name && match.player2_name &&
    !match.player1_name.includes('TBD') && !match.player2_name.includes('TBD') &&
    !match.winner_id
  );

  if (matchesFiltrados.length === 0) {
    if (selectMatch) {
      selectMatch.innerHTML = '<option value="">No hay matches abiertos</option>';
      selectMatch.style.display = 'block';
    }
    if (challongeMatchSelector) {
      challongeMatchSelector.innerHTML = '<option value="">No hay matches abiertos</option>';
      challongeMatchSelector.style.display = 'block';
    }
    return;
  }

  matchesFiltrados.forEach(match => {
    let matchInfo = "";
    if (tipoMatches === "grupos" && match.group_name) {
      matchInfo = ` (${match.group_name})`;
    } else if (match.round && match.round !== 0) {
      matchInfo = ` (R${match.round})`;
    }
    const text = `Match #${match.id} - ${match.player1_name} vs ${match.player2_name}${matchInfo}`;
    
    if (selectMatch) {
      const opt = document.createElement('option');
      opt.value = match.id;
      opt.textContent = text;
      opt.dataset.match = JSON.stringify(match);
      selectMatch.appendChild(opt);
    }
    
    if (challongeMatchSelector) {
      const opt = document.createElement('option');
      opt.value = match.id;
      opt.textContent = text;
      opt.dataset.match = JSON.stringify(match);
      challongeMatchSelector.appendChild(opt);
    }
  });

  if (selectMatch) selectMatch.style.display = 'block';
  if (challongeMatchSelector) challongeMatchSelector.style.display = 'block';

  if (selectMatch) {
    selectMatch.selectedIndex = 0;
  }
  if (challongeMatchSelector) {
    challongeMatchSelector.value = selectMatch ? selectMatch.value : '';
  }

  mostrarMatchEnScoreboard();
  mostrarPreviewMatch();
}

// Sincronizar selección de match entre pestaña y widget
function syncChallongeMatch(changedId) {
  const changedEl = document.getElementById(changedId);
  if (!changedEl) return;
  const val = changedEl.value;

  const otherId = changedId === 'selectMatch' ? 'challongeMatchSelector' : 'selectMatch';
  const otherEl = document.getElementById(otherId);

  if (otherEl && otherEl.value !== val) {
    otherEl.value = val;
  }

  if (val) {
    mostrarMatchEnScoreboard();
    mostrarPreviewMatch();
  }
}

// Sincronizar personajes y Twitter en las tablas del Top 8 en tiempo real
function sincronizarCambioTop8(tipo, idx, valor) {
  if (tipo === 'char') {
    const tabEl = document.getElementById(`top8char${idx}`);
    const widgetEl = document.getElementById(`challongeTop8Char${idx}`);
    if (tabEl && tabEl.value !== valor) tabEl.value = valor;
    if (widgetEl && widgetEl.value !== valor) widgetEl.value = valor;
  } else if (tipo === 'twitter') {
    const tabEl = document.getElementById(`top8twitter${idx}`);
    const widgetEl = document.getElementById(`challongeTop8Twitter${idx}`);
    if (tabEl && tabEl.value !== valor) tabEl.value = valor;
    if (widgetEl && widgetEl.value !== valor) widgetEl.value = valor;
  }
}

// Registrar sincronización de selección al cargar
document.addEventListener('DOMContentLoaded', () => {
  const selectMatch = document.getElementById('selectMatch');
  const challongeMatchSelector = document.getElementById('challongeMatchSelector');

  if (selectMatch) {
    selectMatch.addEventListener('change', () => {
      syncChallongeMatch('selectMatch');
    });
  }

  if (challongeMatchSelector) {
    challongeMatchSelector.addEventListener('change', () => {
      syncChallongeMatch('challongeMatchSelector');
    });
  }
});



