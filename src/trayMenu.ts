import { defaultWindowIcon, exit } from "@tauri-apps/api/app";
import { CheckMenuItem, Menu, Submenu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import type { GhostMode } from "./ghostMode";
import { SKIN_LABELS, SKINS, type Skin, type SkinName } from "./skin";

const TRAY_ID = "traffic-light";

/** 托盘菜单：托盘图标右键弹出菜单。 */
export class TrayMenu {
  private mounting: Promise<void> | null = null;
  private skinItems = new Map<SkinName, CheckMenuItem>();

  constructor(
    private ghost: GhostMode,
    private skin: Skin,
  ) {}

  /** 挂载托盘与菜单，重复调用只会建一次。 */
  mount() {
    this.mounting ??= this.create();
    return this.mounting;
  }

  private async create() {
    const menu = await Menu.new({
      items: [
        {
          id: "ghost",
          text: "虚化",
          action: () => this.ghost.toggle(),
        },
        await this.skinSubmenu(),
        {
          id: "quit",
          text: "退出",
          action: () => void exit(0),
        },
      ],
    });

    // 托盘活在进程里，刷新后还在：换掉菜单就行，别再新建一个
    const existing = await TrayIcon.getById(TRAY_ID);
    if (existing) {
      await existing.setMenu(menu);
      return;
    }

    await TrayIcon.new({
      id: TRAY_ID,
      tooltip: "红绿灯",
      icon: (await defaultWindowIcon()) ?? undefined,
      menu,
      showMenuOnLeftClick: false,
    });
  }

  /** 皮肤二级菜单：每套一个勾选项，点哪项切哪项 */
  private async skinSubmenu() {
    const items = await Promise.all(SKINS.map((name) => this.skinItem(name)));
    items.forEach((item, index) => this.skinItems.set(SKINS[index], item));
    return Submenu.new({ text: "皮肤", items });
  }

  private async skinItem(name: SkinName) {
    return CheckMenuItem.new({
      id: `skin-${name}`,
      text: SKIN_LABELS[name],
      checked: this.skin.getSkin() === name,
      action: () => {
        this.skin.set(name);
        this.skinItems.forEach((item, key) => void item.setChecked(key === name));
      },
    });
  }
}
