/** 皮肤：卡通 / 扁平 / 暗色。切换写到根节点的 data-skin 上，样式自己认领。 */

export type SkinName = "cartoon" | "flat" | "dark";

const KEY = "skin";

/** 顺序就是托盘里列出的顺序 */
export const SKINS: SkinName[] = ["cartoon", "flat", "dark"];

export const SKIN_LABELS: Record<SkinName, string> = {
  cartoon: "卡通",
  flat: "扁平",
  dark: "暗色",
};

function isSkin(value: unknown): value is SkinName {
  return SKINS.includes(value as SkinName);
}

function load(): SkinName | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isSkin(raw) ? raw : null;
  } catch {
    return null;
  }
}

function save(skin: SkinName) {
  try {
    localStorage.setItem(KEY, skin);
  } catch {
    // 存不上就算了
  }
}

/** 首帧前先把皮肤挂上，免得闪一下没样式 */
export function applyStoredSkin() {
  document.documentElement.dataset.skin = load() ?? SKINS[0];
}

export class Skin {
  private skin: SkinName;

  constructor(fallback: SkinName = SKINS[0]) {
    this.skin = load() ?? fallback;
    this.paint();
  }

  /** 指定皮肤，落盘 */
  set(name: SkinName) {
    if (name === this.skin) return;
    this.skin = name;
    save(name);
    this.paint();
  }

  getSkin = () => this.skin;

  private paint() {
    document.documentElement.dataset.skin = this.skin;
  }
}
