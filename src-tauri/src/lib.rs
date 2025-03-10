mod download_function;
use crate::download_function::download_file;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![download_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
