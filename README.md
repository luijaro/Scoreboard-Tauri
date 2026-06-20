# Streamcontrol MS (Tauri Edition)

Streamcontrol MS es una aplicación de escritorio desarrollada con **Tauri, Rust y JavaScript** diseñada para facilitar la administración y el control de marcadores, brackets, y overlays en transmisiones en vivo de torneos de videojuegos de lucha (Fighting Games).

---

## Características Principales
* **Panel de Scoreboard**: Control en tiempo real de nombres de jugadores, tags de patrocinadores, puntajes, banderas de países y selección de personajes.
* **Integración con Plataformas de Torneos**:
  * **Start.gg**: Búsqueda directa, generación de brackets visuales y Top 8 en base al ID del evento.
  * **Challonge**: Sincronización en tiempo real de torneos, matches y Top 8 sincronizado espejo entre la pestaña principal y el panel rápido lateral.
* **Temporizador Inteligente**: Cuenta regresiva para pausas de transmisión que se mantiene activa y se auto-recupera al navegar entre las pestañas del programa.
* **Integración de OBS y Twitch**: Conexión directa a OBS WebSocket y comandos de chat a través del bot de Twitch.

---

## 🎮 Integración y Manual con Elgato Stream Deck

Streamcontrol MS incluye un **servidor web HTTP local** integrado que corre de manera silenciosa en segundo plano en el puerto **3001** (`http://127.0.0.1:3001`). Esto permite controlar casi todas las acciones del marcador presionando un botón físico en tu consola de Stream Deck.

### 1. Lista de Endpoints Disponibles (Comandos HTTP)

Todos los comandos se ejecutan a través de peticiones tipo `GET`. Puedes probarlos directamente escribiéndolos en la barra de direcciones de tu navegador web:

| Acción | URL del Comando (Endpoint) | Descripción |
| :--- | :--- | :--- |
| **Comprobar Conexión** | `http://127.0.0.1:3001/` | Devuelve `{"status": "active"}` si la app está abierta. |
| **Aumentar Score P1** | `http://127.0.0.1:3001/score/player1/+1` | Suma +1 al puntaje del Jugador 1. |
| **Disminuir Score P1** | `http://127.0.0.1:3001/score/player1/-1` | Resta -1 al puntaje del Jugador 1. |
| **Aumentar Score P2** | `http://127.0.0.1:3001/score/player2/+1` | Suma +1 al puntaje del Jugador 2. |
| **Disminuir Score P2** | `http://127.0.0.1:3001/score/player2/-1` | Resta -1 al puntaje del Jugador 2. |
| **Intercambiar Lados** | `http://127.0.0.1:3001/swap-players` | Intercambia nombres, tags, scores, fotos de personajes y banderas entre P1 y P2. |
| **Resetear Marcador** | `http://127.0.0.1:3001/reset-scores` | Pone ambos puntajes a `0`. |
| **Iniciar Temporizador** | `http://127.0.0.1:3001/timer/{minutos}` | Inicia el cronómetro (ej: `http://127.0.0.1:3001/timer/5` para 5 minutos). |
| **Resetear Temporizador**| `http://127.0.0.1:3001/timer/reset` | Detiene y limpia el temporizador. |
| **Cambiar Juego** | `http://127.0.0.1:3001/game/{codigo}` | Cambia la carpeta del juego activo (ej: `/game/GGST` o `/game/SF6`). |

---

### 2. Cómo Configurar tu Elgato Stream Deck

Tienes dos métodos principales para asignar estas funciones a las teclas físicas de tu Stream Deck:

#### Método A: Acción nativa de "Sitio Web" (Recomendado y rápido)
1. Abre la aplicación de configuración de **Elgato Stream Deck**.
2. En la lista de acciones a la derecha, desplázate hasta la categoría **Sistema** y arrastra la acción **Sitio web** (icono de un globo terráqueo) a la tecla física que desees.
3. Configura las siguientes opciones en el panel inferior:
   * **Título**: Escribe el texto que gustes (ej. `+1 P1`, `SWAP`, etc.).
   * **URL**: Pega el comando correspondiente (ej. `http://127.0.0.1:3001/score/player1/+1`).
   * **⚠️ IMPORTANTE**: Marca la casilla **"Acceder en segundo plano"** (Access in background). Si no marcas esto, cada vez que presiones el botón se abrirá una nueva pestaña en tu navegador web predeterminado.
4. ¡Listo! Repite el proceso para cada uno de los botones que quieras controlar.

#### Método B: Plugins de peticiones API / HTTP (Avanzado)
Si prefieres no usar el navegador en segundo plano y quieres un control de peticiones más limpio:
1. En la tienda de Elgato Stream Deck (Icono de la bolsa de compras), busca y descarga un plugin de peticiones HTTP, como **API Request** (desarrollado por *BarRaider*) o **HTTP Request**.
2. Arrastra la acción del plugin a una de tus teclas.
3. Configura el método HTTP como `GET`.
4. Ingresa el endpoint en el campo URL (ej: `http://127.0.0.1:3001/swap-players`).
5. Guarda y prueba el botón.
