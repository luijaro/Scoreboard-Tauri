use axum::{
    routing::get,
    Router,
    extract::{Path, State},
    response::Json,
    http::{StatusCode, Method},
};
use serde_json::Value;
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
