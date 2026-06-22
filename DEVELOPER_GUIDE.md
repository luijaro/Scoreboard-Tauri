# Guía del Desarrollador - Streamcontrol MS (Tauri App)

Esta documentación está diseñada para servir como mapa del proyecto, permitiendo localizar rápidamente dónde se define cada función y cómo interactúan el frontend y el backend de Tauri.

---

## 🗺️ Mapa del Directorio y Estructura del Código

El proyecto está dividido en dos partes principales:
1. **Frontend (HTML/CSS/JS):** Ubicado en la carpeta `src/`.
2. **Backend (Rust):** Ubicado en la carpeta `src-tauri/`.

```
Scoreboard-Tauri/
├── DEVELOPER_GUIDE.md          <-- Esta guía
├── package.json                <-- Configuración de NPM, scripts y dependencias frontend
├── scripts/                    <-- Scripts de automatización
│   ├── release.cjs             <-- Script de publicación y generación de updater
│   └── release.js
├── src/                        <-- Código del Frontend (UI)
│   ├── index.html              <-- Estructura principal y pestañas de la aplicación
│   ├── js/
│   │   ├── scoreboard.js       <-- Lógica del marcador, temporizador, OBS e inicio
│   │   ├── startgg.js          <-- Lógica de integración con Start.gg API
│   │   ├── bracket-visual.js   <-- Dibujado visual del bracket en la interfaz
│   │   └── utils.js            <-- Utilidades comunes
│   └── css/
│       └── ...                 <-- Hojas de estilo
└── src-tauri/                  <-- Código del Backend (Rust)
    ├── tauri.conf.json         <-- Configuración de compilación, permisos y updater de Tauri
    ├── Cargo.toml              <-- Dependencias de Rust
    └── src/
        ├── main.rs             <-- Punto de entrada Rust
        ├── lib.rs              <-- Registro de comandos de Tauri y setup de la app
        ├── files.rs            <-- Lectura/Escritura de JSONs y gestión del Workspace
        ├── challonge.rs        <-- API de Challonge (obtención de matches, torneos y reportes)
        ├── startgg.rs          <-- API de Start.gg (consultas GraphQL de torneos)
        └── streamdeck.rs       <-- Servidor WebSocket para integración con Stream Deck
```

---

## 🦀 Backend (Rust) - Directorio `src-tauri/src/`

El backend gestiona operaciones con archivos locales, APIs externas seguras, y el servidor WebSocket.

### 1. [lib.rs](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src-tauri/src/lib.rs)
Es el archivo principal donde se configuran y registran todos los comandos de Tauri que el frontend puede invocar usando `window.__TAURI__.core.invoke()`.
* **Funciones Clave:**
  - `run()`: Inicializa Tauri, carga los plugins (updater, dialog) e inicia el servidor de Stream Deck.
  - `get_app_version()`: Retorna la versión actual.
  - `check_for_updates_manual()`: Dispara la verificación manual de actualizaciones.

### 2. [files.rs](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src-tauri/src/files.rs)
Maneja el sistema de archivos del usuario (guardar y cargar JSONs) y el selector de rutas.
* **Funciones Clave:**
  - `elegir_directorio_workspace()`: Abre el selector para definir la carpeta del torneo y crea los JSONs/TXTs por defecto si no existen.
  - `save_json()` y `load_json()`: Guardan y leen datos de `scoreboard.json`, `casters.json`, `timestamp.json`, etc.
  - `guardar_rutas()` y `cargar_rutas()`: Persiste y lee las rutas personalizadas definidas en `rutas.json`.
  - `leer_personajes_txt()` y `leer_usuarios_txt()`: Lee archivos de texto locales para el Top 8.
  - `get_personajes()`: Escanea el directorio de personajes del juego correspondiente y retorna sus nombres y rutas de imagen.

### 3. [challonge.rs](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src-tauri/src/challonge.rs)
Realiza las peticiones a la API REST de Challonge.
* **Funciones Clave:**
  - `get_tournaments()`: Lista los torneos de la cuenta asociada.
  - `get_matches_and_participants()`: Obtiene la lista de enfrentamientos y jugadores.
  - `report_match_score()`: Sube un resultado de match a Challonge.

