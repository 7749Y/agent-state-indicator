export interface LedTextOptions {
  /** 屏幕上的文字 */
  text: string;
  /** 滚动速度，px/秒 */
  speed: number;
  /** 文字大小，px（按 16px 换算成 rem，随窗口缩放） */
  fontSize: number;
  /** 点亮颜色 */
  color?: string;
}

/** LED 屏文本：文字比屏宽时无缝循环滚动，否则居中静止。 */
export class LedText {
  private readonly observer: ResizeObserver;
  private offset = 0;
  private distance = 0;
  private frame = 0;
  private last = 0;

  constructor(
    private readonly panel: HTMLElement,
    private readonly track: HTMLElement,
    /** 轨道里第一份文字，用来量一份的宽度 */
    private readonly copy: HTMLElement,
    private readonly options: LedTextOptions,
  ) {
    this.observer = new ResizeObserver(() => this.measure());
  }

  start() {
    this.track.style.fontSize = `${this.options.fontSize / 16}rem`;
    this.track.style.color = this.options.color ?? "#ff4d5e";
    this.measure();
    this.observer.observe(this.panel);
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    if (this.distance > 0) {
      this.offset += this.scale * this.options.speed * dt;
      // 走到第二份文字接上第一份的位置就绕回，视觉上无缝
      if (this.offset >= this.distance) this.offset -= this.distance;
      this.track.style.transform = `translateX(${-Math.round(this.offset)}px)`;
    }

    this.frame = requestAnimationFrame(this.tick);
  };

  /** 量一次宽度，决定居中还是滚动 */
  private measure() {
    const copyWidth = this.copy.getBoundingClientRect().width;
    const scrolling = copyWidth > this.panel.clientWidth;

    this.panel.classList.toggle("scrolling", scrolling);
    this.track.classList.toggle("centered", !scrolling);

    if (!scrolling) {
      this.distance = 0;
      this.offset = 0;
      this.track.style.transform = "translateX(0)";
      return;
    }

    // 两份文字错开的距离就是一轮的位移
    const trackWidth = this.track.getBoundingClientRect().width;
    this.distance = Math.max(1, trackWidth - copyWidth);
    this.offset %= this.distance;
  }

  /** 根字号相对 16px 的比例 */
  private get scale() {
    const root = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    return Number.isFinite(root) ? root / 16 : 1;
  }
}
