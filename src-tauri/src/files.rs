use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub fn get_user_data_dir() -> PathBuf {
    let mut path = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("js");
    if !path.exists() {
        fs::create_dir_all(&path).unwrap_or_default();
    }
    path
}

pub fn get_config_path() -> PathBuf {
    let mut path = get_user_data_dir();
    path.push("scoreboard-config.json");
    path
}

pub fn load_config() -> std::collections::HashMap<String, String> {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    std::collections::HashMap::new()
}

fn get_apikey_path() -> PathBuf {
    let config = load_config();
    if let Some(custom_path) = config.get("apikey") {
        if !custom_path.trim().is_empty() {
            return PathBuf::from(custom_path);
        }
    }
    let mut path = get_user_data_dir();
    path.push("apikey.json");
    path
}

#[tauri::command(rename = "save-api-key")]
pub async fn save_api_key(data: Value) -> Result<serde_json::Value, String> {
    let file = get_apikey_path();
    let mut current_data = serde_json::json!({});
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                current_data = parsed;
            }
        }
    }

    if let (Some(current_obj), Some(new_obj)) = (current_data.as_object_mut(), data.as_object()) {
        for (k, v) in new_obj {
            current_obj.insert(k.clone(), v.clone());
        }
    }

    match fs::write(&file, serde_json::to_string_pretty(&current_data).unwrap_or_default()) {
        Ok(_) => Ok(serde_json::json!({ "ok": true, "file": file.to_string_lossy() })),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command(rename = "load-api-key")]
pub async fn load_api_key() -> Result<serde_json::Value, String> {
    let file = get_apikey_path();
    if file.exists() {
        match fs::read_to_string(&file) {
            Ok(content) => {
                match serde_json::from_str::<Value>(&content) {
                    Ok(data) => Ok(serde_json::json!({ "ok": true, "data": data, "file": file.to_string_lossy() })),
                    Err(e) => Err(e.to_string())
                }
            },
            Err(e) => Err(e.to_string())
        }
    } else {
        Ok(serde_json::json!({ "ok": false, "file": file.to_string_lossy() }))
    }
}

#[tauri::command(rename = "leer-apikey-json", rename_all = "camelCase")]
pub async fn leer_apikey_json(path_str: Option<String>) -> Result<serde_json::Value, String> {
    let file = match path_str {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => get_apikey_path()
    };
    if file.exists() {
        match fs::read_to_string(&file) {
            Ok(content) => {
                match serde_json::from_str::<Value>(&content) {
                    Ok(data) => Ok(data),
                    Err(_) => Ok(serde_json::json!({}))
                }
            },
            Err(_) => Ok(serde_json::json!({}))
        }
    } else {
        Ok(serde_json::json!({}))
    }
}

#[tauri::command(rename = "guardar-apikey-token", rename_all = "camelCase")]
pub async fn guardar_apikey_token(path_str: Option<String>, token: String) -> Result<bool, String> {
    let file = match path_str {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => get_apikey_path()
    };
    let mut current_data = serde_json::json!({});
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                current_data = parsed;
            }
        }
    }
    
    if let Some(obj) = current_data.as_object_mut() {
        obj.insert("startgg".to_string(), serde_json::json!(token));
    }
    
    match fs::write(&file, serde_json::to_string_pretty(&current_data).unwrap_or_default()) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false)
    }
}

#[tauri::command(rename = "leer-usuarios-txt")]
pub async fn leer_usuarios_txt() -> Result<serde_json::Value, String> {
    let config = load_config();
    let mut file = match config.get("usuarios") {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => {
            let mut path = get_user_data_dir();
            path.push("usuarios.txt");
            path
        }
    };
    
    // In old main.js, if not found, it looked in current_dir/usuarios.txt
    if !file.exists() {
        let mut alt_file = std::env::current_dir().unwrap_or_default();
        alt_file.push("usuarios.txt");
        if alt_file.exists() {
            file = alt_file;
        } else {
            // Also try src-tauri parent
            alt_file.pop();
            alt_file.push("usuarios.txt");
            if alt_file.exists() {
                file = alt_file;
            }
        }
    }

    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
            return Ok(serde_json::json!({ "ok": true, "lines": lines }));
        }
    }
    Ok(serde_json::json!({ "ok": false }))
}

#[tauri::command(rename = "leer-personajes-txt")]
pub async fn leer_personajes_txt() -> Result<serde_json::Value, String> {
    let mut file = std::env::current_dir().unwrap_or_default();
    file.push("personajes.txt");
    if !file.exists() {
        file.pop();
        file.push("src-tauri");
        file.pop();
        file.push("personajes.txt");
    }

    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            let lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
            return Ok(serde_json::json!({ "ok": true, "lines": lines }));
        }
    }
    Ok(serde_json::json!({ "ok": false }))
}

#[tauri::command(rename = "save-bracket-json")]
pub async fn save_bracket_json(data: Value) -> Result<serde_json::Value, String> {
    let config = load_config();
    let file = match config.get("bracket") {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => {
            let mut path = get_user_data_dir();
            path.push("bracket.json");
            path
        }
    };
    
    match fs::write(&file, serde_json::to_string_pretty(&data).unwrap_or_default()) {
        Ok(_) => Ok(serde_json::json!({ "ok": true, "file": file.to_string_lossy() })),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command(rename = "save-json-custom", rename_all = "camelCase")]
pub async fn save_json_custom(data: Value, file_path: String) -> Result<serde_json::Value, String> {
    match fs::write(&file_path, serde_json::to_string_pretty(&data).unwrap_or_default()) {
        Ok(_) => Ok(serde_json::json!({ "ok": true, "file": file_path })),
        Err(e) => Err(e.to_string())
    }
}
