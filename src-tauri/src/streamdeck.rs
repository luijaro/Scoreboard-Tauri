use axum::{
    routing::get,
    Router,
    extract::{Path, State, Query},
    response::{Json, Html},
    http::{StatusCode, Method},
};
use serde_json::Value;
use serde::Deserialize;
use std::net::SocketAddr;
use tauri::{AppHandle, Emitter};
use tower_http::cors::CorsLayer;

use crate::{load_json, save_json};

pub fn start_server(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let cors = CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers(tower_http::cors::Any);

        let app = Router::new()
            .route("/", get(|| async { Json(serde_json::json!({ "status": "active" })) }))
            .route("/score/{player}/{action}", get(handle_score))
            .route("/reset-scores", get(handle_reset_scores))
            .route("/timer/reset", get(handle_timer_reset))
            .route("/timer/{minutes}", get(handle_timer_set))
            .route("/swap-players", get(handle_swap))
            .route("/game/{game}", get(handle_game))
            .route("/twitch-callback", get(handle_twitch_callback))
            .route("/save-twitch-token", get(handle_save_twitch_token))
            .route("/nightbot-callback", get(handle_nightbot_callback))
            .layer(cors)
            .with_state(app_handle);

        let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
        println!("[Stream Deck] Servidor iniciado en http://{}", addr);
        if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
            let _ = axum::serve(listener, app).await;
        }
    });
}

async fn handle_score(State(app): State<AppHandle>, Path((player, action)): Path<(String, String)>) -> (StatusCode, Json<Value>) {
    if (player != "player1" && player != "player2") || (action != "+1" && action != "-1") {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"success": false})));
    }

    if let Ok(res) = load_json("scoreboard".to_string()).await {
        if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
            let mut new_data = data.clone();
            let score_field = if player == "player1" { "score1" } else { "score2" };
            let delta = if action == "+1" { 1 } else { -1 };
            
            let current_score = new_data.get(score_field).and_then(|v| v.as_i64()).unwrap_or(0);
            let new_score = std::cmp::max(0, current_score + delta);
            new_data.insert(score_field.to_string(), serde_json::json!(new_score));

            let _ = save_json(serde_json::json!(new_data), "scoreboard".to_string()).await;

            let _ = app.emit("stream-deck-score-change", serde_json::json!({
                "player": player,
                "action": action,
                "newScore": new_score
            }));
            return (StatusCode::OK, Json(serde_json::json!({"success": true})));
        }
    }
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false})))
}

async fn handle_reset_scores(State(app): State<AppHandle>) -> (StatusCode, Json<Value>) {
    if let Ok(res) = load_json("scoreboard".to_string()).await {
        if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
            let mut new_data = data.clone();
            new_data.insert("score1".to_string(), serde_json::json!(0));
            new_data.insert("score2".to_string(), serde_json::json!(0));

            let _ = save_json(serde_json::json!(new_data), "scoreboard".to_string()).await;
            let _ = app.emit("stream-deck-reset-scores", ());
            
            return (StatusCode::OK, Json(serde_json::json!({"success": true})));
        }
    }
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false})))
}

async fn handle_timer_reset(State(app): State<AppHandle>) -> (StatusCode, Json<Value>) {
    if let Ok(res) = load_json("timestamp".to_string()).await {
        if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
            let mut new_data = data.clone();
            new_data.insert("timerEndTimestamp".to_string(), Value::Null);

            let _ = save_json(serde_json::json!(new_data), "timestamp".to_string()).await;
            let _ = app.emit("stream-deck-reset-timer", ());
            
            return (StatusCode::OK, Json(serde_json::json!({"success": true})));
        }
    }
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false})))
}

async fn handle_timer_set(State(app): State<AppHandle>, Path(minutes): Path<i64>) -> (StatusCode, Json<Value>) {
    if let Ok(res) = load_json("timestamp".to_string()).await {
        if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
            let mut new_data = data.clone();
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
            let end_timestamp = now + (minutes * 60 * 1000);
            new_data.insert("timerEndTimestamp".to_string(), serde_json::json!(end_timestamp));

            let _ = save_json(serde_json::json!(new_data), "timestamp".to_string()).await;
            let _ = app.emit("stream-deck-set-timer", serde_json::json!({
                "minutes": minutes,
                "endTimestamp": end_timestamp
            }));
            
            return (StatusCode::OK, Json(serde_json::json!({"success": true})));
        }
    }
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false})))
}

