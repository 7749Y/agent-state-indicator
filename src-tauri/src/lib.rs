mod bridge;
mod paths;
mod window_state;

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 单实例插件要第一个注册：重复启动时聚焦已有窗口，不再开第二个
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .manage(bridge::ControlMirror::default())
        .invoke_handler(tauri::generate_handler![greet, bridge::sync_control])
        .setup(|app| {
            bridge::start(app.handle().clone());

            // 窗口等前端摆好位置才 show，这里兜底：前端挂了也得露出来
            if let Some(window) = app.get_webview_window("main") {
                window_state::restore(&window);
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(window) = app.get_webview_window("main") {
                    window_state::save(&window);
                }
                bridge::cleanup();
            }
        });
}
