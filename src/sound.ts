import type { LightControl, LightState } from "./lightControl";

/** 音效：state 从别的值切到 1 时响一声。 */
export class Sound {
  private readonly audio: HTMLAudioElement;
  private last: LightState;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly control: LightControl,
    src = "/bbkb.mp3",
  ) {
    this.audio = new Audio(src);
    this.audio.preload = "auto";
    // 启动时恢复出来的 state 不算切换，不响
    this.last = control.getState();
  }

  start() {
    this.unsubscribe ??= this.control.subscribe(this.handleChange);
    return () => this.destroy();
  }

  destroy() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private handleChange = () => {
    const state = this.control.getState();
    const trigger = state === 1 && this.last !== 1;
    this.last = state;
    if (!trigger) return;

    // 连着响时从头来
    try {
      this.audio.currentTime = 0;
    } catch {
      // 还没加载好，直接往下播
    }
    void this.audio.play().catch(() => {});
  };
}