async fn handle_swap(State(app): State<AppHandle>) -> (StatusCode, Json<Value>) {
    if let Ok(res) = load_json("scoreboard".to_string()).await {
        if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
            let mut new_data = data.clone();
            let keys = ["player", "score", "tag", "char", "country"];
            for k in keys {
                let v1 = new_data.get(&format!("{}1", k)).cloned().unwrap_or(Value::Null);
                let v2 = new_data.get(&format!("{}2", k)).cloned().unwrap_or(Value::Null);
                new_data.insert(format!("{}1", k), v2);
                new_data.insert(format!("{}2", k), v1);
            }

            let _ = save_json(serde_json::json!(new_data), "scoreboard".to_string()).await;
            let _ = app.emit("stream-deck-swap-players", ());
            
            return (StatusCode::OK, Json(serde_json::json!({"success": true})));
        }
    }
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false})))
}

async fn handle_game(State(app): State<AppHandle>, Path(game): Path<String>) -> (StatusCode, Json<Value>) {
    if let Ok(res) = load_json("scoreboard".to_string()).await {
        if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
            let mut new_data = data.clone();
            new_data.insert("game".to_string(), serde_json::json!(game));

            let _ = save_json(serde_json::json!(new_data), "scoreboard".to_string()).await;
            let _ = app.emit("stream-deck-change-game", game.clone());
            
            return (StatusCode::OK, Json(serde_json::json!({"success": true})));
        }
    }
    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false})))
}

async fn handle_twitch_callback() -> Html<&'static str> {
    Html(r#"
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Twitch OAuth Callback</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #ffffff; text-align: center; padding: 50px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e1e1e; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
    h1 { color: #9146FF; }
    p { font-size: 1.1em; line-height: 1.5; color: #b3b3b3; }
    .spinner { border: 4px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #9146FF; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <h1>Twitch Connection</h1>
    <div id="status">
      <div class="spinner"></div>
      <p>Procesando token de Twitch...</p>
    </div>
  </div>
  <script>
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        fetch('/save-twitch-token?token=' + encodeURIComponent(token))
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              document.getElementById('status').innerHTML = '<p style="color: #4cd137; font-size: 1.3em; font-weight: bold;">✅ ¡Twitch conectado con éxito!<br>Ya puedes cerrar esta ventana y regresar a la aplicación.</p>';
            } else {
              document.getElementById('status').innerHTML = '<p style="color: #e84118; font-size: 1.3em; font-weight: bold;">❌ Error al guardar token en la aplicación.</p>';
            }
          })
          .catch(e => {
            document.getElementById('status').innerHTML = '<p style="color: #e84118; font-size: 1.3em; font-weight: bold;">❌ Error de comunicación con la aplicación.</p>';
          });
      } else {
        document.getElementById('status').innerHTML = '<p style="color: #e84118;">No se encontró el token de acceso en la respuesta.</p>';
      }
    } else {
      document.getElementById('status').innerHTML = '<p style="color: #e84118;">No se recibieron parámetros de Twitch. Asegúrate de autorizar la aplicación.</p>';
    }
  </script>
</body>
</html>
    "#)
}

#[derive(Deserialize)]
struct TwitchTokenQuery {
    token: String,
}

async fn handle_save_twitch_token(State(app): State<AppHandle>, Query(params): Query<TwitchTokenQuery>) -> (StatusCode, Json<Value>) {
    let oauth_val = if params.token.starts_with("oauth:") {
        params.token.clone()
    } else {
        format!("oauth:{}", params.token)
    };
    let data = serde_json::json!({
        "twitchOAuth": oauth_val
    });
    match crate::files::save_api_key(data).await {
        Ok(_) => {
            let _ = app.emit("api-key-updated", ());
            (StatusCode::OK, Json(serde_json::json!({"ok": true})))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"ok": false, "error": e})))
    }
}

#[derive(Deserialize)]
struct NightbotCallbackQuery {
    code: Option<String>,
    error: Option<String>,
}

