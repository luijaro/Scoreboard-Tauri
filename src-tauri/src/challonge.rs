use reqwest::Client;
use serde_json::Value;
use crate::files::load_api_key;

async fn get_challonge_token() -> Result<String, String> {
    match load_api_key().await {
        Ok(res) => {
            if let Some(data) = res.get("data").and_then(|d| d.as_object()) {
                if let Some(token) = data.get("apiKey").and_then(|t| t.as_str()) {
                    if !token.is_empty() {
                        return Ok(token.to_string());
                    }
                }
            }
            Err("API key no establecida.".to_string())
        },
        Err(e) => Err(e)
    }
}

#[tauri::command(rename = "get-tournaments")]
pub async fn get_tournaments() -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let url = format!("https://api.challonge.com/v1/tournaments.json?state=all&api_key={}", token);
    
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(arr) = data.as_array() {
        let mut tournaments = vec![];
        for t in arr {
            if let Some(tourney) = t.get("tournament") {
                tournaments.push(serde_json::json!({
                    "id": tourney.get("id"),
                    "name": tourney.get("name"),
                    "url": tourney.get("url"),
                    "created_at": tourney.get("created_at"),
                    "state": tourney.get("state")
                }));
            }
        }
        tournaments.retain(|t| t.get("created_at").is_some());
        tournaments.sort_by(|a, b| {
            let a_date = a.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            let b_date = b.get("created_at").and_then(|v| v.as_str()).unwrap_or("");
            b_date.cmp(&a_date)
        });
        Ok(serde_json::json!({ "ok": true, "tournaments": tournaments }))
    } else {
        Err("Invalid response".to_string())
    }
}

#[tauri::command(rename = "get-tournament-title")]
pub async fn get_tournament_title(slug: String) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let url = format!("https://api.challonge.com/v1/tournaments/{}.json?api_key={}", slug, token);
    
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: Value = res.json().await.map_err(|e| e.to_string())?;

    let title = data.pointer("/tournament/name").cloned().unwrap_or(Value::Null);
    Ok(serde_json::json!({ "title": title }))
}

#[tauri::command(rename = "get-participants")]
pub async fn get_participants(slug: String) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let url = format!("https://api.challonge.com/v1/tournaments/{}/participants.json?api_key={}", slug, token);
    
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: Value = res.json().await.map_err(|e| e.to_string())?;

    let mut participants = vec![];
    if let Some(arr) = data.as_array() {
        for p in arr {
            if let Some(part) = p.get("participant") {
                participants.push(serde_json::json!({
                    "id": part.get("id"),
                    "name": part.get("name"),
                    "final_rank": part.get("final_rank")
                }));
            }
        }
    }
    Ok(serde_json::json!({ "participants": participants }))
}

#[tauri::command(rename = "get-top8")]
pub async fn get_top8(slug: String) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let url = format!("https://api.challonge.com/v1/tournaments/{}/participants.json?api_key={}", slug, token);
    
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: Value = res.json().await.map_err(|e| e.to_string())?;

    let mut top8 = vec![];
    if let Some(arr) = data.as_array() {
        for p in arr {
            if let Some(part) = p.get("participant") {
                if part.get("final_rank").and_then(|v| v.as_i64()).is_some() {
                    top8.push(part.clone());
                }
            }
        }
    }
    
    top8.sort_by_key(|p| p.get("final_rank").and_then(|v| v.as_i64()).unwrap_or(999));
    top8.truncate(8);
    
    Ok(serde_json::json!({ "top8": top8 }))
}

