use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub mod files;
pub mod challonge;

pub use files::{get_user_data_dir, get_config_path, load_config};

fn get_file_path(tipo: &str) -> PathBuf {
    let config = load_config();
    if let Some(custom_path) = config.get(tipo) {
        if !custom_path.trim().is_empty() {
            return PathBuf::from(custom_path);
        }
    }
    let mut path = get_user_data_dir();
    path.push(format!("{}.json", tipo));
    path
}

#[tauri::command(rename = "get-app-version")]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command(rename = "check-for-updates-manual")]
async fn check_for_updates_manual(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_updater::UpdaterExt;
    use tauri_plugin_dialog::DialogExt;
    
    let check_result = match app.updater() {
        Ok(updater) => updater.check().await,
        Err(e) => Err(e),
    };
    
    match check_result {
        Ok(Some(update)) => {
            let is_confirmed = app.dialog()
                .message(format!("Una nueva versión (v{}) está disponible. ¿Deseas descargarla e instalarla ahora?", update.version))
                .title("Actualización Disponible")
                .kind(tauri_plugin_dialog::MessageDialogKind::Info)
                .buttons(tauri_plugin_dialog::MessageDialogButtons::YesNo)
                .blocking_show();
                
            if is_confirmed {
                match update.download_and_install(|_, _| {}, || {}).await {
                    Ok(_) => {
                        app.restart();
                        Ok(serde_json::json!({ "ok": true, "updated": true }))
                    },
                    Err(e) => {
                        Err(e.to_string())
                    }
                }
            } else {
                Ok(serde_json::json!({ "ok": true, "updated": false }))
            }
        },
        Ok(None) => {
            let _ = app.dialog()
                .message("No hay actualizaciones disponibles. Tu aplicación está al día.")
                .title("Sin Actualizaciones")
                .kind(tauri_plugin_dialog::MessageDialogKind::Info)
                .blocking_show();
            Ok(serde_json::json!({ "ok": true, "updated": false }))
        },
        Err(e) => {
            Err(e.to_string())
        }
    }
}

#[tauri::command(rename = "elegir-ruta")]
async fn elegir_ruta(app: tauri::AppHandle, tipo: String) -> Result<serde_json::Value, String> {
    use tauri_plugin_dialog::DialogExt;
    let default_name = format!("{}.json", tipo);
    let file_path = tokio::task::spawn_blocking(move || {
        app.dialog().file().set_file_name(&default_name).add_filter("JSON", &["json"]).blocking_save_file()
    }).await.map_err(|e| e.to_string())?;

    if let Some(path) = file_path {
        Ok(serde_json::json!({
            "ok": true,
            "ruta": path.to_string()
        }))
    } else {
        Ok(serde_json::json!({ "ok": false }))
    }
}

#[tauri::command(rename = "guardar-rutas")]
async fn guardar_rutas(rutas: std::collections::HashMap<String, String>) -> Result<serde_json::Value, String> {
    let path = get_config_path();
    match fs::write(&path, serde_json::to_string_pretty(&rutas).unwrap_or_default()) {
        Ok(_) => Ok(serde_json::json!({ "ok": true })),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command(rename = "cargar-rutas")]
async fn cargar_rutas() -> Result<serde_json::Value, String> {
    let config = load_config();
    Ok(serde_json::json!({
        "ok": true,
        "rutas": config
    }))
}

#[tauri::command(rename = "save-json")]
async fn save_json(data: Value, tipo: String) -> Result<serde_json::Value, String> {
    println!("Saving JSON for {}", tipo);
    let path = get_file_path(&tipo);
    match fs::write(&path, serde_json::to_string_pretty(&data).unwrap()) {
        Ok(_) => Ok(serde_json::json!({ "ok": true, "file": path.to_string_lossy() })),
        Err(e) => Err(e.to_string())
    }
}

#[tauri::command(rename = "load-json")]
async fn load_json(tipo: String) -> Result<serde_json::Value, String> {
    println!("Loading JSON for {}", tipo);
    let path = get_file_path(&tipo);
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => {
                match serde_json::from_str::<Value>(&content) {
                    Ok(data) => Ok(serde_json::json!({ "ok": true, "data": data, "file": path.to_string_lossy() })),
                    Err(e) => Err(e.to_string())
                }
            },
            Err(e) => Err(e.to_string())
        }
    } else {
        Ok(serde_json::json!({ "ok": false }))
    }
}

#[tauri::command(rename = "open-folder")]
async fn open_folder() -> Result<(), String> {
    let path = get_user_data_dir();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command(rename = "get-personajes", rename_all = "camelCase")]
