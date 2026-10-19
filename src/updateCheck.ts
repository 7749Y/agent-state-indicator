import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";

/** 版本检查：启动时问一次 GitHub 最新 release，比本地版本新就算有更新 */
const RELEASES_API =
  "https://api.github.com/repos/7749Y/agent-state-indicator/releases/latest";

/** 只比 主.次.补 三段，忽略 v 前缀和预发布后缀 */
function parse(version: string): number[] | null {
  const match = version.replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function isNewer(latest: string, current: string) {
  const next = parse(latest);
  const now = parse(current);
  if (!next || !now) return false;
  for (let i = 0; i < 3; i++) {
    if (next[i] !== now[i]) return next[i] > now[i];
  }
  return false;
}

export class UpdateCheck {
  private latest: string | null = null;
  private url: string | null = null;
  private running = false;
  private listeners = new Set<() => void>();

  /** 是否检测到新版本 */
  isAvailable = () => this.latest !== null;

  /** 新版本号，没有更新时为 null */
  getVersion = () => this.latest;

  /** 启动时调一次；失败或没有新版本都保持不可用 */
  async check() {
    if (this.running) return;
    this.running = true;
    try {
      const current = await getVersion();
      const response = await fetch(RELEASES_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) return;

      const release = (await response.json()) as {
        tag_name?: string;
        html_url?: string;
      };
      if (!release.tag_name || !release.html_url) return;
      if (!isNewer(release.tag_name, current)) return;

      this.latest = release.tag_name.replace(/^v/i, "");
      this.url = release.html_url;
      this.listeners.forEach((listener) => listener());
    } catch {
      // 离线或接口出错：当作没有更新
    } finally {
      this.running = false;
    }
  }

  /** 打开新版本的发布页；没有更新时什么都不做 */
  async open() {
    if (this.url) await openUrl(this.url);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
