import { getCurrentWindow } from "@tauri-apps/api/window";

/** 虚化模式：窗口半透明，鼠标事件穿透给后面的窗口。 */
export class GhostMode {
  private ghosting = false;
  private listeners = new Set<() => void>();

  /** 虚化与普通模式来回切。 */
  toggle = () => {
    this.ghosting = !this.ghosting;
    void getCurrentWindow().setIgnoreCursorEvents(this.ghosting);
    this.listeners.forEach((listener) => listener());
  };

  isGhosting = () => this.ghosting;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
