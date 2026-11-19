#[cfg(all(windows, target_env = "gnu", target_arch = "x86_64"))]
mod embedded_loader;
mod updates;
#[cfg(not(target_os = "android"))]
use tauri::Manager;
#[cfg_attr(target_os = "android", tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(target_os = "android"))]
    let builder = builder
        .manage(updates::WindowsUpdates::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    builder.invoke_handler(tauri::generate_handler![updates::check_update, updates::install_update, updates::open_update_website]).run(tauri::generate_context!())
        .expect("failed to run Puzzle");
}
