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
    // 没给颜色就听皮肤的
    if (this.options.color) this.track.style.color = this.options.color;
    this.measure();
    // 屏会跟着窗口变宽窄，文字自己也会变宽（换字体、换内容），两头都得盯着
    this.observer.observe(this.panel);
    this.observer.observe(this.track);
    // 像素字体可能晚到，量到的宽度会变，上齐了再量一次
    void document.fonts
      ?.load(`${this.options.fontSize}px "Zpix"`)
      .then(() => this.measure())
      .catch(() => {});
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
      // 走到第二份文字接上第一份的位置就绕回：减掉的正是一个周期的长度，接缝对得上
      if (this.offset >= this.distance) this.offset -= this.distance;
      // 整像素取整会让每帧位移忽大忽小，接缝也跟着差一点，这里只做小数位收敛
      const x = Math.round(this.offset * 1000) / 1000;
      this.track.style.transform = `translateX(${-x}px)`;
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