#[tauri::command(rename = "get-matches-and-participants")]
pub async fn get_matches_and_participants(slug: String) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let client = Client::new();
    
    let url_tournament = format!("https://api.challonge.com/v1/tournaments/{}.json?api_key={}", slug, token);
    let url_part = format!("https://api.challonge.com/v1/tournaments/{}/participants.json?api_key={}", slug, token);
    let url_match = format!("https://api.challonge.com/v1/tournaments/{}/matches.json?state=all&api_key={}", slug, token);
    
    let (t_res, p_res, m_res) = tokio::join!(
        client.get(&url_tournament).send(),
        client.get(&url_part).send(),
        client.get(&url_match).send()
    );
    
    let t_data: Value = t_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    let p_data: Value = p_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    let m_data: Value = m_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    
    let mut participantes = std::collections::HashMap::new();
    let mut part_list = vec![];
    
    if let Some(arr) = p_data.as_array() {
        for p in arr {
            if let Some(part) = p.get("participant") {
                let id_opt = part.get("id").and_then(|v| v.as_i64());
                let name_opt = part.get("name").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()).or_else(|| part.get("display_name").and_then(|v| v.as_str()));
                if let (Some(id), Some(name)) = (id_opt, name_opt) {
                    let obj = serde_json::json!({ "id": id, "name": name });
                    participantes.insert(id, name.to_string());
                    part_list.push(obj);
                }
            }
        }
    }
    
    let mut matches = vec![];
    if let Some(arr) = m_data.as_array() {
        for m in arr {
            if let Some(mat) = m.get("match") {
                let state = mat.get("state").and_then(|v| v.as_str()).unwrap_or("");
                let winner_id = mat.get("winner_id");
                let p1_id = mat.get("player1_id").and_then(|v| v.as_i64()).unwrap_or(0);
                let p2_id = mat.get("player2_id").and_then(|v| v.as_i64()).unwrap_or(0);
                
                let p1_name = participantes.get(&p1_id).cloned().unwrap_or_else(|| "TBD".to_string());
                let p2_name = participantes.get(&p2_id).cloned().unwrap_or_else(|| "TBD".to_string());
                
                if state != "complete" && (winner_id.is_none() || winner_id.unwrap().is_null()) && p1_name != "TBD" && p2_name != "TBD" {
                    matches.push(serde_json::json!({
                        "id": mat.get("id"),
                        "player1_id": p1_id,
                        "player2_id": p2_id,
                        "player1_name": p1_name,
                        "player2_name": p2_name,
                        "round": mat.get("round"),
                        "scores_csv": mat.get("scores_csv").and_then(|v| v.as_str()).unwrap_or(""),
                        "winner_id": mat.get("winner_id"),
                        "state": state
                    }));
                }
            }
        }
    }
    
    let t_type = t_data.pointer("/tournament/tournament_type").cloned().unwrap_or(Value::Null);
    let t_state = t_data.pointer("/tournament/state").cloned().unwrap_or(Value::Null);
    
    Ok(serde_json::json!({
        "ok": true,
        "matches": matches,
        "participantes": part_list,
        "participantsCount": part_list.len(),
        "tournament_type": t_type,
        "tournament_state": t_state
    }))
}

