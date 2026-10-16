//! 本地 HTTP 桥：给外部工具一个调 ctl 的入口。
//!
//! 监听 127.0.0.1:0 让系统分配端口，启动时把 { port, token } 写进
//! app_data_dir/bridge.json，请求要带 `Authorization: Bearer <token>`。
//! GET / 读回 "[state] text"，POST / 收 {"state":0,"text":"..."} 写参数。

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

/// 桥镜像的 state/text，前端每次改动都会同步过来
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Control {
    state: i32,
    text: String,
}

impl Control {
    fn display(&self) -> String {
        format!("[{}] {}", self.state, self.text)
    }
}

#[derive(Default)]
pub struct ControlMirror(pub Mutex<Control>);

/// 前端把最新参数推过来，桥读的就是这份
#[tauri::command]
pub fn sync_control(mirror: tauri::State<ControlMirror>, state: i32, text: String) {
    if let Ok(mut control) = mirror.0.lock() {
        *control = Control { state, text };
    }
}

struct Request {
    method: String,
    auth: Option<String>,
    body: String,
}

#[derive(Deserialize)]
struct WriteBody {
    state: i32,
    text: Option<String>,
}

/// 起桥：端口随机，信息落盘
pub fn start(app: AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => listener,
        Err(_) => return,
    };
    let port = match listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(_) => return,
    };
    let token = make_token();

    if !write_info(&app, port, &token) {
        return;
    }

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            handle(&app, stream, &token);
        }
    });
}

fn make_token() -> String {
    let mut hasher = DefaultHasher::new();
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
        .hash(&mut hasher);
    std::process::id().hash(&mut hasher);

    let mut token = String::with_capacity(32);
    for _ in 0..2 {
        let value = hasher.finish();
        token.push_str(&format!("{value:016x}"));
        value.hash(&mut hasher);
    }
    token
}

fn info_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("bridge.json"))
}

fn write_info(app: &AppHandle, port: u16, token: &str) -> bool {
    let Some(path) = info_path(app) else {
        return false;
    };
    let Some(dir) = path.parent() else {
        return false;
    };
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }

    let info = serde_json::json!({ "port": port, "token": token });
    std::fs::write(path, info.to_string()).is_ok()
}

/// 退出时删掉 bridge.json，免得 CLI 照着过时的端口去连
pub fn cleanup(app: &AppHandle) {
    if let Some(path) = info_path(app) {
        let _ = std::fs::remove_file(path);
    }
}

fn handle(app: &AppHandle, mut stream: TcpStream, token: &str) {
    let Some(request) = read_request(&mut stream) else {
        return;
    };

    if request.auth.as_deref() != Some(&format!("Bearer {token}")) {
        return respond(&mut stream, 401, "token 不对");
    }

    match request.method.as_str() {
        "GET" => {
            let control = app.state::<ControlMirror>();
            let display = match control.0.lock() {
                Ok(control) => control.display(),
                Err(_) => return respond(&mut stream, 500, "锁坏了"),
            };
            respond(&mut stream, 200, &display);
        }
        "POST" => {
            let Ok(body) = serde_json::from_str::<WriteBody>(&request.body) else {
                return respond(&mut stream, 400, "body 得是 {\"state\":0,\"text\":\"..\"}");
            };
            if !(-1..=1).contains(&body.state) {
                return respond(&mut stream, 400, "state 只能 -1 / 0 / 1");
            }

            let control = app.state::<ControlMirror>();
            let next = {
                let Ok(mut current) = control.0.lock() else {
                    return respond(&mut stream, 500, "锁坏了");
                };
                current.state = body.state;
                if let Some(text) = body.text {
                    current.text = text;
                }
                current.clone()
            };

            let _ = app.emit("bridge:ctl", next);
            respond(&mut stream, 200, "0");
        }
        _ => respond(&mut stream, 405, "只认 GET / POST"),
    }
}

fn read_request(stream: &mut TcpStream) -> Option<Request> {
    let mut reader = BufReader::new(stream.try_clone().ok()?);
    let mut head = String::new();

    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).ok()? == 0 {
            return None;
        }
        if line == "\r\n" {
            break;
        }
        if head.len() + line.len() > 8192 {
            return None;
        }
        head.push_str(&line);
    }

    let mut lines = head.lines();
    let mut parts = lines.next()?.split_whitespace();
    let method = parts.next()?.to_string();

    let mut length = 0usize;
    let mut auth = None;
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        match name.to_ascii_lowercase().as_str() {
            "content-length" => length = value.trim().parse().unwrap_or(0),
            "authorization" => auth = Some(value.trim().to_string()),
            _ => {}
        }
    }

    let mut raw = vec![0u8; length.min(64 * 1024)];
    if !raw.is_empty() {
        reader.read_exact(&mut raw).ok()?;
    }

    Some(Request {
        method,
        auth,
        body: String::from_utf8_lossy(&raw).into_owned(),
    })
}

fn respond(stream: &mut TcpStream, status: u16, body: &str) {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        405 => "Method Not Allowed",
        _ => "Error",
    };
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}
