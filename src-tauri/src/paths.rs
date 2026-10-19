//! 运行期文件统一放软件安装目录下的 com.nanakyuu.asi，不碰用户 AppData。

use std::path::PathBuf;

pub const APP_DIR: &str = "com.nanakyuu.asi";

/// exe 同级目录再拼 APP_DIR；取不到 exe 路径就返回 None
pub fn data_dir() -> Option<PathBuf> {
    let dir = std::env::current_exe()
        .ok()?
        .parent()
        .map(PathBuf::from)?;
    Some(dir.join(APP_DIR))
}

/// WebView2 用户数据目录（localStorage 等都在这里）
pub fn webview_dir() -> Option<PathBuf> {
    data_dir().map(|dir| dir.join("webview"))
}