#[tauri::command(rename = "get-all-matches-and-participants")]
pub async fn get_all_matches_and_participants(slug: String) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let client = Client::new();
    
    let url_part = format!("https://api.challonge.com/v1/tournaments/{}/participants.json?api_key={}", slug, token);
    let url_match = format!("https://api.challonge.com/v1/tournaments/{}/matches.json?state=all&api_key={}", slug, token);
    
    let (p_res, m_res) = tokio::join!(
        client.get(&url_part).send(),
        client.get(&url_match).send()
    );
    
    let p_data: Value = p_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    let m_data: Value = m_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    
    let mut participantes = std::collections::HashMap::new();
    let mut part_list = vec![];
    
    if let Some(arr) = p_data.as_array() {
        for p in arr {
            if let Some(part) = p.get("participant") {
                let id_opt = part.get("id").and_then(|v| v.as_i64());
                let name_opt = part.get("name").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()).or_else(|| part.get("display_name").and_then(|v| v.as_str()));
                if let (Some(id), Some(name)) = (id_opt, name_opt) {
                    let obj = serde_json::json!({ "id": id, "name": name });
                    participantes.insert(id, name.to_string());
                    part_list.push(obj);
                }
            }
        }
    }
    
    let mut matches = vec![];
    if let Some(arr) = m_data.as_array() {
        for m in arr {
            if let Some(mat) = m.get("match") {
                let p1_id = mat.get("player1_id").and_then(|v| v.as_i64()).unwrap_or(0);
                let p2_id = mat.get("player2_id").and_then(|v| v.as_i64()).unwrap_or(0);
                
                let p1_name = participantes.get(&p1_id).cloned().unwrap_or_else(|| "TBD".to_string());
                let p2_name = participantes.get(&p2_id).cloned().unwrap_or_else(|| "TBD".to_string());
                
                let state = mat.get("state").and_then(|v| v.as_str()).unwrap_or("");
                
                matches.push(serde_json::json!({
                    "id": mat.get("id"),
                    "player1_id": p1_id,
                    "player2_id": p2_id,
                    "player1_name": p1_name,
                    "player2_name": p2_name,
                    "round": mat.get("round"),
                    "scores_csv": mat.get("scores_csv").and_then(|v| v.as_str()).unwrap_or(""),
                    "winner_id": mat.get("winner_id"),
                    "state": state
                }));
            }
        }
    }
    
    Ok(serde_json::json!({
        "ok": true,
        "matches": matches,
        "participantes": part_list,
        "participantsCount": part_list.len()
    }))
}

#[tauri::command(rename = "report-match-score", rename_all = "camelCase")]
pub async fn report_match_score(slug: String, match_id: i64, score_csv: String, winner_id: i64) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let url = format!("https://api.challonge.com/v1/tournaments/{}/matches/{}.json?api_key={}", slug, match_id, token);
    
    let client = Client::new();
    let body = serde_json::json!({
        "match": {
            "scores_csv": score_csv,
            "winner_id": winner_id
        }
    });
    
    let res = client.put(&url)
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
        
    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(mat) = data.get("match") {
        Ok(serde_json::json!({ "ok": true, "match": mat }))
    } else {
        Err("Error updating match".to_string())
    }
}

