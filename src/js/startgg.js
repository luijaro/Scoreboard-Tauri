// Nueva función para buscar y mostrar eventos de un torneo Start.gg
async function buscarStartGG(busquedaTexto = null) {
  const slugInput = document.getElementById('startggSlug');
  // Asegura que el input esté habilitado y editable
  if (slugInput) {
    slugInput.removeAttribute('readonly');
    slugInput.removeAttribute('disabled');
  }
  // Usar el parámetro si se proporciona, o el valor del input
  const texto = busquedaTexto || (slugInput ? slugInput.value.trim() : '');
  // Guardar el slug en localStorage
  if (texto) {
    localStorage.setItem('ultimoStartggSlug', texto);
  }
  const resultsDiv = document.getElementById('startggResults');
  resultsDiv.innerHTML = '';
  if (!texto) {
    resultsDiv.textContent = "❌ Ingresa un slug o link de torneo.";
    return;
  }
  resultsDiv.textContent = "Buscando...";
  // Extraer slug si viene en formato de link
  let slug = texto;
  const match = texto.match(/tournament\/([\w\-]+)/);
  if (match) slug = match[1];
  try {
    // Consulta eventos del torneo
    const res = await window.__TAURI__.core.invoke('startgg-get-events', { tournamentSlug: slug });
    if (res.error) {
      resultsDiv.textContent = "❌ " + res.error;
      return;
    }
    const torneo = res.tournamentName || res.tournament?.name || slug;
    const eventos = res.events || [];
    if (!eventos.length) {
      resultsDiv.innerHTML = `<b>Eventos de ${torneo}:</b><br>No se encontraron eventos para este torneo.`;
      return;
    }
  let html = `<b class="sgg-title">Eventos de ${torneo}:</b><br><div class='sgg-eventos-list'>`;
    // Optimización: Usar el estado que ya viene en la respuesta principal si existe
    const eventosConEstado = await Promise.all(eventos.map(async ev => {
      let estadoEv = '';
      // Usar el estado si viene en el objeto del evento
      const evState = ev.state || ev.status || '';
  if (evState === 'ACTIVE') estadoEv = '<span class="status-badge success">En progreso</span>';
  else if (evState === 'COMPLETED') estadoEv = '<span class="status-badge warning">Terminado</span>';
  else if (!evState || evState === '?' || evState === 'null' || evState === 'undefined') estadoEv = '<span class="status-badge muted">Desconocido</span>';
  else estadoEv = `<span class="status-badge muted">${evState}</span>`;

      // Si no viene el estado, solo entonces consulta por evento
      if (!evState) {
        try {
          const evRes = await window.__TAURI__.core.invoke('startgg-get-event-state', { eventId: Number(ev.id) });
          const evState2 = evRes?.state || evRes?.event?.state || evRes?.status || '';
          if (evState2 === 'ACTIVE') estadoEv = '<span class="status-badge success">En progreso</span>';
          else if (evState2 === 'COMPLETED') estadoEv = '<span class="status-badge warning">Terminado</span>';
          else if (!evState2 || evState2 === '?' || evState2 === 'null' || evState2 === 'undefined') estadoEv = '<span class="status-badge muted">Desconocido</span>';
          else estadoEv = `<span class="status-badge muted">${evState2}</span>`;
        } catch (e) {
          estadoEv = '<span class="status-badge muted">Desconocido</span>';
        }
      }
      return `
      <div class='sgg-event-card'>
        <div class='sgg-event-name'>${ev.name}</div>
        <div class='sgg-event-state'>Estado: ${estadoEv}</div>
        <div class='sgg-event-actions'>
          <button class='sb-btn sgg-btn btn-success' title='Top 8' onclick='generarTop8StartGG(${ev.id}, "${ev.name.replace(/'/g, "\\'")}")'><i class="fa fa-trophy"></i> Top 8</button>
          <button class='sb-btn sgg-btn btn-info' title='Bracket' onclick='guardarBracketStartGG(${ev.id}, "${ev.name.replace(/'/g, "\\'")}")'><i class="fa fa-sitemap"></i> Bracket</button>
          <button class='sb-btn sgg-btn btn-warning' title='Matches' onclick='consultarMatchesStartGG(${ev.id}, "${ev.name.replace(/'/g, "\\'")}")'><i class="fa fa-gamepad"></i> Matches</button>
        </div>
      </div>`;
    }));
    html += eventosConEstado.join('');
    html += `</div>`;
    resultsDiv.innerHTML = html;
  // Hover handled by CSS

    // Agregar torneo al selector del widget flotante
    agregarTorneoAlWidget(torneo, slug, eventos);
  } catch (e) {
    resultsDiv.textContent = "❌ Error: " + e.message;
  }
}


// Guardar el bracket directamente al hacer clic en el botón Bracket
async function guardarBracketStartGG(eventIdInput, eventName) {
  const eventId = Number(eventIdInput);
  // Buscar el botón específico que fue clickeado
  const btn = document.querySelector(`button[onclick*="guardarBracketStartGG(${eventIdInput},"]`);
  if (!btn) return;

  // Inyectar CSS para la animación
  addStyle(`
    .loading-btn {
      position: relative;
      overflow: hidden;
      pointer-events: none !important;
    }
    .loading-btn .loading-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: linear-gradient(90deg, var(--error-color), var(--warning-color));
      width: 0%;
      transition: width 2s ease-in-out;
      z-index: 1;
    }
    .loading-btn .btn-content {
      position: relative;
      z-index: 2;
      color: white !important;
      font-weight: bold;
    }
  `);

  // Guardar estado original del botón
  const originalHTML = btn.innerHTML;
  const originalStyle = btn.style.cssText;
  const originalClass = btn.className;

  // Preparar botón para loading
  btn.disabled = true;
  btn.className = originalClass + ' loading-btn';
  btn.innerHTML = '<span class="loading-bar"></span><span class="btn-content">Guardando...</span>';

  try {
    // Iniciar animación de carga
    setTimeout(() => {
      const loadingBar = btn.querySelector('.loading-bar');
      if (loadingBar) {
        loadingBar.style.width = '100%';
      }
    }, 50);

    // Obtener matches del evento
    const res = await window.__TAURI__.core.invoke('startgg-get-matches', { eventId });
    if (res.error) {
      throw new Error(res.error);
    }
    if (!res.sets || res.sets.length === 0) {
      throw new Error('No se encontraron matches para guardar.');
    }

    // Guardar bracket
    const torneo = eventName || '';
    const fecha = new Date().toLocaleDateString('es-CL');
    const saveResult = await guardarBracketEnJson(torneo, fecha, res.sets);

    if (!saveResult.ok) {
      throw new Error(saveResult.error || 'Error desconocido al guardar');
    }

    // Mostrar éxito
    btn.innerHTML = '<span class="btn-content"><i class="fa fa-check"></i> ¡Guardado!</span>';
    btn.style.background = '#27ae60';
    btn.style.border = '2px solid #2ecc71';

  } catch (e) {
    // Mostrar error
    btn.innerHTML = '<span class="btn-content"><i class="fa fa-exclamation-triangle"></i> Error</span>';
    btn.style.background = '#e74c3c';
    btn.style.border = '2px solid #c0392b';
    console.error('Error guardando bracket:', e);
  }

  // Restaurar botón después de 3 segundos
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.cssText = originalStyle;
    btn.className = originalClass;
    btn.disabled = false;
  }, 3000);
}

