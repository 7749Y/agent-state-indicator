// 编译 qwq CLI 并按 Tauri externalBin 的命名规则放到 src-tauri/binaries。
// 打包时用 release，开发时用 debug。

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function hostTriple() {
  const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = out.match(/^host:\s*(.+)$/m);
  if (!match) throw new Error("rustc -vV 里没找到 host");
  return match[1].trim();
}

const triple = process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple();
const debug =
  process.env.TAURI_ENV_DEBUG === "true" ||
  process.env.TAURI_ENV_DEBUG === "1";
const profile = debug ? "debug" : "release";
const ext = triple.includes("windows") ? ".exe" : "";

execFileSync(
  "cargo",
  [
    "build",
    "--bin",
    "qwq",
    "--manifest-path",
    join(root, "src-tauri", "Cargo.toml"),
    "--target",
    triple,
    ...(debug ? [] : ["--release"]),
  ],
  { cwd: root, stdio: "inherit" },
);

const source = join(root, "src-tauri", "target", triple, profile, `qwq${ext}`);
const target = join(
  root,
  "src-tauri",
  "binaries",
  `qwq-${triple}${ext}`,
);
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`CLI sidecar: ${target}`);