#[tauri::command(rename = "get-group-matches")]
pub async fn get_group_matches(slug: String) -> Result<serde_json::Value, String> {
    let token = get_challonge_token().await?;
    let client = Client::new();

    let url_tournament = format!("https://api.challonge.com/v1/tournaments/{}.json?api_key={}", slug, token);
    let url_part = format!("https://api.challonge.com/v1/tournaments/{}/participants.json?api_key={}", slug, token);
    let url_match = format!("https://api.challonge.com/v1/tournaments/{}/matches.json?state=all&api_key={}", slug, token);
    let url_full = format!("https://api.challonge.com/v1/tournaments/{}.json?include_participants=1&include_matches=1&api_key={}", slug, token);

    let (t_res, p_res, m_res, f_res) = tokio::join!(
        client.get(&url_tournament).send(),
        client.get(&url_part).send(),
        client.get(&url_match).send(),
        client.get(&url_full).send()
    );

    let t_data: Value = t_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    let p_data: Value = p_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    let m_data: Value = m_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);
    let f_data: Value = f_res.map_err(|e| e.to_string())?.json().await.unwrap_or(Value::Null);

    let t_type = t_data.pointer("/tournament/tournament_type").and_then(|v| v.as_str()).unwrap_or("");
    let t_state = t_data.pointer("/tournament/state").and_then(|v| v.as_str()).unwrap_or("");

    if !t_type.to_lowercase().contains("group") && !t_type.to_lowercase().contains("round robin") &&
       !t_state.to_lowercase().contains("group") {
        return Ok(serde_json::json!({ "ok": false, "error": "Este torneo no es de tipo grupo" }));
    }

    let mut player_mapping = std::collections::HashMap::new();
    let mut participantes = std::collections::HashMap::new();

    if let Some(arr) = p_data.as_array() {
        for p in arr {
            if let Some(part) = p.get("participant") {
                if let Some(id) = part.get("id").and_then(|v| v.as_i64()) {
                    let name = part.get("name")
                        .or_else(|| part.get("display_name"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let group_name = if let Some(group_id) = part.get("group_id").and_then(|v| v.as_i64()) {
                        format!("Group {}", group_id)
                    } else {
                        "Group Stage".to_string()
                    };

                    let group_player_ids = part.get("group_player_ids")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();

                    for g_id in &group_player_ids {
                        if let Some(gid_val) = g_id.as_i64() {
                            player_mapping.insert(gid_val, name.clone());
                        }
                    }

                    participantes.insert(id, serde_json::json!({
                        "id": id,
                        "name": name,
                        "group_name": group_name,
                        "group_player_ids": group_player_ids
                    }));
                }
            }
        }
    }

    if let Some(parts) = f_data.pointer("/tournament/participants").and_then(|v| v.as_array()) {
        for p in parts {
            if let Some(part) = p.get("participant") {
                if let Some(name) = part.get("name").or_else(|| part.get("display_name")).and_then(|v| v.as_str()) {
                    if let Some(group_player_ids) = part.get("group_player_ids").and_then(|v| v.as_array()) {
                        for g_id in group_player_ids {
                            if let Some(gid_val) = g_id.as_i64() {
                                player_mapping.entry(gid_val).or_insert_with(|| name.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    let find_player_name = |player_id: i64, player_mapping: &std::collections::HashMap<i64, String>, participantes: &std::collections::HashMap<i64, Value>| -> String {
        if let Some(name) = player_mapping.get(&player_id) {
            name.clone()
        } else if let Some(part_val) = participantes.get(&player_id) {
            part_val.get("name").and_then(|v| v.as_str()).unwrap_or("TBD").to_string()
        } else {
            "TBD".to_string()
        }
    };

    let mut matches_to_process = m_data;
    if let Some(full_matches) = f_data.pointer("/tournament/matches").and_then(|v| v.as_array()) {
        let group_matches_from_full: Vec<Value> = full_matches.iter()
            .filter(|m| m.pointer("/match/group_id").is_some())
            .cloned()
            .collect();
        if !group_matches_from_full.is_empty() {
            matches_to_process = Value::Array(group_matches_from_full);
        }
    }

    let mut group_matches = vec![];
    if let Some(arr) = matches_to_process.as_array() {
        for m in arr {
            if let Some(mat) = m.get("match") {
                let has_group_id = mat.get("group_id").is_some() && !mat["group_id"].is_null();
                let state = mat.get("state").and_then(|v| v.as_str()).unwrap_or("");
                
                if has_group_id && state != "complete" {
                    let p1_id = mat.get("player1_id").and_then(|v| v.as_i64()).unwrap_or(0);
                    let p2_id = mat.get("player2_id").and_then(|v| v.as_i64()).unwrap_or(0);
                    
                    let p1_name = find_player_name(p1_id, &player_mapping, &participantes);
                    let p2_name = find_player_name(p2_id, &player_mapping, &participantes);

                    if p1_name != "TBD" && p2_name != "TBD" {
                        let match_id = mat.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
                        let identifier = mat.get("identifier")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| format!("Match {}", match_id));

                        group_matches.push(serde_json::json!({
                            "id": match_id,
                            "player1_id": p1_id,
                            "player2_id": p2_id,
                            "player1_name": p1_name,
                            "player2_name": p2_name,
                            "round": mat.get("round"),
                            "scores_csv": mat.get("scores_csv").and_then(|v| v.as_str()).unwrap_or(""),
                            "winner_id": mat.get("winner_id"),
                            "group_name": "Round Robin",
                            "identifier": identifier,
                            "state": state
                        }));
                    }
                }
            }
        }
    }

    let participantes_list: Vec<Value> = participantes.values().cloned().collect();

    Ok(serde_json::json!({
        "ok": true,
        "matches": group_matches,
        "participantes": participantes_list
    }))
}
