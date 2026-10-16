import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

/** 右下角角标：拖动时按初始比例缩放窗口，内容随根字号等比放大。 */
export class WindowResize {
  private static readonly BASE_WIDTH = 164;
  private static readonly BASE_HEIGHT = 472;
  private static readonly BASE_FONT = 16;
  private static readonly MIN_SCALE = 0.5;
  private static readonly MAX_SCALE = 3;

  private origin: { pointerX: number; width: number } | null = null;
  private pending: number | null = null;
  private frame = 0;

  /** 启动时按当前窗口宽度校准根字号，刷新后不会掉回默认大小 */
  sync = async () => {
    const win = getCurrentWindow();
    const [size, scale] = await Promise.all([
      win.innerSize(),
      win.scaleFactor(),
    ]);
    this.apply(this.clamp(size.toLogical(scale).width));
  };

  handleMouseDown = async (event: ReactMouseEvent) => {
    if (event.button !== 0 || this.origin) return;
    event.preventDefault();
    event.stopPropagation();

    const win = getCurrentWindow();
    const [size, scale] = await Promise.all([
      win.innerSize(),
      win.scaleFactor(),
    ]);

    this.origin = {
      pointerX: event.screenX,
      width: size.toLogical(scale).width,
    };

    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);

    // 等异步返回期间就松手了，直接收尾
    if (event.buttons === 0) this.handleMouseUp();
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.origin) return;

    const width = this.clamp(this.origin.width + event.screenX - this.origin.pointerX);
    this.pending = width;
    if (this.frame) return;

    this.frame = requestAnimationFrame(this.flush);
  };

  private flush = () => {
    this.frame = 0;
    const width = this.pending;
    if (width === null) return;
    this.pending = null;
    this.apply(width);
  };

  private handleMouseUp = () => {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    this.origin = null;
  };

  private clamp(width: number) {
    const { BASE_WIDTH, MIN_SCALE, MAX_SCALE } = WindowResize;
    return Math.min(
      Math.max(width, BASE_WIDTH * MIN_SCALE),
      BASE_WIDTH * MAX_SCALE,
    );
  }

  /** 窗口尺寸与根字号一起按同一比例改，保证布局严丝合缝。 */
  private apply(width: number) {
    const { BASE_WIDTH, BASE_HEIGHT, BASE_FONT } = WindowResize;
    const ratio = width / BASE_WIDTH;
    document.documentElement.style.fontSize = `${BASE_FONT * ratio}px`;
    void getCurrentWindow().setSize(
      new LogicalSize(Math.round(width), Math.round(BASE_HEIGHT * ratio)),
    );
  }
}