fn get_personajes(app: tauri::AppHandle, juego_folder: String) -> Result<serde_json::Value, String> {
    use tauri::Manager;
    println!("\n--- [get_personajes] INICIANDO BÚSQUEDA ---");
    println!("Juego seleccionado: '{}'", juego_folder);

    let mut dir = match app.path().resource_dir() {
        Ok(p) => {
            println!("Ruta de recursos obtenida: {:?}", p);
            p
        },
        Err(e) => {
            println!("Error obteniendo resource_dir: {:?}", e);
            std::env::current_dir().unwrap_or_default()
        }
    };

    let mut up_dir = dir.clone();
    up_dir.push("_up_");
    up_dir.push("personajes");
    if up_dir.exists() {
        dir.push("_up_");
        println!("Detectada carpeta _up_ en recursos");
    }

    dir.push("personajes");
    dir.push(&juego_folder);
    println!("Ruta de recursos candidata: {:?}", dir);

    // Fallback inteligente para desarrollo
    if !dir.exists() {
        println!("La ruta de recursos no existe. Buscando fallback de desarrollo...");
        let mut dev_base = std::env::current_dir().unwrap_or_default();
        println!("Directorio de ejecución inicial: {:?}", dev_base);
        
        let mut found_path = None;
        for i in 0..5 {
            let candidate = dev_base.join("personajes").join(&juego_folder);
            println!("  - Intento #{}: comprobando si existe {:?}", i, candidate);
            if dev_base.join("personajes").exists() {
                if candidate.exists() {
                    println!("    ¡Encontrada! Ruta asignada: {:?}", candidate);
                    found_path = Some(candidate);
                    break;
                } else {
                    println!("    Se encontró la carpeta 'personajes' pero no el juego '{}' dentro de {:?}", juego_folder, dev_base);
                }
            }
            if !dev_base.pop() {
                break;
            }
        }
        
        if let Some(p) = found_path {
            dir = p;
        } else {
            println!("No se pudo encontrar ninguna carpeta 'personajes' válida en desarrollo.");
        }
    }

    if !dir.exists() {
        println!("❌ Carpeta final resolved no existe: {:?}", dir);
        return Ok(serde_json::json!({ "personajes": [] }));
    }

    println!("✅ Leyendo personajes desde: {:?}", dir);

    let mut personajes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "png" || ext_lower == "jpg" || ext_lower == "jpeg" {
                        let name = path.file_stem().and_then(|n| n.to_str()).unwrap_or("");
                        let mut abs_path = path.to_string_lossy().into_owned();
                        if let Some(stripped) = abs_path.strip_prefix(r"\\?\") {
                            abs_path = stripped.to_string();
                        }
                        personajes.push(serde_json::json!({
                            "nombre": name,
                            "imagen": abs_path
                        }));
                    }
                }
            }
        }
    }

    println!("🎉 Encontrados {} personajes.", personajes.len());
    Ok(serde_json::json!({ "personajes": personajes }))
}

pub mod streamdeck;
pub mod startgg;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            streamdeck::start_server(handle.clone());
            
            // Hilo de actualización automática
            tauri::async_runtime::spawn(async move {
                // Esperar 4 segundos para que se cargue la interfaz
                tokio::time::sleep(std::time::Duration::from_secs(4)).await;
                println!("[Updater] Checking for updates...");
                
                use tauri_plugin_updater::UpdaterExt;
                use tauri_plugin_dialog::DialogExt;
                
                let check_result = match handle.updater() {
                    Ok(updater) => updater.check().await,
                    Err(e) => Err(e),
                };
                
                match check_result {
                    Ok(Some(update)) => {
                        println!("[Updater] New version found: {}", update.version);
                        
                        let is_confirmed = handle.dialog()
                            .message(format!("Una nueva versión (v{}) está disponible. ¿Deseas descargarla e instalarla ahora?", update.version))
                            .title("Actualización Disponible")
                            .kind(tauri_plugin_dialog::MessageDialogKind::Info)
                            .buttons(tauri_plugin_dialog::MessageDialogButtons::YesNo)
                            .blocking_show();
                            
                        if is_confirmed {
                            println!("[Updater] Starting download and install...");
                            match update.download_and_install(|_, _| {}, || {}).await {
                                Ok(_) => {
                                    println!("[Updater] Update installed successfully, restarting app...");
                                    handle.restart();
                                },
                                Err(e) => {
                                    println!("[Updater] Error downloading/installing update: {}", e);
                                    let _ = handle.dialog()
                                        .message(format!("Error al instalar la actualización: {}", e))
                                        .title("Error de Actualización")
                                        .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                                        .blocking_show();
                                }
                            }
                        }
                    },
                    Ok(None) => {
                        println!("[Updater] No updates found.");
                    },
                    Err(e) => {
                        println!("[Updater] Error checking for updates: {}", e);
                    }
                }
            });

            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            check_for_updates_manual,
            elegir_ruta,
            guardar_rutas,
            cargar_rutas,
            save_json,
            load_json,
            open_folder,
            get_personajes,
            files::save_api_key,
            files::load_api_key,
            files::leer_apikey_json,
            files::guardar_apikey_token,
            files::leer_usuarios_txt,
            files::leer_personajes_txt,
            files::save_bracket_json,
            files::save_json_custom,
            startgg::startgg_get_events,
            startgg::startgg_get_matches,
            startgg::startgg_get_standings,
            startgg::startgg_get_event_state,
            startgg::startgg_get_phase_name,
            challonge::get_tournaments,
            challonge::get_tournament_title,
            challonge::get_participants,
            challonge::get_top8,
            challonge::get_matches_and_participants,
            challonge::get_all_matches_and_participants,
            challonge::report_match_score,
            challonge::get_group_matches
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