// Función para consultar la API con el slug seleccionado
async function consultarStartGG(slug) {
  const resultsDiv = document.getElementById('startggResults');
  resultsDiv.textContent = "Buscando eventos del torneo...";
  try {
    const res = await window.__TAURI__.core.invoke('startgg-get-events', { tournamentSlug: slug });
    if (res.error) {
      resultsDiv.textContent = "❌ " + res.error;
      return;
    }
    // Estado del torneo
    let estado = '';
    const state = res.state || res.tournament?.state || res.status || '';
    if (state === 'ACTIVE') estado = '<span style=\"color:#27ae60;font-weight:bold;\">En progreso</span>';
    else if (state === 'COMPLETED') estado = '<span style=\"color:#e67e22;font-weight:bold;\">Terminado</span>';
    else estado = `<span style=\"color:#aaa;\">${state}</span>`;

    let eventosHtml = '';
    if (res.ok && res.events && res.events.length > 0) {
      // Consulta el estado de cada evento
      const eventosConEstado = await Promise.all(res.events.map(async ev => {
        let estadoEv = '';
        try {
          // Consulta el estado del evento
          const evRes = await window.__TAURI__.core.invoke('startgg-get-event-state', { eventId: Number(ev.id) });
          const evState = evRes?.state || evRes?.event?.state || evRes?.status || '';
          if (evState === 'ACTIVE') estadoEv = '<span style=\"color:#27ae60;font-weight:bold;\">En progreso</span>';
          else if (evState === 'COMPLETED') estadoEv = '<span style=\"color:#e67e22;font-weight:bold;\">Terminado</span>';
          else estadoEv = `<span style=\"color:#aaa;\">${evState}</span>`;
        } catch (e) {
          estadoEv = '<span style=\"color:#aaa;\">?</span>';
        }
        // Mostrar botón Generar Top 8 si el evento está terminado
        let top8Btn = '';
        if (estadoEv.includes('Terminado')) {
          top8Btn = `<button class=\"sb-btn\" style=\"margin-left:0.5em; background:#8e44ad;color:#fff;\" onclick=\"generarTop8StartGG('${ev.id}','${ev.name.replace(/'/g, "\\'")}')\">Generar Top 8</button>`;
        }
        return `<button class=\"sb-btn\" style=\"margin:0.2em 0;\" onclick=\"consultarMatchesStartGG('${ev.id}', '${ev.name.replace(/'/g, "\\'")}')\">${ev.name}</button> ${estadoEv} ${top8Btn}`;
      }));
      eventosHtml = eventosConEstado.join('');
    } else {
      eventosHtml = "No se encontraron eventos para este torneo.";
    }

    resultsDiv.innerHTML = `<b>Eventos de ${res.tournamentName}:</b> ${estado}<br>${eventosHtml}`;
  } catch (e) {
    resultsDiv.textContent = "❌ Error: " + e.message;
  }
}

// Generar Top 8 real usando standings de Start.gg y guardar en top8.json
async function generarTop8StartGG(eventIdInput, eventName) {
  const eventId = Number(eventIdInput);
  const resultsDiv = document.getElementById('startggResults');
  resultsDiv.textContent = 'Generando Top 8...';
  try {
    const res = await window.__TAURI__.core.invoke('startgg-get-standings', { eventId });
    if (res.error) {
      resultsDiv.textContent = '❌ ' + res.error;
      return;
    }
    const jugadores = res.top8 || [];
    if (jugadores.length === 0) {
      resultsDiv.textContent = 'No se pudo generar el Top 8.';
      return;
    }
    // Leer usuarios.txt desde rutas
    let twitters = ["@_Aster_Laker", "@Ejemplo1", "@Ejemplo2", "@Ejemplo3"];
    try {
      const resUsuarios = await window.__TAURI__.core.invoke('leer-usuarios-txt');
      if (resUsuarios.ok && Array.isArray(resUsuarios.usuarios) && resUsuarios.usuarios.length > 0) {
        twitters = resUsuarios.usuarios;
      }
    } catch {}
    
    // Obtener personajes del juego seleccionado en scoreboard
    let personajes = ["akatsuki", "nanase", "hyde", "gordeau", "merkava", "hilda", "chaos", "vatista", "carmine", "seth", "yuzuriha", "eltnum", "wagner", "enkidu", "londrekia", "phonon", "byakuya", "sion", "akira", "kuon", "kaguya"];
    try {
      const gameSelect = document.getElementById('gameSel');
      if (gameSelect && gameSelect.value) {
        const resPersonajes = await window.__TAURI__.core.invoke('get-personajes', { juegoFolder: gameSelect.value });
        if (resPersonajes.personajes && resPersonajes.personajes.length > 0) {
          personajes = resPersonajes.personajes.map(p => p.nombre);
        }
      }
    } catch (e) {
      console.warn('Error obteniendo personajes del juego seleccionado:', e);
    }
    
    // Construir datos para top8.json, prellenando personaje y twitter
    const personajeDefault = personajes[0] || '';
    const twitterDefault = twitters[0] || '';
    const juegoDefault = document.getElementById('gameSel')?.value || '';
    const eventoNombre = eventName || res.eventName || '';
    window.top8EventoActual = eventoNombre; // Guardar globalmente para el guardado posterior
    const top8Data = {
      evento: eventoNombre,
      fecha: new Date().toISOString().slice(0, 10),
      top8: jugadores.map(j => ({
        nombre: j.nombre,
        personaje: personajeDefault,
        juego: juegoDefault,
        twitter: twitterDefault,
        final_rank: j.final_rank
      }))
    };
    // Guardar usando el handler save-json
    const resSave = await window.__TAURI__.core.invoke('save-json', { data: top8Data, tipo: 'top8' });
    if (resSave.ok) {
      // Renderizar tabla editable de Top 8
      let html = `<div style='margin-bottom:1em;color:#27ae60;font-weight:bold;'>✅ Top 8 generado y guardado.</div>`;
      html += `<table id='top8Table' style='width:100%;border-collapse:collapse;background:#23243a;color:#fff;font-family:Montserrat,sans-serif;'>`;
      html += `<thead><tr style='background:#191b22;'>
        <th style='padding:0.7em 0.5em;'>Puesto</th>
        <th style='padding:0.7em 0.5em;'>Jugador</th>
        <th style='padding:0.7em 0.5em;'>Personaje</th>
        <th style='padding:0.7em 0.5em;'>Twitter</th>
      </tr></thead><tbody>`;
      top8Data.top8.forEach((j, index) => {
        html += `<tr>
          <td style='text-align:center;font-weight:bold;'>${j.final_rank}</td>
          <td style='text-align:center;'>${j.nombre}</td>
          <td style='text-align:center;'>
            <select id='char${index}' style='background:#23243a;color:#fff;border-radius:6px;padding:0.3em 0.7em;'>
              ${personajes.map(p => `<option value="${p}"${p===personajes[0]?" selected":""}>${p}</option>`).join("")}
            </select>
          </td>
          <td style='text-align:center;'>
            <select id='twitter${index}' style='background:#23243a;color:#fff;border-radius:6px;padding:0.3em 0.7em;'>
              ${twitters.map(t => `<option value="${t}"${t===twitters[0]?" selected":""}>${t}</option>`).join("")}
            </select>
          </td>
        </tr>`;
      });
      html += `</tbody></table>`;
      html += `<div style='margin-top:1em;display:flex;justify-content:space-between;gap:1em;'>
        <button class='sb-btn' style='background:#8e44ad;color:#fff;font-weight:bold;border-radius:7px;padding:0.7em 1.5em;' onclick='actualizarTop8StartGG("${eventId}", "${eventName.replace(/'/g, "\\'")}");'>
          <i class="fa fa-refresh"></i> Actualizar Top 8
        </button>
        <button class='sb-btn' style='background:#27ae60;color:#fff;font-weight:bold;border-radius:7px;padding:0.7em 1.5em;' onclick='guardarTop8Actualizado();'>
          <i class="fa fa-save"></i> Guardar Cambios
        </button>
      </div>`;
      resultsDiv.innerHTML = html;
    } else {
      resultsDiv.textContent = '❌ Error al guardar Top 8.';
    }
  } catch (e) {
    resultsDiv.textContent = '❌ Error: ' + e.message;
  }
}

