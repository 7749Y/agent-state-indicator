import { getCurrentWindow } from "@tauri-apps/api/window";

/** 虚化透明度：100 全透明，0 不透明 */
export type Transparency = 0 | 25 | 50 | 75 | 100;

export const TRANSPARENCIES: Transparency[] = [0, 25, 50, 75, 100];

const KEY = "ghost-transparency";

function isTransparency(value: unknown): value is Transparency {
  return value === 0 || value === 25 || value === 50 || value === 75 || value === 100;
}

function load(): Transparency {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return 50;
    const value = Number(raw);
    return isTransparency(value) ? value : 50;
  } catch {
    return 50;
  }
}

function save(value: Transparency) {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // 存不上就算了
  }
}

/** 虚化模式：窗口半透明，鼠标事件穿透给后面的窗口。 */
export class GhostMode {
  private ghosting = false;
  private transparency: Transparency = load();
  private revealed = false;
  private revealTimer: number | null = null;
  private listeners = new Set<() => void>();

  /** 虚化与普通模式来回切。 */
  toggle = () => {
    this.ghosting = !this.ghosting;
    if (!this.ghosting) this.clearReveal();
    void getCurrentWindow().setIgnoreCursorEvents(this.ghosting);
    this.listeners.forEach((listener) => listener());
  };

  isGhosting = () => this.ghosting;

  /** 虚化中临时取消透明度，ms 后恢复；连续调用重新计时 */
  reveal = (ms = 3000) => {
    if (!this.ghosting) return;

    this.revealed = true;
    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    this.revealTimer = window.setTimeout(() => {
      this.revealTimer = null;
      this.revealed = false;
      this.listeners.forEach((listener) => listener());
    }, ms);
    this.listeners.forEach((listener) => listener());
  };

  isRevealed = () => this.revealed;

  private clearReveal() {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    this.revealed = false;
  }

  getTransparency = () => this.transparency;

  /** 指定虚化透明度，落盘 */
  setTransparency(value: Transparency) {
    if (value === this.transparency) return;
    this.transparency = value;
    save(value);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