### 4. [startgg.rs](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src-tauri/src/startgg.rs)
Realiza las consultas GraphQL a la API de Start.gg.
* **Funciones Clave:**
  - `query_startgg()`: Función base que realiza peticiones HTTP POST con GraphQL.
  - `get_startgg_tournaments()` / `get_startgg_matches()`: Funciones específicas de consulta de datos.

### 5. [streamdeck.rs](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src-tauri/src/streamdeck.rs)
Levanta un servidor WebSocket local (`127.0.0.1:3001`) para conectarse al plugin de Stream Deck.
* **Funciones Clave:**
  - `start_streamdeck_server()`: Inicia el WebSocket.
  - `broadcast_scoreboard_update()`: Envía los datos actualizados del marcador en tiempo real a los clientes conectados.

---

## 🌐 Frontend (HTML/JS) - Directorio `src/`

### 1. [index.html](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src/index.html)
Contiene la UI completa estructurada en pestañas (`tab-panel`).
* **Secciones:**
  - **Marcador:** Panel principal para cambiar nombres, puntajes, personajes, lunas y ronda.
  - **Comentaristas:** Gestión de casters activos y temporizador.
  - **Challonge:** Sincronización y visualización del bracket del torneo y gestión de Top 8.
  - **Start.gg:** Búsqueda e integración directa de torneos de Start.gg.
  - **Rutas:** Configuración de rutas personalizadas y botón Workspace.

### 2. [scoreboard.js](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src/js/scoreboard.js)
Mapea los eventos de la interfaz principal del marcador y orquesta el flujo de guardado.
* **Funciones Clave:**
  - `cambiarJuego()`: Lee la carpeta de personajes según el juego seleccionado, los carga, puebla los dropdowns de personajes y autoselecciona el primero si no hay coincidencia válida.
  - `guardarScoreboard()`: Invoca al comando Rust `save_json` para escribir en `scoreboard.json` y avisa a Stream Deck de los cambios.
  - `updateVisual()`: Actualiza en tiempo real los textos en pantalla del marcador.
  - `swap()`: Intercambia los datos, puntuaciones y personajes de P1 y P2.
  - `fijarTimer()` / `resetearTimer()`: Controladores del temporizador regresivo.
  - `conectarOBS()` / `cambiarEscenaOBS()`: Gestión de OBS Studio vía WebSocket.

### 3. [startgg.js](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src/js/startgg.js)
Controla la comunicación del widget de Start.gg.
* **Funciones Clave:**
  - `buscarStartggDesdeWidget()`: Inicia la búsqueda de torneos por texto.
  - `cargarMatchStartggEnScoreboard()`: Transfiere los jugadores del match de Start.gg seleccionado directamente a la pestaña del Scoreboard.

### 4. [bracket-visual.js](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/src/js/bracket-visual.js)
Lógica para renderizar un esquema visual del bracket directamente en la UI del programa.

---

## 🚀 Proceso de Compilación y Publicación (Releases)

Las compilaciones de lanzamiento y publicación automática se gestionan mediante el script [release.cjs](file:///c:/Users/Luijaro/Downloads/Scoreboard-main/Scoreboard-Tauri/scripts/release.cjs):
1. **Comando para iniciar publicación:** `npm run release`
2. **Variables de entorno necesarias (en PowerShell):**
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY="<CLAVE_PRIVADA_LARGA_DE_TAURI_SIGNER>"
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<CONTRASEÑA>"
   ```
3. El script automatiza:
   - Incremento del número de versión en `package.json`, `Cargo.toml` y `tauri.conf.json`.
   - Ejecución de `npm run tauri build` para empaquetar la app.
   - Creación del tag y push a Git.
   - Generación de `latest.json` con la firma y URL correcta (con `%20` en lugar de espacios).
   - Creación del release en tu repositorio GitHub y subida de archivos correspondientes.
