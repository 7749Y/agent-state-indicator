//! 窗口位置尺寸落盘：和 bridge 共用安装目录下的 com.nanayonkyuu.asi。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

const FILENAME: &str = ".window-state.json";

#[derive(Serialize, Deserialize)]
struct Saved {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

fn path() -> Option<PathBuf> {
    crate::paths::data_dir().map(|dir| dir.join(FILENAME))
}

fn load() -> Option<Saved> {
    let raw = std::fs::read_to_string(path()?).ok()?;
    serde_json::from_str(&raw).ok()
}

/// 启动时还原；位置不在任何显示器上就交给系统摆
pub fn restore(window: &WebviewWindow) {
    let Some(saved) = load() else {
        return;
    };

    let position = PhysicalPosition::new(saved.x, saved.y);
    let size = PhysicalSize::new(saved.width, saved.height);
    let visible = window
        .available_monitors()
        .map(|monitors| {
            monitors.iter().any(|monitor| {
                let origin = monitor.position();
                let extent = monitor.size();
                let (left, top) = (origin.x, origin.y);
                let (right, bottom) = (left + extent.width as i32, top + extent.height as i32);
                let (x, y) = (saved.x, saved.y);
                let (w, h) = (saved.width as i32, saved.height as i32);
                x < right && x + w > left && y < bottom && y + h > top
            })
        })
        .unwrap_or(false);

    if visible {
        let _ = window.set_position(position);
    }
    let _ = window.set_size(size);
}

/// 退出前存一份；最小化/最大化时尺寸位置不可信，跳过
pub fn save(window: &WebviewWindow) {
    if window.is_minimized().unwrap_or(false) || window.is_maximized().unwrap_or(false) {
        return;
    }
    let (Ok(size), Ok(position)) = (window.inner_size(), window.outer_position()) else {
        return;
    };
    if size.width == 0 || size.height == 0 {
        return;
    }

    let saved = Saved {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
    };
    let Some(path) = path() else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(raw) = serde_json::to_string(&saved) {
        let _ = std::fs::write(path, raw);
    }
}