// Nueva función para actualizar el Top 8 (regenerarlo)
async function actualizarTop8StartGG(eventId, eventName) {
  if (confirm('¿Estás seguro de que quieres actualizar el Top 8? Esto reemplazará los datos actuales.')) {
    await generarTop8StartGG(eventId, eventName);
  }
}

// Nueva función para guardar los cambios del Top 8 editado
async function guardarTop8Actualizado() {
  try {
    const tabla = document.getElementById('top8Table');
    if (!tabla) {
      alert('❌ No se encontró la tabla del Top 8');
      return;
    }
    console.log('[guardarTop8Actualizado] Tabla encontrada:', tabla);
    console.log('[guardarTop8Actualizado] HTML de la tabla:', tabla.outerHTML.substring(0, 500));
    
    // Buscar directamente las filas del tbody
    const filas = tabla.querySelectorAll('tbody tr');
    console.log('[guardarTop8Actualizado] Filas encontradas:', filas.length);
    
    // También intentar con un selector más específico
    const filasAlternativo = document.querySelectorAll('#top8Table tbody tr');
    console.log('[guardarTop8Actualizado] Filas alternativo:', filasAlternativo.length);
    
    if (!filas.length && !filasAlternativo.length) {
      alert('❌ No hay filas en la tabla del Top 8. No se guardará el archivo.');
      return;
    }
    
    // Usar las filas que funcionen
    const filasFinales = filas.length > 0 ? filas : filasAlternativo;
    // Recuperar el nombre del evento de la variable global o del JSON actual
    let eventoNombre = window.top8EventoActual || '';
    if (!eventoNombre) {
      // Intentar leer el evento del JSON actual
      try {
        const resLoad = await window.__TAURI__.core.invoke('load-json', { tipo: 'top8' });
        if (resLoad.ok && resLoad.data && resLoad.data.evento) {
          eventoNombre = resLoad.data.evento;
        }
      } catch {}
    }
    const top8Data = {
      evento: eventoNombre,
      fecha: new Date().toISOString().slice(0, 10),
      top8: []
    };
    filasFinales.forEach((fila, index) => {
      const puesto = fila.cells[0].textContent;
      const jugador = fila.cells[1].textContent;
      const personajeSelect = fila.querySelector(`#char${index}`);
      const twitterSelect = fila.querySelector(`#twitter${index}`);
      
      console.log(`[guardarTop8Actualizado] Fila ${index}:`, {
        puesto,
        jugador,
        personajeSelect: personajeSelect?.value,
        twitterSelect: twitterSelect?.value
      });
      
      if (personajeSelect && twitterSelect) {
        top8Data.top8.push({
          nombre: jugador,
          personaje: personajeSelect.value,
          juego: document.getElementById('gameSel')?.value || '',
          twitter: twitterSelect.value,
          final_rank: parseInt(puesto)
        });
      } else {
        console.warn(`[guardarTop8Actualizado] No se encontraron selects para fila ${index}`);
      }
    });
    // Log para depuración
    console.log('[guardarTop8Actualizado] Datos a guardar:', top8Data);
    // Guardar los datos actualizados
    const resSave = await window.__TAURI__.core.invoke('save-json', { data: top8Data, tipo: 'top8' });
    console.log('[guardarTop8Actualizado] Respuesta del backend:', resSave);
    if (resSave.ok) {
      alert('✅ Top 8 actualizado y guardado correctamente');
    } else {
      alert('❌ Error al guardar Top 8 actualizado');
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}

async function guardarStartggToken() {
  const token = document.getElementById('startggToken').value.trim();
  const msg = document.getElementById('msgStartggToken');
  if (!token) {
    msg.textContent = "❌ Ingresa un token válido.";
    return;
  }
  // Pide la ruta del apikey.json desde el config
  const res = await window.__TAURI__.core.invoke('cargar-rutas');
  if (!res.ok || !res.rutas || !res.rutas.apikey) {
    msg.textContent = "❌ No se ha configurado la ruta de API Key.";
    return;
  }
  const apikeyPath = res.rutas.apikey;
  // Si el archivo no existe, créalo vacío antes de guardar el token
  const fsExists = await window.__TAURI__.core.invoke('leer-apikey-json', { pathStr: apikeyPath });
  if (!fsExists || Object.keys(fsExists).length === 0) {
    await window.__TAURI__.core.invoke('guardar-apikey-token', { pathStr: apikeyPath, token: '' });
  }
  const ok = await window.__TAURI__.core.invoke('guardar-apikey-token', { pathStr: apikeyPath, token });
  if (ok) {
    msg.textContent = `✅ Token guardado en: ${apikeyPath}`;
  } else {
    msg.textContent = `❌ Error al guardar el token en: ${apikeyPath}`;
  }
}

async function cargarStartggToken() {
  const res = await window.__TAURI__.core.invoke('cargar-rutas');
  if (res.ok && res.rutas && res.rutas.apikey) {
    const apikeyPath = res.rutas.apikey;
    const data = await window.__TAURI__.core.invoke('leer-apikey-json', { pathStr: apikeyPath });
    if (data && data.startgg) {
      document.getElementById('startggToken').value = data.startgg;
    }
  }
}
// Cargar el token de Start.gg automáticamente al abrir la pestaña
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('startggToken')) {
    cargarStartggToken();
  }
  // Cargar el último slug buscado en el input
  const ultimoSlug = localStorage.getItem('ultimoStartggSlug');
  if (ultimoSlug && document.getElementById('startggSlug')) {
    document.getElementById('startggSlug').value = ultimoSlug;
  }
});

