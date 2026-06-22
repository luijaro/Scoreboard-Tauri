use reqwest::Client;
use serde_json::Value;

use crate::load_json;

async fn get_startgg_token() -> Result<String, String> {
    match load_json("apikey".to_string()).await {
        Ok(res) => {
            if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
                if let Some(token) = data.get("startgg").and_then(|t| t.as_str()) {
                    return Ok(token.to_string());
                }
            }
            Err("No startgg token found".to_string())
        },
        Err(e) => Err(e)
    }
}

#[tauri::command(rename = "startgg-get-events", rename_all = "camelCase")]
pub async fn startgg_get_events(tournament_slug: String) -> Result<serde_json::Value, String> {
    let token = get_startgg_token().await?;
    let query = format!(r#"
    query TournamentBySlug {{
      tournament(slug: "{}") {{
        id
        name
        images {{ url type }}
        events {{
          id
          name
          slug
        }}
      }}
    }}
    "#, tournament_slug);

    let client = Client::new();
    let res = client.post("https://api.start.gg/gql/alpha")
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": query }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    
    let events = data.pointer("/data/tournament/events").cloned().unwrap_or(serde_json::json!([]));
    let name = data.pointer("/data/tournament/name").cloned().unwrap_or(Value::Null);
    let images = data.pointer("/data/tournament/images").cloned().unwrap_or(Value::Null);

    Ok(serde_json::json!({ "ok": true, "tournamentName": name, "events": events, "images": images }))
}

// Basic implementation of getting matches. To keep it simple for now, we just fetch one page.
// The original paginated up to 20 pages.
#[tauri::command(rename = "startgg-get-matches", rename_all = "camelCase")]
pub async fn startgg_get_matches(event_id: i64) -> Result<serde_json::Value, String> {
    let token = get_startgg_token().await?;
    let mut all_sets = vec![];
    let client = Client::new();

    // Consultamos los sets directamente a nivel del Evento para evitar múltiples llamadas en serie por cada fase
    for page in 1..=5 { // max 5 páginas (hasta 500 matches) para cubrir casi cualquier torneo local/regional rápidamente
        let query_sets = format!(r#"
          query EventSets {{
            event(id: {}) {{
              sets(perPage: 100, page: {}) {{
                nodes {{
                  id
                  fullRoundText
                  slots {{
                    entrant {{ name }}
                    standing {{ stats {{ score {{ value }} }} }}
                  }}
                  phaseGroup {{
                    id
                    phase {{
                      id
                      name
                    }}
                  }}
                }}
              }}
            }}
          }}
        "#, event_id, page);

        let res = client.post("https://api.start.gg/gql/alpha")
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({ "query": query_sets }))
            .send().await.map_err(|e| e.to_string())?;
        
        let data: Value = res.json().await.map_err(|e| e.to_string())?;
        let sets = data.pointer("/data/event/sets/nodes").and_then(|p| p.as_array()).cloned().unwrap_or_default();
        
        if sets.is_empty() { break; }
        
        for mut set in sets {
            let phase_id = set.pointer("/phaseGroup/phase/id").and_then(|id| id.as_i64()).unwrap_or(0);
            let phase_name = set.pointer("/phaseGroup/phase/name").and_then(|n| n.as_str()).unwrap_or("").to_string();
            
            if let Some(obj) = set.as_object_mut() {
                obj.insert("phaseId".to_string(), serde_json::json!(phase_id));
                obj.insert("fase".to_string(), serde_json::json!(phase_name));
            }
            all_sets.push(set);
        }
    }

    Ok(serde_json::json!({ "ok": true, "sets": all_sets }))
}

#[tauri::command(rename = "startgg-get-standings", rename_all = "camelCase")]
pub async fn startgg_get_standings(event_id: i64) -> Result<serde_json::Value, String> {
    let token = get_startgg_token().await?;
    let query = format!(r#"
    query EventStandings {{
      event(id: {}) {{
        name
        standings(query: {{ perPage: 8, page: 1 }}) {{
          nodes {{
            placement
            entrant {{ name }}
          }}
        }}
      }}
    }}
    "#, event_id);

    let client = Client::new();
    let res = client.post("https://api.start.gg/gql/alpha")
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": query }))
        .send().await.map_err(|e| e.to_string())?;

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    
    let nodes = data.pointer("/data/event/standings/nodes").and_then(|n| n.as_array()).cloned().unwrap_or_default();
    let event_name = data.pointer("/data/event/name").and_then(|n| n.as_str()).unwrap_or("");
    
    let mut top8 = vec![];
    for n in nodes {
        let nombre = n.pointer("/entrant/name").and_then(|n| n.as_str()).unwrap_or("");
        let final_rank = n.get("placement").map(|v| v.clone()).unwrap_or(Value::Null);
        top8.push(serde_json::json!({
            "nombre": nombre,
            "final_rank": final_rank
        }));
    }

    Ok(serde_json::json!({ "ok": true, "eventName": event_name, "top8": top8 }))
}

#[tauri::command(rename = "startgg-get-event-state", rename_all = "camelCase")]
pub async fn startgg_get_event_state(event_id: i64) -> Result<serde_json::Value, String> {
    let token = get_startgg_token().await?;
    let query = format!(r#"
    query EventState {{
      event(id: {}) {{
        id
        name
        state
      }}
    }}
    "#, event_id);

    let client = Client::new();
    let res = client.post("https://api.start.gg/gql/alpha")
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": query }))
        .send().await.map_err(|e| e.to_string())?;

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(errors) = data.get("errors").and_then(|e| e.as_array()) {
        if !errors.is_empty() {
            let msg = errors[0].get("message").and_then(|m| m.as_str()).unwrap_or("Error");
            return Err(msg.to_string());
        }
    }

    let event = data.pointer("/data/event").cloned().unwrap_or(Value::Null);
    let state = data.pointer("/data/event/state").cloned().unwrap_or(Value::Null);

    Ok(serde_json::json!({ "event": event, "state": state }))
}

#[tauri::command(rename = "startgg-get-phase-name", rename_all = "camelCase")]
pub async fn startgg_get_phase_name(phase_ids: Vec<i64>) -> Result<serde_json::Value, String> {
    if phase_ids.is_empty() {
        return Ok(serde_json::json!({ "ok": true, "phaseNames": {} }));
    }
    
    let token = get_startgg_token().await?;
    
    let ids_str = phase_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
    let query = format!(r#"
    query PhaseNames {{
      phases(query: {{ filter: {{ id: [{}] }} }}) {{
        nodes {{ id name }}
      }}
    }}
    "#, ids_str);

    let client = Client::new();
    let res = client.post("https://api.start.gg/gql/alpha")
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "query": query }))
        .send().await.map_err(|e| e.to_string())?;

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut phase_names = serde_json::Map::new();
    if let Some(nodes) = data.pointer("/data/phases/nodes").and_then(|n| n.as_array()) {
        for node in nodes {
            if let (Some(id), Some(name)) = (node.get("id").and_then(|v| v.as_i64()), node.get("name").and_then(|v| v.as_str())) {
                phase_names.insert(id.to_string(), serde_json::json!(name));
            }
        }
    }

    Ok(serde_json::json!({ "ok": true, "phaseNames": phase_names }))
}
