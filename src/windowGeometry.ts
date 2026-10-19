import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";

/** 比例基准：宽 164 逻辑像素 ↔ 高 472 ↔ 根字号 16 */
export const BASE = { width: 164, height: 472, font: 16 } as const;

/** 缩放下限：最小宽度（逻辑像素） */
export const MIN_WIDTH = 136;

export const MAX_SCALE = 3;

/** 显示器可视区（逻辑像素） */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 当前窗口所在显示器的可视区（避让任务栏），拿不到就返回 null（不限制） */
export async function screen(): Promise<Box | null> {
  // screen.avail* 给的就是去掉任务栏的工作区，还跟着窗口所在的屏走
  const local = window.screen as Screen & { availLeft?: number; availTop?: number };
  if (local.availWidth > 0 && local.availHeight > 0) {
    return {
      x: local.availLeft ?? 0,
      y: local.availTop ?? 0,
      width: local.availWidth,
      height: local.availHeight,
    };
  }

  const monitor = await currentMonitor();
  if (!monitor) return null;
  const scale = monitor.scaleFactor;
  const origin = monitor.position.toLogical(scale);
  const size = monitor.size.toLogical(scale);
  return { x: origin.x, y: origin.y, width: size.width, height: size.height };
}

/** 按宽度算高度；small 模式是正方形，高等于宽 */
export function ratioHeight(width: number, small = false) {
  return small ? width : BASE.height * (width / BASE.width);
}

/** 宽度上限：屏幕宽、屏幕高按比例折算、最大缩放，三者取小 */
export function maxWidth(
  box: Box | null,
  anchor?: { x: number; y: number },
  small = false,
) {
  const limit = BASE.width * MAX_SCALE;
  if (!box) return limit;

  const ratio = small ? 1 : BASE.height / BASE.width;
  let room = Math.min(box.width, box.height / ratio);
  if (anchor) {
    // 缩放锚在左上角，往下往右长，边界就是屏幕右下角
    room = Math.min(
      room,
      box.x + box.width - anchor.x,
      (box.y + box.height - anchor.y) / ratio,
    );
  }
  return Math.max(MIN_WIDTH, Math.min(limit, room));
}

/** 把左上角夹进屏幕，保证整窗可见 */
export function clampPosition(
  box: Box | null,
  x: number,
  y: number,
  width: number,
  height = ratioHeight(width),
) {
  if (!box) return { x, y };
  const maxX = Math.max(box.x, box.x + box.width - width);
  const maxY = Math.max(box.y, box.y + box.height - height);
  return {
    x: Math.min(Math.max(x, box.x), maxX),
    y: Math.min(Math.max(y, box.y), maxY),
  };
}

/** 把当前窗口夹回屏幕，只动位置（位置尺寸的存取由后端 window_state 管） */
export async function clampIntoView(box?: Box | null) {
  const win = getCurrentWindow();
  const [position, size, scale] = await Promise.all([
    win.outerPosition(),
    win.innerSize(),
    win.scaleFactor(),
  ]);

  const logical = position.toLogical(scale);
  const inner = size.toLogical(scale);
  const target = clampPosition(
    box ?? (await screen()),
    logical.x,
    logical.y,
    inner.width,
    inner.height,
  );

  if (target.x !== logical.x || target.y !== logical.y) {
    void win.setPosition(
      new LogicalPosition(Math.round(target.x), Math.round(target.y)),
    );
  }
}

/** 设定尺寸，顺带把根字号按同一比例改，布局才严丝合缝 */
export async function applySize(
  width: number,
  position?: { x: number; y: number },
  height = ratioHeight(width),
) {
  const ratio = width / BASE.width;
  document.documentElement.style.fontSize = `${BASE.font * ratio}px`;

  const win = getCurrentWindow();
  const jobs: Promise<unknown>[] = [
    win.setSize(new LogicalSize(Math.round(width), Math.round(height))),
  ];
  if (position) {
    jobs.push(
      win.setPosition(
        new LogicalPosition(Math.round(position.x), Math.round(position.y)),
      ),
    );
  }
  await Promise.all(jobs);
}