async function consultarMatchesStartGG(eventIdInput, eventName) {
  const eventId = Number(eventIdInput);
  const resultsDiv = document.getElementById('startggResults');
  resultsDiv.textContent = "Buscando brackets del evento...";
  try {
    const res = await window.__TAURI__.core.invoke('startgg-get-matches', { eventId });
    console.log('Respuesta startgg-get-matches:', res);
    if (res.error) {
      resultsDiv.textContent = "❌ " + res.error;
      return;
    }
    if (res.ok && res.sets && res.sets.length > 0) {
      // Primero filtrar todos los matches en progreso con dos luchadores
      const matchesEnProgreso = res.sets.filter(set => {
        const p1 = set.slots[0]?.entrant?.name || 'TBD';
        const p2 = set.slots[1]?.entrant?.name || 'TBD';
        const s1 = set.slots[0]?.standing?.stats?.score?.value;
        const s2 = set.slots[1]?.standing?.stats?.score?.value;

        const tieneDosLuchadores = p1 !== 'TBD' && p2 !== 'TBD';
        const sinGanador = !set.winnerId && !set.winner_id;
        // Considerar en progreso solo si no hay ganador Y los scores son nulos, undefined o 0.
        const scoresEnCero = (s1 === null || s1 === undefined || s1 === 0) && (s2 === null || s2 === undefined || s2 === 0);

        return tieneDosLuchadores && sinGanador && scoresEnCero;
      });
      
      if (matchesEnProgreso.length === 0) {
        resultsDiv.innerHTML = `<div style='color:#e67e22; font-size:0.95em;'>No hay matches en progreso con dos luchadores en este evento.</div>`;
        return;
      }
      
      // Extraer brackets únicos solo de los matches en progreso
      const bracketsMap = new Map();
      matchesEnProgreso.forEach(set => {
        const fase = set.fase || 'Sin fase';
        const round = set.fullRoundText || 'Sin ronda';
        
        // Determinar categoría principal basada en el texto de la ronda y fase
        let category = '';
        const roundLower = round.toLowerCase();
        const faseLower = fase.toLowerCase();
        const combined = `${faseLower} ${roundLower}`;
        
        if (combined.includes('grand final') || combined.includes('grandfinal')) {
          category = 'Grand Final';
        } else if (combined.includes('losers final') || combined.includes('loser final')) {
          category = 'Losers Final';
        } else if (combined.includes('winners final') || combined.includes('winner final')) {
          category = 'Winners Final';
        } else if (combined.includes('top 8') || combined.includes('top8') || 
                   combined.includes('quarter') || combined.includes('semifinals') ||
                   combined.includes('semi final')) {
          category = 'Top 8';
        } else if (combined.includes('top 16') || combined.includes('top16')) {
          category = 'Top 16';
        } else if (combined.includes('top 32') || combined.includes('top32')) {
          category = 'Top 32';
        } else if (combined.includes('top 64') || combined.includes('top64')) {
          category = 'Top 64';
        } else if (combined.includes('pools') || combined.includes('pool')) {
          category = 'Pools';
        } else if (combined.includes('bracket')) {
          category = 'Brackets';
        } else {
          // Para otras rondas, usar el nombre de la fase o ronda más descriptiva
          category = fase.length > round.length ? fase : round;
        }
        
        const key = `${category}|${fase}|${round}`;
        
        if (!bracketsMap.has(key)) {
          bracketsMap.set(key, {
            category: category,
            fase: fase,
            round: round,
            displayName: fase === round ? fase : `${fase} - ${round}`,
            count: 0
          });
        }
        bracketsMap.get(key).count++;
      });
      
      if (bracketsMap.size === 0) {
        resultsDiv.innerHTML = `<div style='color:#e67e22; font-size:0.95em;'>No se encontraron fases con matches en progreso en este evento.</div>`;
        return;
      }
      
      // Ordenar categorías por importancia
      const categoryOrder = ['Grand Final', 'Losers Final', 'Winners Final', 'Top 8', 'Top 16', 'Top 32', 'Top 64', 'Brackets', 'Pools'];
      const sortedBrackets = Array.from(bracketsMap.entries()).sort((a, b) => {
        const orderA = categoryOrder.indexOf(a[1].category);
        const orderB = categoryOrder.indexOf(b[1].category);
        
        if (orderA === -1 && orderB === -1) return a[1].category.localeCompare(b[1].category);
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      });
      
      // Mostrar selector de brackets
      let html = `
        <div style='color:#ffe8b2; font-size:1.1em; margin-bottom:1em; font-weight:bold;'>
          📋 Fases con matches en progreso (${matchesEnProgreso.length} total):
        </div>
        <div style='margin-bottom:1em;'>
          <input type='text' id='globalMatchSearchInput' placeholder='🔍 Buscar jugador en todas las rondas...' 
            style='
              width:100%; max-width:400px; padding:0.7em 1em; border-radius:8px; 
              border:1px solid #8e44ad; background:#23243a; color:#ffe8b2;
              font-size:0.95em; font-family:Montserrat,sans-serif; margin-bottom:0.7em;
            '
            oninput='filtrarMatchesGlobal()'
          />
        </div>
        <div id='globalMatchesResults'></div>
        <div style='margin-bottom:1em;'>
          <select id='bracketSelector' style='
            background:#23243a; color:#ffe8b2; border:1px solid #8e44ad; border-radius:6px;
            padding:0.5em 1em; font-size:1em; width:100%; max-width:400px;
          '>
            <option value=''>-- Selecciona una fase --</option>
      `;
      
      sortedBrackets.forEach(([key, bracket]) => {
        html += `<option value='${key}'>${bracket.category} (${bracket.count} matches)</option>`;
      });
      
      html += `
          </select>
          <button class='sb-btn' style='
            background:#8e44ad; color:#fff; font-weight:bold; margin-left:1em;
            border-radius:7px; padding:0.5em 1.5em;
          ' onclick='mostrarMatchesDeBracket(${eventId}, "${eventName}")'>
            <i class="fa fa-eye"></i> Ver Matches
          </button>
          <button class='sb-btn' style='
            background:#27ae60; color:#fff; font-weight:bold; margin-left:0.5em;
            border-radius:7px; padding:0.5em 1.2em;
          ' onclick='actualizarMatches(${eventId}, "${eventName}")' 
          title='Actualizar matches en tiempo real'>
            <i class="fa fa-refresh"></i> Actualizar
          </button>
        </div>
        <div id='bracketMatches'></div>
      `;
      
      resultsDiv.innerHTML = html;
      
      // Guardar los sets en una variable global para acceso posterior
      window.currentEventSets = res.sets;

      // --- Buscador global de matches por nick ---
      window.globalMatchesEnProgreso = matchesEnProgreso;
      window.eventIdActual = eventId;
      window.eventNameActual = eventName;
      // Inicializar resultados vacíos
      filtrarMatchesGlobal();
      
      // Poblar selector en scoreboard (ya no es necesario, se maneja desde el widget)
      // poblarSelectorMatchesEnScoreboard(matchesEnProgreso);
      
    } else {
      resultsDiv.innerHTML = `<div style='color:#e67e22; font-size:0.95em;'>No se encontraron matches en este evento.</div>`;
    }
  } catch (error) {
    console.error('Error consultando matches:', error);
    resultsDiv.textContent = "❌ Error al consultar matches: " + error.message;
  }
}

