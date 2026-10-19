//! 极简 CLI：读 exe 同目录/com.nanayonkyuu.asi/bridge.json，走本地 HTTP 桥读写红绿灯参数。
//!
//!   qwq g             读
//!   qwq s 0 "文本"    写
//!
//! bridge.json 不在就当软件没开，拉起同目录的 asi.exe 再等它写盘。

use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

/// 跟主程序 paths.rs 里的目录名对应
const APP_DIR: &str = "com.nanayonkyuu.asi";
/// 打包后的主程序名，dev 里退回到 cargo 产物名
const APP_EXES: [&str; 2] = ["asi.exe", "tauri-app.exe"];
const WAIT_LIMIT: Duration = Duration::from_secs(15);

struct Info {
    port: u16,
    token: String,
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    let info = match read_info() {
        Some(info) => info,
        None => {
            if !launch_app() {
                fail("找不到红绿灯软件，也没能启动它");
            }
            match wait_for_info() {
                Some(info) => info,
                None => fail("启动了但没等到 bridge.json"),
            }
        }
    };

    match run(&args, &info) {
        Ok(out) => println!("{out}"),
        Err(err) => fail(&err),
    }
}

fn run(args: &[String], info: &Info) -> Result<String, String> {
    match args.first().map(String::as_str) {
        Some("g") => request(info, "GET", ""),
        Some("s") => {
            let Some(state) = args.get(1).and_then(|raw| raw.parse::<i32>().ok()) else {
                return Err("用法：qwq s <state> [text]".into());
            };
            let body = match args.get(2) {
                Some(text) => {
                    let text = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".into());
                    format!("{{\"state\":{state},\"text\":{text}}}")
                }
                None => format!("{{\"state\":{state}}}"),
            };
            request(info, "POST", &body)
        }
        _ => Err("用法：qwq g | qwq s <state> [text]".into()),
    }
}

fn request(info: &Info, method: &str, body: &str) -> Result<String, String> {
    let mut stream = TcpStream::connect(("127.0.0.1", info.port))
        .map_err(|err| format!("连不上桥：{err}"))?;

    let head = format!(
        "{method} / HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        info.token,
        body.len()
    );
    stream
        .write_all(head.as_bytes())
        .and_then(|_| stream.write_all(body.as_bytes()))
        .and_then(|_| stream.flush())
        .map_err(|err| format!("发不出去：{err}"))?;

    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|err| format!("收不到回话：{err}"))?;

    let (head, body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| "响应格式不对".to_string())?;
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("");

    if status != "200" {
        return Err(format!("桥返回 {status}：{body}"));
    }
    Ok(body.to_string())
}

fn info_path() -> Option<PathBuf> {
    let dir = std::env::current_exe()
        .ok()?
        .parent()
        .map(PathBuf::from)?;
    Some(dir.join(APP_DIR).join("bridge.json"))
}

fn read_info() -> Option<Info> {
    let raw = fs::read_to_string(info_path()?).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    Some(Info {
        port: value.get("port")?.as_u64()? as u16,
        token: value.get("token")?.as_str()?.to_string(),
    })
}

fn wait_for_info() -> Option<Info> {
    let deadline = Instant::now() + WAIT_LIMIT;
    while Instant::now() < deadline {
        if let Some(info) = read_info() {
            return Some(info);
        }
        thread::sleep(Duration::from_millis(200));
    }
    None
}

fn launch_app() -> bool {
    let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(PathBuf::from))
    else {
        return false;
    };
    let Some(exe) = APP_EXES
        .iter()
        .map(|name| dir.join(name))
        .find(|exe| exe.is_file())
    else {
        return false;
    };
    Command::new(exe).spawn().is_ok()
}

fn fail(message: &str) -> ! {
    eprintln!("{message}");
    std::process::exit(1);
}
