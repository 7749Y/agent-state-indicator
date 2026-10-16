import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  applySize,
  BASE,
  clampPosition,
  load,
  maxWidth,
  MIN_SCALE,
  persist,
  screen,
  type Box,
} from "./windowGeometry";

/** 右下角角标：拖动时按初始比例缩放窗口，内容随根字号等比放大。 */
export class WindowResize {
  private box: Box | null = null;
  private anchor = { x: 0, y: 0 };
  private origin: { pointerX: number; width: number } | null = null;
  private pending: number | null = null;
  private frame = 0;

  /** 启动时读回落盘的位置和尺寸，夹进屏幕后应用 */
  restore = async () => {
    const win = getCurrentWindow();
    const [position, size, scale, box] = await Promise.all([
      win.outerPosition(),
      win.innerSize(),
      win.scaleFactor(),
      screen(),
    ]);
    this.box = box;

    const saved = load();
    const logical = position.toLogical(scale);
    const width = Math.min(
      Math.max(saved?.width ?? size.toLogical(scale).width, BASE.width * MIN_SCALE),
      maxWidth(box),
    );
    const target = clampPosition(
      box,
      saved?.x ?? logical.x,
      saved?.y ?? logical.y,
      width,
    );

    try {
      await applySize(width, target);
      await persist(box); // 首次启动也留一份，屏幕上被夹过的位置以这份为准
    } finally {
      // 窗口是先隐藏再摆位，摆好才露面，看不到跳位
      void win.show();
    }
  };

  handleMouseDown = async (event: ReactMouseEvent) => {
    if (event.button !== 0 || this.origin) return;
    event.preventDefault();
    event.stopPropagation();

    const win = getCurrentWindow();
    const [position, size, scale, box] = await Promise.all([
      win.outerPosition(),
      win.innerSize(),
      win.scaleFactor(),
      screen(),
    ]);
    const logical = position.toLogical(scale);

    this.box = box;
    this.anchor = { x: logical.x, y: logical.y };
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

    this.pending = this.clamp(
      this.origin.width + event.screenX - this.origin.pointerX,
    );
    if (this.frame) return;

    this.frame = requestAnimationFrame(this.flush);
  };

  private flush = () => {
    this.frame = 0;
    const width = this.pending;
    if (width === null) return;
    this.pending = null;
    void applySize(width);
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

  private clamp(width: number) {
    return Math.min(
      Math.max(width, BASE.width * MIN_SCALE),
      maxWidth(this.box, this.anchor),
    );
  }
}
