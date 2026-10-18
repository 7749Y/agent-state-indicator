import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SmallMode } from "./smallMode";
import {
  applySize,
  clampIntoView,
  clampPosition,
  maxWidth,
  MIN_WIDTH,
  ratioHeight,
  screen,
  type Box,
} from "./windowGeometry";

/** 右下角角标：拖动时按初始比例缩放窗口，内容随根字号等比放大。 */
export class WindowResize {
  constructor(private small: SmallMode) {}

  private box: Box | null = null;
  private anchor = { x: 0, y: 0 };
  private origin: { pointerX: number; width: number } | null = null;
  private pending: number | null = null;
  private frame = 0;

  /** 启动时按插件恢复出来的尺寸校准根字号，并把窗口夹回屏幕 */
  restore = async () => {
    const win = getCurrentWindow();
    const [position, size, scale, box] = await Promise.all([
      win.outerPosition(),
      win.innerSize(),
      win.scaleFactor(),
      screen(),
    ]);
    this.box = box;

    const logical = position.toLogical(scale);
    const small = this.small.isSmall();
    const width = Math.min(
      Math.max(size.toLogical(scale).width, MIN_WIDTH),
      maxWidth(box, undefined, small),
    );
    const height = ratioHeight(width, small);
    const target = clampPosition(box, logical.x, logical.y, width, height);

    try {
      await applySize(width, target, height);
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
    void applySize(width, undefined, ratioHeight(width, this.small.isSmall()));
  };

  private handleMouseUp = () => {
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    this.origin = null;
    void clampIntoView(this.box);
  };

  /** 切到/离开小灯模式：宽度不变，高度在正方形与原比例之间换 */
  applySmall = async (small: boolean) => {
    const win = getCurrentWindow();
    const [position, size, scale, box] = await Promise.all([
      win.outerPosition(),
      win.innerSize(),
      win.scaleFactor(),
      screen(),
    ]);
    const logical = position.toLogical(scale);
    const inner = size.toLogical(scale);

    const width = Math.min(
      Math.max(inner.width, MIN_WIDTH),
      maxWidth(box, undefined, small),
    );
    const height = ratioHeight(width, small);
    const target = clampPosition(box, logical.x, logical.y, width, height);
    await applySize(width, target, height);
  };

  private clamp(width: number) {
    return Math.min(
      Math.max(width, MIN_WIDTH),
      maxWidth(this.box, this.anchor, this.small.isSmall()),
    );
  }
}
