/** 灯的状态：-1 红灯、0 黄灯、1 绿灯 */
export type LightState = -1 | 0 | 1;

/** 红绿灯控制：state 与 text 的唯一来源，灯亮哪盏、屏上写什么都由它决定。 */
export class LightControl {
  private state: LightState;
  private text: string;
  private listeners = new Set<() => void>();

  constructor(state: LightState = -1, text = "") {
    this.state = state;
    this.text = text;
  }

  /** 屏上显示的完整文字：[state] text */
  getDisplay = () => `[${this.state}] ${this.text}`;

  getState = () => this.state;

  getText = () => this.text;

  /** 同时写两个参数 */
  set(state: LightState, text: string) {
    if (state !== -1 && state !== 0 && state !== 1) {
      throw new Error(`state 只能是 -1 / 0 / 1，收到 ${state}`);
    }
    if (state === this.state && text === this.text) return;

    this.state = state;
    this.text = text;
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
