import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";

/** 窗口拖动：在窗口内按下左键，窗口持续跟随光标移动。 */
export class WindowDrag {
  /** 命中这些元素时不拖动，免得抢掉灯的点按。 */
  private static readonly SKIP =
    "button, a, input, textarea, select, [data-no-drag]";

  private origin: { pointerX: number; pointerY: number; windowX: number; windowY: number } | null =
    null;
  private pending: { x: number; y: number } | null = null;
  private frame = 0;

  handleMouseDown = async (event: ReactMouseEvent) => {
    if (event.button !== 0 || this.origin) return;
    if ((event.target as HTMLElement).closest(WindowDrag.SKIP)) return;
    event.preventDefault();

    const win = getCurrentWindow();
    const [position, scale] = await Promise.all([
      win.outerPosition(),
      win.scaleFactor(),
    ]);
    const logical = position.toLogical(scale);

    this.origin = {
      pointerX: event.screenX,
      pointerY: event.screenY,
      windowX: logical.x,
      windowY: logical.y,
    };

    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.origin) return;

    this.pending = {
      x: this.origin.windowX + (event.screenX - this.origin.pointerX),
      y: this.origin.windowY + (event.screenY - this.origin.pointerY),
    };
    if (this.frame) return;

    this.frame = requestAnimationFrame(this.flush);
  };

  private flush = () => {
    this.frame = 0;
    const target = this.pending;
    if (!target) return;
    this.pending = null;
    void getCurrentWindow().setPosition(
      new LogicalPosition(target.x, target.y),
    );
  };

  private handleMouseUp = () => {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    this.origin = null;
  };
}
