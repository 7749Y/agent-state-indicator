/** 红绿灯触摸控制：记录当前点亮的灯，点谁谁亮，其余自动熄灭。 */
export class LightControl {
  private activeIndex: number;
  private listeners = new Set<() => void>();

  constructor(initialIndex = 0) {
    this.activeIndex = initialIndex;
  }

  /** 点击第 index 盏灯：点亮该灯，其余熄灭。 */
  touch(index: number) {
    if (index === this.activeIndex) return;
    this.activeIndex = index;
    this.listeners.forEach((listener) => listener());
  }

  getActiveIndex = () => this.activeIndex;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