async fn handle_nightbot_callback(State(app): State<AppHandle>, Query(params): Query<NightbotCallbackQuery>) -> Html<String> {
    if let Some(err) = params.error {
        return Html(format!(r#"
<!DOCTYPE html>
<html>
<head><title>Error Nightbot</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error de Autorización</h1>
  <p>Nightbot devolvió un error: {}</p>
</body>
</html>
        "#, err));
    }

    let code = match params.code {
        Some(c) => c,
        None => return Html(r#"
<!DOCTYPE html>
<html>
<head><title>Error Nightbot</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error</h1>
  <p>No se recibió código de autorización de Nightbot.</p>
</body>
</html>
        "#.to_string())
    };

    let client_id;
    let client_secret;
    let redirect_uri;

    match crate::files::load_api_key().await {
        Ok(val) => {
            if let Some(data) = val.get("data").and_then(|d| d.as_object()) {
                client_id = data.get("nightbotClientId").and_then(|v| v.as_str()).map(|s| s.to_string());
                client_secret = data.get("nightbotClientSecret").and_then(|v| v.as_str()).map(|s| s.to_string());
                redirect_uri = data.get("nightbotRedirectUri").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| "http://localhost".to_string());
            } else {
                return Html(r#"
<!DOCTYPE html>
<html>
<head><title>Error Nightbot</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error de Configuración</h1>
  <p>No se encontraron datos en apikey.json. Guarda la configuración de la pestaña de Nightbot primero.</p>
</body>
</html>
                "#.to_string());
            }
        },
        Err(_) => {
            return Html(r#"
<!DOCTYPE html>
<html>
<head><title>Error Nightbot</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error</h1>
  <p>No se pudo cargar apikey.json.</p>
</body>
</html>
            "#.to_string());
        }
    };

    let client_id = match client_id {
        Some(id) if !id.is_empty() => id,
        _ => return Html(r#"
<!DOCTYPE html>
<html>
<head><title>Error Nightbot</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Falta Client ID</h1>
  <p>Por favor, ingresa el <b>Client ID</b> en la aplicación antes de autorizar.</p>
</body>
</html>
        "#.to_string())
    };

    let client_secret = match client_secret {
        Some(sec) if !sec.is_empty() => sec,
        _ => return Html(r#"
<!DOCTYPE html>
<html>
<head><title>Error Nightbot</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Falta Client Secret</h1>
  <p>Por favor, ingresa el <b>Client Secret</b> en la aplicación antes de autorizar.</p>
</body>
</html>
        "#.to_string())
    };

    let client = reqwest::Client::new();
    let mut params_map = std::collections::HashMap::new();
    params_map.insert("client_id", client_id.clone());
    params_map.insert("client_secret", client_secret.clone());
    params_map.insert("grant_type", "authorization_code".to_string());
    params_map.insert("code", code.clone());
    params_map.insert("redirect_uri", redirect_uri.clone());

    match client.post("https://api.nightbot.tv/oauth2/token")
        .form(&params_map)
        .send()
        .await {
            Ok(res) => {
                if res.status().is_success() {
                    if let Ok(json) = res.json::<serde_json::Value>().await {
                        if let Some(token) = json.get("access_token").and_then(|t| t.as_str()) {
                            let data = serde_json::json!({
                                "nightbotToken": token
                            });
                            if let Err(e) = crate::files::save_api_key(data).await {
                                return Html(format!(r#"
<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error al Guardar</h1>
  <p>No se pudo guardar el token: {}</p>
</body>
</html>
                                "#, e));
                            }
                            let _ = app.emit("api-key-updated", ());
                            Html(r#"
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nightbot Conectado</title>
</head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #4cd137;">✅ ¡Nightbot conectado con éxito!</h1>
  <p>El token ha sido guardado automáticamente en apikey.json. Ya puedes cerrar esta ventana y regresar a la aplicación.</p>
</body>
</html>
                            "#.to_string())
                        } else {
                            Html(r#"
<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Respuesta Inválida</h1>
  <p>Nightbot no devolvió un access_token en la respuesta.</p>
</body>
</html>
                            "#.to_string())
                        }
                    } else {
                        Html(r#"
<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error al Procesar JSON</h1>
  <p>No se pudo parsear la respuesta de Nightbot.</p>
</body>
</html>
                        "#.to_string())
                    }
                } else {
                    let status = res.status();
                    let body_text = res.text().await.unwrap_or_default();
                    Html(format!(r#"
<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error de Token</h1>
  <p>Nightbot devolvió status {}: {}</p>
</body>
</html>
                    "#, status, body_text))
                }
            },
            Err(e) => {
                Html(format!(r#"
<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px;">
  <h1 style="color: #e84118;">❌ Error de Red</h1>
  <p>No se pudo conectar con los servidores de Nightbot: {}</p>
</body>
</html>
                "#, e))
            }
        }
}