// Buscador global de matches por nick en todas las rondas
function filtrarMatchesGlobal() {
  const input = document.getElementById('globalMatchSearchInput');
  const resultsDiv = document.getElementById('globalMatchesResults');
  if (!input || !resultsDiv || !window.globalMatchesEnProgreso) return;
  const searchTerm = input.value.toLowerCase().trim();
  let filtered = [];
  if (searchTerm === '') {
    resultsDiv.innerHTML = '';
    return;
  }
  filtered = window.globalMatchesEnProgreso.filter(set => {
    const p1 = set.slots[0]?.entrant?.name?.toLowerCase() || '';
    const p2 = set.slots[1]?.entrant?.name?.toLowerCase() || '';
    return p1.includes(searchTerm) || p2.includes(searchTerm);
  });
  if (filtered.length === 0) {
    resultsDiv.innerHTML = `<div style='color:#e67e22; font-size:0.95em; margin-bottom:0.7em;'>No se encontraron matches con ese nick.</div>`;
    return;
  }
  let html = `<div style='color:#ffe8b2; font-size:1em; margin-bottom:0.5em; font-weight:bold;'>🥊 Matches encontrados (${filtered.length}):</div>`;
  html += `<div style='display:grid; grid-template-columns:repeat(3, 1fr); gap:0.8em;'>`;
  filtered.forEach((set, index) => {
    const p1 = set.slots[0]?.entrant?.name || 'TBD';
    const p2 = set.slots[1]?.entrant?.name || 'TBD';
    const s1 = set.slots[0]?.standing?.stats?.score?.value ?? '';
    const s2 = set.slots[1]?.standing?.stats?.score?.value ?? '';
    const round = set.fullRoundText || '';
    const faseOriginal = set.fase || '';
    let roundDisplay = round;
    if (faseOriginal) {
      const faseOriginalLower = faseOriginal.toLowerCase();
      if (faseOriginalLower.includes('round') || 
          faseOriginalLower.includes('bracket') ||
          (faseOriginalLower.includes('pool') && !faseOriginalLower.includes('top'))) {
        roundDisplay = round + ' - Pools';
      }
    }
    html += `
      <button class="sb-btn match-item" data-index="${index}" data-players="${p1.toLowerCase()} ${p2.toLowerCase()}" style='
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        background:#23243a; color:#ffe8b2; border-radius:8px; border:1px solid #8e44ad;
        box-shadow:0 1px 4px #0003; padding:0.8em 0.6em; height:auto; min-height:80px;
        font-size:0.85em; font-family:Montserrat,sans-serif; font-weight:500;
        transition:background .18s,box-shadow .18s; cursor:pointer; text-align:center;
      '
      onclick="enviarMatchAlScoreboard('${escapeQuotes(p1)}','${escapeQuotes(p2)}','${s1}','${s2}','${escapeQuotes(roundDisplay)}','${escapeQuotes(faseOriginal)}')"
      onmouseover="this.style.background='#2a2b42'" 
      onmouseout="this.style.background='#23243a'"
      title="Enviar al scoreboard">
        <div style='font-weight:bold; margin-bottom:0.4em; font-size:0.95em; line-height:1.2;'>
          ${p1} <span style='color:#27ae60;'>${s1}</span> vs <span style='color:#e67e22;'>${s2}</span> ${p2}
        </div>
        <div style='font-size:0.8em; color:#aaa; line-height:1.1;'>
          ${roundDisplay}
        </div>
      </button>
    `;
  });
  html += '</div>';
  resultsDiv.innerHTML = html;
}
// Nueva función para mostrar matches de un bracket específico
function mostrarMatchesDeBracket(eventId, eventName) {
  const selector = document.getElementById('bracketSelector');
  const selectedBracket = selector.value;
  
  if (!selectedBracket) {
    alert('Por favor selecciona una fase.');
    return;
  }
  
  const [category, fase, round] = selectedBracket.split('|');
  const setsDelBracket = window.currentEventSets.filter(set => {
    const setFase = set.fase || 'Sin fase';
    const setRound = set.fullRoundText || 'Sin ronda';
    return setFase === fase && setRound === round;
  });
  
  // Filtrar solo matches con dos luchadores y en progreso
  const matchesEnProgreso = setsDelBracket.filter(set => {
    const p1 = set.slots[0]?.entrant?.name || 'TBD';
    const p2 = set.slots[1]?.entrant?.name || 'TBD';
    
    const tieneDosLuchadores = p1 !== 'TBD' && p2 !== 'TBD';
    const sinGanador = !set.winnerId && !set.winner_id;
    
    return tieneDosLuchadores && sinGanador;
  });
  
  const bracketMatchesDiv = document.getElementById('bracketMatches');
  
  if (matchesEnProgreso.length === 0) {
    bracketMatchesDiv.innerHTML = `
      <div style='color:#e67e22; font-size:0.95em; margin-top:1em; padding:1em; background:#332222; border-radius:8px;'>
        📋 No hay matches en progreso con dos luchadores en ${category}.
      </div>
    `;
    return;
  }
  
  let html = `
    <div style='color:#ffe8b2; font-size:1em; margin:1em 0 0.5em 0; font-weight:bold;'>
      🥊 Matches de ${category} (${matchesEnProgreso.length} en progreso):
    </div>
    <div style='margin-bottom:1em;'>
      <input type='text' id='matchSearchInput' placeholder='🔍 Buscar match por nombre de jugador...' 
        style='
          width:100%; max-width:400px; padding:0.7em 1em; border-radius:8px; 
          border:1px solid #8e44ad; background:#23243a; color:#ffe8b2;
          font-size:0.95em; font-family:Montserrat,sans-serif;
        '
        oninput='filtrarMatches()'
      />
    </div>
    <div id='matchesGrid' style='display:grid; grid-template-columns:repeat(3, 1fr); gap:0.8em; margin-top:0.8em;'>
  `;
  
  matchesEnProgreso.forEach((set, index) => {
    const p1 = set.slots[0]?.entrant?.name || 'TBD';
    const p2 = set.slots[1]?.entrant?.name || 'TBD';
    const s1 = set.slots[0]?.standing?.stats?.score?.value ?? '';
    const s2 = set.slots[1]?.standing?.stats?.score?.value ?? '';
    const round = set.fullRoundText || '';
    const faseOriginal = set.fase || '';
    
    // Determinar si se debe agregar " - Pools" al texto del round
    let roundDisplay = round;
    if (faseOriginal) {
      const faseOriginalLower = faseOriginal.toLowerCase();
      // Si la fase original es Round 1, Round 2, Bracket, etc. (no Top 8, Top 16, etc.)
      if (faseOriginalLower.includes('round') || 
          faseOriginalLower.includes('bracket') ||
          (faseOriginalLower.includes('pool') && !faseOriginalLower.includes('top'))) {
        roundDisplay = round + ' - Pools';
      }
    }
    
    html += `
      <button class="sb-btn match-item" data-index="${index}" data-players="${p1.toLowerCase()} ${p2.toLowerCase()}" style='
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        background:#23243a; color:#ffe8b2; border-radius:8px; border:1px solid #8e44ad;
        box-shadow:0 1px 4px #0003; padding:0.8em 0.6em; height:auto; min-height:80px;
        font-size:0.85em; font-family:Montserrat,sans-serif; font-weight:500;
        transition:background .18s,box-shadow .18s; cursor:pointer; text-align:center;
      '
      onclick="enviarMatchAlScoreboard('${escapeQuotes(p1)}','${escapeQuotes(p2)}','${s1}','${s2}','${escapeQuotes(roundDisplay)}','${escapeQuotes(faseOriginal)}')"
      onmouseover="this.style.background='#2a2b42'" 
      onmouseout="this.style.background='#23243a'"
      title="Enviar al scoreboard">
        <div style='font-weight:bold; margin-bottom:0.4em; font-size:0.95em; line-height:1.2;'>
          ${p1} <span style='color:#27ae60;'>${s1}</span> vs <span style='color:#e67e22;'>${s2}</span> ${p2}
        </div>
        <div style='font-size:0.8em; color:#aaa; line-height:1.1;'>
          ${roundDisplay}
        </div>
      </button>
    `;
  });
  
  html += '</div>';
  bracketMatchesDiv.innerHTML = html;
}

