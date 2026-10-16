import {
  currentMonitor,
  getCurrentWindow,
  LogicalPosition,
  LogicalSize,
} from "@tauri-apps/api/window";

/** 比例基准：宽 164 逻辑像素 ↔ 高 472 ↔ 根字号 16 */
export const BASE = { width: 164, height: 472, font: 16 } as const;

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;

/** 显示器可视区（逻辑像素） */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 落盘的位置和宽度，高度由比例推出来 */
export interface Saved {
  x: number;
  y: number;
  width: number;
}

const KEY = "window-geometry";

export function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { x, y, width } = JSON.parse(raw) as Partial<Saved>;
    if (![x, y, width].every((v) => typeof v === "number" && Number.isFinite(v))) {
      return null;
    }
    return { x: x as number, y: y as number, width: width as number };
  } catch {
    return null;
  }
}

function save(geometry: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(geometry));
  } catch {
    // 存不上就算了，下次按默认走
  }
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

export function ratioWidth(width: number) {
  return BASE.height * (width / BASE.width);
}

/** 宽度上限：屏幕宽、屏幕高按比例折算、最大缩放，三者取小 */
export function maxWidth(box: Box | null, anchor?: { x: number; y: number }) {
  const limit = BASE.width * MAX_SCALE;
  if (!box) return limit;

  let room = Math.min(box.width, box.height * (BASE.width / BASE.height));
  if (anchor) {
    // 缩放锚在左上角，往下往右长，边界就是屏幕右下角
    room = Math.min(
      room,
      box.x + box.width - anchor.x,
      (box.y + box.height - anchor.y) * (BASE.width / BASE.height),
    );
  }
  return Math.max(BASE.width * MIN_SCALE, Math.min(limit, room));
}

/** 把左上角夹进屏幕，保证整窗可见 */
export function clampPosition(
  box: Box | null,
  x: number,
  y: number,
  width: number,
) {
  if (!box) return { x, y };
  const height = ratioWidth(width);
  const maxX = Math.max(box.x, box.x + box.width - width);
  const maxY = Math.max(box.y, box.y + box.height - height);
  return {
    x: Math.min(Math.max(x, box.x), maxX),
    y: Math.min(Math.max(y, box.y), maxY),
  };
}

/** 读回当前窗口的落位，夹进屏幕，落盘 */
export async function persist(box?: Box | null) {
  const win = getCurrentWindow();
  const [position, size, scale] = await Promise.all([
    win.outerPosition(),
    win.innerSize(),
    win.scaleFactor(),
  ]);

  const logical = position.toLogical(scale);
  const width = size.toLogical(scale).width;
  const fixed = clampPosition(box ?? (await screen()), logical.x, logical.y, width);

  if (fixed.x !== logical.x || fixed.y !== logical.y) {
    void win.setPosition(
      new LogicalPosition(Math.round(fixed.x), Math.round(fixed.y)),
    );
  }

  const rounded = {
    x: Math.round(fixed.x),
    y: Math.round(fixed.y),
    width: Math.round(width),
  };
  save(rounded);
  return rounded;
}

/** 设定尺寸，顺带把根字号按同一比例改，布局才严丝合缝 */
export async function applySize(
  width: number,
  position?: { x: number; y: number },
) {
  const ratio = width / BASE.width;
  document.documentElement.style.fontSize = `${BASE.font * ratio}px`;

  const win = getCurrentWindow();
  const jobs: Promise<unknown>[] = [
    win.setSize(new LogicalSize(Math.round(width), Math.round(ratioWidth(width)))),
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
