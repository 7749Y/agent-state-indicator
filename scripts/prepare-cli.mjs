// 编译独立的 qwq CLI，并按 Tauri externalBin 的命名规则放到 src-tauri/binaries。
// qwq 是单独 crate，避开主 crate 的 tauri-build（否则会先检查还未生成的 externalBin）。
// 打包时用 release，开发时用 debug。

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = join(root, "cli", "Cargo.toml");

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
    "--manifest-path",
    manifest,
    "--target",
    triple,
    ...(debug ? [] : ["--release"]),
  ],
  { cwd: root, stdio: "inherit" },
);

const metadata = JSON.parse(
  execFileSync(
    "cargo",
    [
      "metadata",
      "--format-version",
      "1",
      "--no-deps",
      "--manifest-path",
      manifest,
    ],
    { cwd: root, encoding: "utf8" },
  ),
);

const source = join(
  metadata.target_directory,
  triple,
  profile,
  `qwq${ext}`,
);
const target = join(root, "src-tauri", "binaries", `qwq-${triple}${ext}`);
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`CLI sidecar: ${target}`);
