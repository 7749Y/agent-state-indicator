import { defaultWindowIcon, exit } from "@tauri-apps/api/app";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { Image } from "@tauri-apps/api/image";
import {
  CheckMenuItem,
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import {
  TRANSPARENCIES,
  type GhostMode,
  type Transparency,
} from "./ghostMode";
import type { LightControl } from "./lightControl";
import { SKIN_LABELS, SKINS, type Skin, type SkinName } from "./skin";
import type { SmallMode } from "./smallMode";
import type { Sound } from "./sound";

const TRAY_ID = "traffic-light";

/** 托盘菜单：托盘图标右键弹出菜单。 */
export class TrayMenu {
  private mounting: Promise<void> | null = null;
  private menu: Menu | null = null;
  private skinItems = new Map<SkinName, CheckMenuItem>();
  private transparencyItems = new Map<Transparency, CheckMenuItem>();
  private undoItem: MenuItem | null = null;

  constructor(
    private ghost: GhostMode,
    private skin: Skin,
    private control: LightControl,
    private sound: Sound,
    private small: SmallMode,
  ) {}

  /** 挂载托盘与菜单，重复调用只会建一次。 */
  mount() {
    this.mounting ??= this.create();
    return this.mounting;
  }

  /** 在窗口内坐标处弹出同一份菜单，用来顶掉网页默认右键菜单 */
  async popup(x: number, y: number) {
    await this.mount();
    await this.menu?.popup(new LogicalPosition(x, y));
  }

  private async create() {
    const ghost = await CheckMenuItem.new({
      id: "ghost",
      text: "虚化",
      checked: this.ghost.isGhosting(),
      action: () => {
        this.ghost.toggle();
        void ghost.setChecked(this.ghost.isGhosting());
      },
    });

    const small = await CheckMenuItem.new({
      id: "small-mode",
      text: "小灯模式",
      checked: this.small.isSmall(),
      action: () => {
        this.small.set(!this.small.isSmall());
        void small.setChecked(this.small.isSmall());
      },
    });

    const menu = await Menu.new({
      items: [
        ghost,
        small,
        await this.skinSubmenu(),
        await this.settingsSubmenu(),
        await PredefinedMenuItem.new({ item: "Separator" }),
        {
          id: "quit",
          text: "退出",
          action: () => void exit(0),
        },
      ],
    });
    this.menu = menu;

    // state 可能被桥或别的入口改，撤销可用性跟着变
    this.control.subscribe(() => void this.refreshUndo());

    const icon = await this.trayIcon();

    // 托盘活在进程里，刷新后还在：换掉菜单和图标就行，别再新建一个
    const existing = await TrayIcon.getById(TRAY_ID);
    if (existing) {
      await existing.setMenu(menu);
      if (icon) await existing.setIcon(icon);
      return;
    }

    await TrayIcon.new({
      id: TRAY_ID,
      tooltip: "红绿灯",
      icon: icon ?? (await defaultWindowIcon()) ?? undefined,
      menu,
      showMenuOnLeftClick: false,
    });
  }

  /** 自定义托盘图标；读不到就退回默认图标 */
  private async trayIcon() {
    try {
      const response = await fetch("/tray.png");
      if (!response.ok) return null;
      return await Image.fromBytes(await response.arrayBuffer());
    } catch {
      return null;
    }
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

  /** 设置二级菜单：透明度、音效、重置、撤销 */
  private async settingsSubmenu() {
    const transparency = await this.transparencySubmenu();

    const sound = await CheckMenuItem.new({
      id: "sound",
      text: "音效",
      checked: this.sound.isEnabled(),
      action: () => {
        const enabled = !this.sound.isEnabled();
        this.sound.setEnabled(enabled);
        void sound.setChecked(enabled);
      },
    });

    const reset = await MenuItem.new({
      id: "reset",
      text: "重置",
      action: () => this.control.reset(),
    });

    this.undoItem = await MenuItem.new({
      id: "undo",
      text: "撤销",
      enabled: this.control.canUndo(),
      action: () => this.control.undo(),
    });

    return Submenu.new({
      text: "设置",
      items: [transparency, sound, reset, this.undoItem],
    });
  }

  /** 透明度三级菜单：每档一个勾选项 */
  private async transparencySubmenu() {
    const items = await Promise.all(
      TRANSPARENCIES.map((value) => this.transparencyItem(value)),
    );
    items.forEach((item, index) =>
      this.transparencyItems.set(TRANSPARENCIES[index], item),
    );
    return Submenu.new({ text: "透明度", items });
  }

  private async transparencyItem(value: Transparency) {
    return CheckMenuItem.new({
      id: `transparency-${value}`,
      text: String(value),
      checked: this.ghost.getTransparency() === value,
      action: () => {
        this.ghost.setTransparency(value);
        this.transparencyItems.forEach(
          (item, key) => void item.setChecked(key === value),
        );
      },
    });
  }

  private async refreshUndo() {
    await this.undoItem?.setEnabled(this.control.canUndo());
  }
}
