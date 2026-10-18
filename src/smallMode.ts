/** 小灯模式：窗口变正方形，只显示一个灯。状态落盘。 */

const KEY = "small-mode";

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function save(small: boolean) {
  try {
    localStorage.setItem(KEY, small ? "1" : "0");
  } catch {
    // 存不上就算了
  }
}

export class SmallMode {
  private small = load();
  private listeners = new Set<() => void>();

  isSmall = () => this.small;

  /** 开关小灯模式，落盘 */
  set(small: boolean) {
    if (small === this.small) return;
    this.small = small;
    save(small);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
