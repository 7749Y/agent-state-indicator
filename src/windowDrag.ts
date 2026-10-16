import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";
import { clampPosition, persist, screen, type Box } from "./windowGeometry";

/** 窗口拖动：在窗口内按下左键，窗口持续跟随光标移动，但夹在屏幕里。 */
export class WindowDrag {
  /** 命中这些元素时不拖动，免得抢掉灯的点按。 */
  private static readonly SKIP =
    "button, a, input, textarea, select, [data-no-drag]";

  private box: Box | null = null;
  private origin: {
    pointerX: number;
    pointerY: number;
    windowX: number;
    windowY: number;
    width: number;
    height: number;
  } | null = null;
  private pending: { x: number; y: number } | null = null;
  private frame = 0;

  handleMouseDown = async (event: ReactMouseEvent) => {
    if (event.button !== 0 || this.origin) return;
    if ((event.target as HTMLElement).closest(WindowDrag.SKIP)) return;
    event.preventDefault();

    const win = getCurrentWindow();
    const [position, size, scale, box] = await Promise.all([
      win.outerPosition(),
      win.innerSize(),
      win.scaleFactor(),
      screen(),
    ]);
    const logical = position.toLogical(scale);
    const inner = size.toLogical(scale);

    this.box = box;
    this.origin = {
      pointerX: event.screenX,
      pointerY: event.screenY,
      windowX: logical.x,
      windowY: logical.y,
      width: inner.width,
      height: inner.height,
    };

    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  private handleMouseMove = (event: MouseEvent) => {
    const origin = this.origin;
    if (!origin) return;

    this.pending = clampPosition(
      this.box,
      origin.windowX + (event.screenX - origin.pointerX),
      origin.windowY + (event.screenY - origin.pointerY),
      origin.width,
    );
    if (this.frame) return;

    this.frame = requestAnimationFrame(this.flush);
  };

  private flush = () => {
    this.frame = 0;
    const target = this.pending;
    if (!target) return;
    this.pending = null;
    void getCurrentWindow().setPosition(
      new LogicalPosition(Math.round(target.x), Math.round(target.y)),
    );
  };

  private handleMouseUp = () => {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    this.origin = null;
    void persist(this.box);
  };
}
