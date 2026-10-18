/** 灯的状态：-1 红灯、0 黄灯、1 绿灯 */
export type LightState = -1 | 0 | 1;

interface Saved {
  state: LightState;
  text: string;
}

/** 本地存一份，刷新窗口不会回初值 */
const STORAGE_KEY = "traffic-light";

function isState(value: unknown): value is LightState {
  return value === -1 || value === 0 || value === 1;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as Partial<Saved>;
    if (!isState(data.state) || typeof data.text !== "string") return null;
    return { state: data.state, text: data.text };
  } catch {
    return null;
  }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // 存不了就算了，不影响界面
  }
}

/** 红绿灯控制：state 与 text 的唯一来源，灯亮哪盏、屏上写什么都由它决定。 */
export class LightControl {
  private state: LightState;
  private text: string;
  private resetSnapshot: Saved | null = null;
  private listeners = new Set<() => void>();

  constructor(state: LightState = -1, text = "") {
    const saved = load();
    this.state = saved?.state ?? state;
    this.text = saved?.text ?? text;
  }

  /** 屏上显示的完整文字：[state] text */
  getDisplay = () => `[${this.state}] ${this.text}`;

  getState = () => this.state;

  getText = () => this.text;

  /** 同时写两个参数 */
  set(state: LightState, text: string) {
    if (!isState(state)) {
      throw new Error(`state 只能是 -1 / 0 / 1，收到 ${state}`);
    }
    if (state === this.state && text === this.text) return;

    this.state = state;
    this.text = text;
    save({ state, text });
    this.listeners.forEach((listener) => listener());
  }

  /** 重置为 state=-1、text=""。重置前不是 -1 的话留一份快照给撤销 */
  reset() {
    if (this.state !== -1) {
      this.resetSnapshot = { state: this.state, text: this.text };
    }
    this.set(-1, "");
  }

  /** 只在 state 为 -1 且有快照时可撤销，撤销后回到重置前的参数 */
  canUndo = () => this.resetSnapshot !== null && this.state === -1;

  undo() {
    if (!this.canUndo()) return;
    const { state, text } = this.resetSnapshot as Saved;
    this.set(state, text);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