// Función para filtrar matches en tiempo real
function filtrarMatches() {
  const searchInput = document.getElementById('matchSearchInput');
  const matchItems = document.querySelectorAll('.match-item');
  
  if (!searchInput || !matchItems.length) return;
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  let visibleCount = 0;
  
  matchItems.forEach(item => {
    const players = item.getAttribute('data-players') || '';
    const isVisible = searchTerm === '' || players.includes(searchTerm);
    
    if (isVisible) {
      item.style.display = 'flex';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });
  
  // Actualizar contador de matches visibles
  const titleDiv = document.querySelector('#bracketMatches div:first-child');
  if (titleDiv && searchTerm !== '') {
    const originalText = titleDiv.textContent;
    const baseText = originalText.split('(')[0];
    titleDiv.textContent = `${baseText}(${visibleCount} mostrados de ${matchItems.length})`;
  } else if (titleDiv && searchTerm === '') {
    const originalText = titleDiv.textContent;
    const baseText = originalText.split('(')[0];
    titleDiv.textContent = `${baseText}(${matchItems.length} en progreso)`;
  }
}

// Función para actualizar matches en tiempo real
async function actualizarMatches(eventId, eventName) {
  const updateBtn = document.querySelector('button[onclick*="actualizarMatches"]');
  const originalText = updateBtn.innerHTML;
  
  // Mostrar estado de carga
  updateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Actualizando...';
  updateBtn.disabled = true;
  updateBtn.style.background = '#6c757d';
  
  try {
    // Volver a consultar los matches del evento
    await consultarMatchesStartGG(eventId, eventName);
    
    // Si hay un bracket seleccionado, mostrar automáticamente sus matches actualizados
    const bracketSelector = document.getElementById('bracketSelector');
    if (bracketSelector && bracketSelector.value) {
      mostrarMatchesDeBracket(eventId, eventName);
    }
    
    // Mostrar mensaje de éxito temporal
    updateBtn.innerHTML = '<i class="fa fa-check"></i> Actualizado';
    updateBtn.style.background = '#27ae60';
    
    setTimeout(() => {
      updateBtn.innerHTML = originalText;
      updateBtn.style.background = '#27ae60';
      updateBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Error actualizando matches:', error);
    
    // Mostrar error temporal
    updateBtn.innerHTML = '<i class="fa fa-exclamation-triangle"></i> Error';
    updateBtn.style.background = '#e74c3c';
    
    setTimeout(() => {
      updateBtn.innerHTML = originalText;
      updateBtn.style.background = '#27ae60';
      updateBtn.disabled = false;
    }, 3000);
  }
}

// Helper para escapar comillas simples/dobles en nombres
function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function enviarMatchAlScoreboard(p1, p2, s1, s2, round, fase) {
  // Hacer esta función síncrona pero usar async internamente
  (async () => {
    // Leer comentaristas existentes antes de actualizar
    let comentaristasExistentes = [];
    try {
      const resLoad = await window.__TAURI__.core.invoke('load-json', { tipo: 'scoreboard' });
      if (resLoad.ok && resLoad.data && resLoad.data.comentaristas) {
        comentaristasExistentes = resLoad.data.comentaristas;
      }
    } catch (e) {
      console.warn('No se pudieron cargar comentaristas existentes:', e);
    }

    // Preservar comentaristas en variable global ANTES de cambiar la UI
    window.comentaristasPreservados = comentaristasExistentes;
    console.log('[StartGG] Comentaristas preservados:', comentaristasExistentes);
  })();

  showTab(0);

  // Extraer tag y nombre si existe el delimitador '|'
  function splitTagName(str) {
    console.log('[splitTagName] Input recibido:', str, 'Tipo:', typeof str);
    if (!str || str === undefined || str === null || str === '') {
      console.log('[splitTagName] String vacío/nulo, retornando tag y name vacíos');
      return { tag: '', name: '' };
    }
    const parts = str.split('|');
    if (parts.length === 2) {
      const result = { tag: parts[0].trim(), name: parts[1].trim() };
      console.log('[splitTagName] Split con |, resultado:', result);
      return result;
    }
    const result = { tag: '', name: str.trim() };
    console.log('[splitTagName] Sin split, resultado:', result);
    return result;
  }
  const p1Data = splitTagName(p1);
  const p2Data = splitTagName(p2);
  
  console.log('[enviarMatchAlScoreboard] p1Data:', p1Data, 'p2Data:', p2Data);

  document.getElementById('p1NameInput').value = p1Data.name;
  document.getElementById('p2NameInput').value = p2Data.name;
  document.getElementById('p1TagInput').value = p1Data.tag;
  document.getElementById('p2TagInput').value = p2Data.tag;
  
  // Para matches en progreso, establecer scores como 0-0
  document.getElementById('p1Score').textContent = '0';
  document.getElementById('p2Score').textContent = '0';
  
  // Siempre actualizar el campo de ronda con la información de Start.gg
  const sbRoundElement = document.getElementById('sbRound');
  sbRoundElement.value = round;

  document.getElementById('p1Name').textContent = p1Data.name;
  document.getElementById('p2Name').textContent = p2Data.name;

  // Guarda el round y la fase en variables globales para que el Scoreboard los incluya
  window.currentRoundName = round;
  window.currentFaseOriginal = fase || '';

  // Esperar un poco antes de guardar para asegurar que la variable global esté lista
  setTimeout(() => {
    if (typeof guardarScoreboard === "function") {
      guardarScoreboard();
    }
  }, 100);
}

// === GUARDAR BRACKET BUTTON ===
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnGuardarBracket');
  if (btn) {
    btn.addEventListener('click', async () => {
      // Usa el nombre del torneo actual y la fecha actual
      const torneo = window.nombreTorneoActual || '';
      const fecha = new Date().toLocaleDateString('es-CL');
      // Busca los matches cargados en la última consulta
      if (!window.ultimoStartggSets || !window.ultimoStartggSets.length) {
        alert('No hay matches cargados para guardar.');
        return;
      }
      await guardarBracketEnJson(torneo, fecha, window.ultimoStartggSets);
    });
  }
});

// Guarda el bracket en bracket.json
async function guardarBracketEnJson(torneo, fecha, sets) {



  // Obtener los phaseId únicos de los sets
  const phaseIdSet = new Set();
  sets.forEach(set => {
    if (set.phaseId || set.phase_id) phaseIdSet.add(set.phaseId || set.phase_id);
  });
  const phaseIds = Array.from(phaseIdSet).map(Number);

  // Log para depuración
  console.log('[Bracket] phaseIds:', phaseIds);

  // Consultar los nombres de fase por phaseId vía IPC
  let phaseNames = {};
  if (phaseIds.length > 0) {
    try {
      phaseNames = await window.__TAURI__.core.invoke('startgg-get-phase-name', { phaseIds });
      console.log('[Bracket] phaseNames:', phaseNames);
    } catch (e) {
      console.warn('[Bracket] Error consultando nombres de fase:', e);
      phaseNames = {};
    }
  }

  // Arma los matches y asigna solo el nombre real de la fase
  const matches = sets.map(set => {
    const player1_name = set.player1_name || set.slots?.[0]?.entrant?.name || 'TBD';
    const player2_name = set.player2_name || set.slots?.[1]?.entrant?.name || 'TBD';
    const player1_id = set.player1_id || set.slots?.[0]?.entrant?.id || null;
    const player2_id = set.player2_id || set.slots?.[1]?.entrant?.id || null;
    const player1_sc = set.player1_sc ?? set.slots?.[0]?.standing?.stats?.score?.value ?? '';
    const player2_sc = set.player2_sc ?? set.slots?.[1]?.standing?.stats?.score?.value ?? '';
    const round_name = set.round_name || set.fullRoundText || '';
    const phaseId = set.phaseId || set.phase_id;
    // Preferir el campo 'fase' si viene del backend, si no, usar phaseNames
    let fase = '';
    if (set.fase) {
      fase = set.fase;
    } else if (phaseId && phaseNames[phaseId]) {
      fase = phaseNames[phaseId];
    } else if (phaseId) {
      console.warn(`[Bracket] No se encontró nombre de fase para phaseId: ${phaseId}`);
    }
    let match = {
      id: set.id,
      player1_id,
      player2_id,
      player1_name,
      player2_name,
      round: set.round ?? '',
      scores_csv: `${player1_sc}-${player2_sc}`,
      winner_id: set.winner_id ?? set.winnerId ?? null,
      player1_sc,
      player2_sc,
      round_name,
      fase
    };
    return match;
  });

  // Construye el diccionario de participantes
  const participantes = {};
  matches.forEach(m => {
    if (m.player1_id) participantes[m.player1_id] = m.player1_name;
    if (m.player2_id) participantes[m.player2_id] = m.player2_name;
  });
  const bracketData = { torneo, fecha, matches, participantes };
  const res = await window.__TAURI__.core.invoke('save-bracket-json', { data: bracketData });
  return res;
}

// Helper para inyectar CSS una sola vez
function addStyle(styles) {
    const styleId = 'sgg-dynamic-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = styles;
    document.head.appendChild(style);
}

// ========================================
// FUNCIONES PARA SELECTOR DE MATCHES EN SCOREBOARD
// ========================================

// Mostrar/ocultar el selector de matches en el scoreboard
function mostrarSelectorMatchesEnScoreboard(mostrar = true) {
  const widget = document.getElementById('startggMatchesFloatingWidget');
  if (widget) {
    widget.style.display = mostrar ? 'block' : 'none';
  }
}

// Cerrar el widget flotante
function cerrarStartggWidget() {
  const widget = document.getElementById('startggMatchesFloatingWidget');
  if (widget) {
    widget.style.display = 'none';
  }
}

// Toggle del widget flotante (minimizar/expandir)
function toggleStartggWidget() {
  const content = document.getElementById('startggWidgetContent');
  const icon = document.getElementById('widgetToggleIcon');
  
  if (content && icon) {
    const isMinimized = content.classList.contains('minimized');
    
    if (isMinimized) {
      // Expandir
      content.classList.remove('minimized');
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-up');
    } else {
      // Minimizar
      content.classList.add('minimized');
      icon.classList.remove('fa-chevron-up');
      icon.classList.add('fa-chevron-down');
    }
  }
}

// Agregar torneo al selector del widget
function agregarTorneoAlWidget(torneoNombre, slug, eventos) {
  const tournamentSelector = document.getElementById('startggTournamentSelector');
  if (!tournamentSelector) return;

  // Verificar si ya existe este torneo
  const existingOption = Array.from(tournamentSelector.options).find(option => option.value === slug);
  if (existingOption) {
    // Si ya existe, solo seleccionarlo
    tournamentSelector.value = slug;
  } else {
    // Agregar nueva opción
    const option = document.createElement('option');
    option.value = slug;
    option.textContent = torneoNombre;
    option.dataset.eventos = JSON.stringify(eventos);
    tournamentSelector.appendChild(option);
    
    // Seleccionar automáticamente
    tournamentSelector.value = slug;
  }

  // Cargar eventos automáticamente
  cargarEventosDelTorneo();
  
  // Mostrar el widget
  mostrarSelectorMatchesEnScoreboard(true);
}

// Cargar eventos del torneo seleccionado
function cargarEventosDelTorneo() {
  const tournamentSelector = document.getElementById('startggTournamentSelector');
  const eventSelector = document.getElementById('startggEventSelector');
  const matchSelector = document.getElementById('startggMatchSelector');
  
  if (!tournamentSelector || !eventSelector || !matchSelector) return;

  const selectedTournament = tournamentSelector.value;
  
  if (!selectedTournament) {
    // Ocultar selectores de evento y match
    eventSelector.style.display = 'none';
    matchSelector.style.display = 'none';
    return;
  }

  // Obtener eventos del torneo seleccionado
  const selectedOption = tournamentSelector.options[tournamentSelector.selectedIndex];
  const eventos = JSON.parse(selectedOption.dataset.eventos || '[]');

  // Limpiar y poblar selector de eventos
  eventSelector.innerHTML = '<option value="">Selecciona un evento...</option>';
  
  eventos.forEach(evento => {
    const option = document.createElement('option');
    option.value = evento.id;
    option.textContent = evento.name;
    option.dataset.eventName = evento.name;
    eventSelector.appendChild(option);
  });

  // Mostrar selector de eventos
  eventSelector.style.display = 'block';
  
  // Ocultar selector de matches hasta que se seleccione un evento
  matchSelector.style.display = 'none';
  matchSelector.innerHTML = '<option value="">Selecciona un match...</option>';
}

// Cargar matches del evento seleccionado
async function cargarMatchesDelEvento() {
  const eventSelector = document.getElementById('startggEventSelector');
  const matchSelector = document.getElementById('startggMatchSelector');
  const loadingBar = document.getElementById('matchLoadingBar');
  
  if (!eventSelector || !matchSelector || !loadingBar) return;

  const selectedEventId = eventSelector.value;
  
  if (!selectedEventId) {
    matchSelector.style.display = 'none';
    loadingBar.style.display = 'none';
    matchSelector.innerHTML = '<option value="">Selecciona un match...</option>';
    return;
  }

  const selectedOption = eventSelector.options[eventSelector.selectedIndex];
  const eventName = selectedOption.dataset.eventName;

  // Guardar datos del evento actual
  window.eventIdActual = Number(selectedEventId);
  window.eventNameActual = eventName;

  // Mostrar barra de loading
  matchSelector.style.display = 'none';
  loadingBar.style.display = 'block';

  try {
    // Consultar matches del evento
    const res = await window.__TAURI__.core.invoke('startgg-get-matches', { eventId: Number(selectedEventId) });
    if (res.error) {
      throw new Error(res.error);
    }

    if (res.sets && res.sets.length > 0) {
      // Guardar sets para uso posterior
      window.currentEventSets = res.sets;

      // Filtrar matches en progreso
      const matchesEnProgreso = res.sets.filter(set => {
        const p1 = set.slots[0]?.entrant?.name || 'TBD';
        const p2 = set.slots[1]?.entrant?.name || 'TBD';
        const s1 = set.slots[0]?.standing?.stats?.score?.value;
        const s2 = set.slots[1]?.standing?.stats?.score?.value;

        const tieneDosLuchadores = p1 !== 'TBD' && p2 !== 'TBD';
        const sinGanador = !set.winnerId && !set.winner_id;
        const scoresEnCero = (s1 === null || s1 === undefined || s1 === 0) && (s2 === null || s2 === undefined || s2 === 0);

        return tieneDosLuchadores && sinGanador && scoresEnCero;
      });

      // Ocultar loading y poblar selector de matches
      loadingBar.style.display = 'none';
      poblarSelectorMatchesEnWidget(matchesEnProgreso);
    }
  } catch (error) {
    console.error('Error cargando matches del evento:', error);
    
    // Ocultar loading y mostrar error
    loadingBar.style.display = 'none';
    matchSelector.innerHTML = '<option value="">Error cargando matches</option>';
    matchSelector.style.display = 'block';
  }
}

// Poblar el selector de matches en el widget
function poblarSelectorMatchesEnWidget(matches) {
  const matchSelector = document.getElementById('startggMatchSelector');
  if (!matchSelector) return;
  
  // Limpiar opciones existentes
  matchSelector.innerHTML = '<option value="">Selecciona un match...</option>';
  
  if (!matches || matches.length === 0) {
    matchSelector.innerHTML = '<option value="">No hay matches disponibles</option>';
    matchSelector.style.display = 'none';
    return;
  }
  
  // Agregar matches al selector
  matches.forEach((match, index) => {
    const p1 = match.slots?.[0]?.entrant?.name || 'TBD';
    const p2 = match.slots?.[1]?.entrant?.name || 'TBD';
    const round = match.fullRoundText || match.fase || 'Sin ronda';
    const faseOriginal = match.fase || '';
    
    // Solo mostrar matches con dos jugadores
    if (p1 !== 'TBD' && p2 !== 'TBD') {
      // Aplicar la misma lógica que en las tarjetas para determinar si agregar " - Pools"
      let roundDisplay = round;
      if (faseOriginal) {
        const faseOriginalLower = faseOriginal.toLowerCase();
        if (faseOriginalLower.includes('round') || 
            faseOriginalLower.includes('bracket') ||
            (faseOriginalLower.includes('pool') && !faseOriginalLower.includes('top'))) {
          roundDisplay = round + ' - Pools';
        }
      }
      
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${p1} vs ${p2} (${roundDisplay})`;
      option.dataset.match = JSON.stringify(match);
      matchSelector.appendChild(option);
    }
  });
  
  // Mostrar el selector si hay matches
  matchSelector.style.display = matches.length > 0 ? 'block' : 'none';
}

// Poblar el selector de matches en el scoreboard (función original, mantenida para compatibilidad)
function poblarSelectorMatchesEnScoreboard(matches) {
  // Usar la nueva función del widget
  poblarSelectorMatchesEnWidget(matches);
}

// Cargar match seleccionado en el scoreboard
function cargarMatchStartggEnScoreboard() {
  const selector = document.getElementById('startggMatchSelector');
  if (!selector || !selector.value) {
    alert('Por favor selecciona un match primero.');
    return;
  }
  
  const selectedOption = selector.options[selector.selectedIndex];
  const matchData = JSON.parse(selectedOption.dataset.match);
  
  const p1 = matchData.slots?.[0]?.entrant?.name || 'TBD';
  const p2 = matchData.slots?.[1]?.entrant?.name || 'TBD';
  const s1 = matchData.slots?.[0]?.standing?.stats?.score?.value ?? '';
  const s2 = matchData.slots?.[1]?.standing?.stats?.score?.value ?? '';
  const round = matchData.fullRoundText || matchData.fase || '';
  const faseOriginal = matchData.fase || '';
  
  // Aplicar la misma lógica que en las tarjetas para determinar si agregar " - Pools"
  let roundDisplay = round;
  if (faseOriginal) {
    const faseOriginalLower = faseOriginal.toLowerCase();
    if (faseOriginalLower.includes('round') || 
        faseOriginalLower.includes('bracket') ||
        (faseOriginalLower.includes('pool') && !faseOriginalLower.includes('top'))) {
      roundDisplay = round + ' - Pools';
    }
  }
  
  // Usar la función existente para enviar al scoreboard
  enviarMatchAlScoreboard(p1, p2, s1, s2, roundDisplay, faseOriginal);
}

// Actualizar matches desde Start.gg en el scoreboard
async function actualizarMatchesStartggEnScoreboard() {
  const updateBtn = document.querySelector('button[onclick="actualizarMatchesStartggEnScoreboard()"]');
  const matchSelector = document.getElementById('startggMatchSelector');
  const loadingBar = document.getElementById('matchLoadingBar');
  
  if (!updateBtn) return;
  
  // Si no hay un evento actual cargado, mostrar mensaje
  if (!window.eventIdActual || !window.eventNameActual) {
    alert('No hay un evento de Start.gg cargado. Busca matches desde la pestaña Start.gg primero.');
    return;
  }
  
  const originalText = updateBtn.innerHTML;
  
  // Mostrar estado de carga en el botón
  updateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Actualizando...';
  updateBtn.disabled = true;
  updateBtn.style.background = '#6c757d';
  
  // Mostrar barra de loading y ocultar selector
  if (matchSelector && loadingBar) {
    matchSelector.style.display = 'none';
    loadingBar.style.display = 'block';
    loadingBar.querySelector('.loading-text').textContent = 'Actualizando matches...';
  }
  
  try {
    // Consultar matches actualizados
    const res = await window.__TAURI__.core.invoke('startgg-get-matches', { eventId: window.eventIdActual });
    if (res.error) {
      throw new Error(res.error);
    }
    
    if (res.sets && res.sets.length > 0) {
      // Filtrar matches en progreso
      const matchesEnProgreso = res.sets.filter(set => {
        const p1 = set.slots[0]?.entrant?.name || 'TBD';
        const p2 = set.slots[1]?.entrant?.name || 'TBD';
        const s1 = set.slots[0]?.standing?.stats?.score?.value;
        const s2 = set.slots[1]?.standing?.stats?.score?.value;

        const tieneDosLuchadores = p1 !== 'TBD' && p2 !== 'TBD';
        const sinGanador = !set.winnerId && !set.winner_id;
        const scoresEnCero = (s1 === null || s1 === undefined || s1 === 0) && (s2 === null || s2 === undefined || s2 === 0);

        return tieneDosLuchadores && sinGanador && scoresEnCero;
      });
      
      // Ocultar loading y actualizar el selector
      if (loadingBar) {
        loadingBar.style.display = 'none';
      }
      poblarSelectorMatchesEnWidget(matchesEnProgreso);
      
      // Mostrar mensaje de éxito temporal
      updateBtn.innerHTML = '<i class="fa fa-check"></i> Actualizado';
      updateBtn.style.background = '#27ae60';
    } else {
      throw new Error('No se encontraron matches');
    }
    
  } catch (error) {
    console.error('Error actualizando matches en scoreboard:', error);
    
    // Ocultar loading en caso de error
    if (loadingBar) {
      loadingBar.style.display = 'none';
    }
    if (matchSelector) {
      matchSelector.innerHTML = '<option value="">Error actualizando matches</option>';
      matchSelector.style.display = 'block';
    }
    
    // Mostrar error temporal
    updateBtn.innerHTML = '<i class="fa fa-exclamation-triangle"></i> Error';
    updateBtn.style.background = '#e74c3c';
  }
  
  // Restaurar botón después de 2 segundos
  setTimeout(() => {
    updateBtn.innerHTML = originalText;
    updateBtn.style.background = '#8e44ad';
    updateBtn.disabled = false;
    
    // Restaurar texto de loading
    if (loadingBar) {
      loadingBar.querySelector('.loading-text').textContent = 'Cargando matches...';
    }
  }, 2000);
}

// Guardar bracket desde el widget flotante
async function guardarBracketStartggDesdeWidget() {
  const bracketBtn = document.querySelector('button[onclick="guardarBracketStartggDesdeWidget()"]');
  if (!bracketBtn) return;

  // Si no hay un evento actual cargado, mostrar mensaje
  if (!window.eventIdActual || !window.eventNameActual) {
    alert('No hay un evento de Start.gg cargado. Busca matches desde la pestaña Start.gg primero.');
    return;
  }

  // Inyectar CSS para la animación (reutilizar el mismo estilo)
  addStyle(`
    .loading-btn {
      position: relative;
      overflow: hidden;
      pointer-events: none !important;
    }
    .loading-btn .loading-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: linear-gradient(90deg, #e74c3c, #c0392b);
      width: 0%;
      transition: width 2s ease-in-out;
      z-index: 1;
    }
    .loading-btn .btn-content {
      position: relative;
      z-index: 2;
      color: white !important;
      font-weight: bold;
    }
  `);

  // Guardar estado original del botón
  const originalHTML = bracketBtn.innerHTML;
  const originalStyle = bracketBtn.style.cssText;
  const originalClass = bracketBtn.className;

  // Preparar botón para loading
  bracketBtn.disabled = true;
  bracketBtn.className = originalClass + ' loading-btn';
  bracketBtn.innerHTML = '<span class="loading-bar"></span><span class="btn-content">Guardando...</span>';

  try {
    // Iniciar animación de carga
    setTimeout(() => {
      const loadingBar = bracketBtn.querySelector('.loading-bar');
      if (loadingBar) {
        loadingBar.style.width = '100%';
      }
    }, 50);

    // Obtener matches del evento - SIEMPRE hacer la consulta para datos frescos
    const res = await window.__TAURI__.core.invoke('startgg-get-matches', { eventId: window.eventIdActual });
    if (res.error) {
      throw new Error(res.error);
    }
    if (!res.sets || res.sets.length === 0) {
      throw new Error('No se encontraron matches para guardar.');
    }

    // Guardar bracket usando la función existente
    const torneo = window.eventNameActual || '';
    const fecha = new Date().toLocaleDateString('es-CL');
    const saveResult = await guardarBracketEnJson(torneo, fecha, res.sets);

    if (!saveResult.ok) {
      throw new Error(saveResult.error || 'Error desconocido al guardar');
    }

    // Mostrar éxito
    bracketBtn.innerHTML = '<span class="btn-content"><i class="fa fa-check"></i> ¡Guardado!</span>';
    bracketBtn.style.background = '#27ae60';
    bracketBtn.style.border = '2px solid #2ecc71';

  } catch (e) {
    // Mostrar error
    bracketBtn.innerHTML = '<span class="btn-content"><i class="fa fa-exclamation-triangle"></i> Error</span>';
    bracketBtn.style.background = '#e74c3c';
    bracketBtn.style.border = '2px solid #c0392b';
    console.error('Error guardando bracket desde widget:', e);
    alert('Error: ' + e.message);
  }

  // Restaurar botón después de 3 segundos
  setTimeout(() => {
    bracketBtn.innerHTML = originalHTML;
    bracketBtn.style.cssText = originalStyle;
    bracketBtn.className = originalClass;
    bracketBtn.disabled = false;
  }, 3000);
}

