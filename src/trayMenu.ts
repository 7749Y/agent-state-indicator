import { defaultWindowIcon, exit } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";

/** 托盘菜单：托盘图标右键弹出菜单。 */
export class TrayMenu {
  private mounting: Promise<void> | null = null;

  /** 挂载托盘与菜单，重复调用只会建一次。 */
  mount() {
    this.mounting ??= this.create();
    return this.mounting;
  }

  private async create() {
    const menu = await Menu.new({
      items: [
        {
          id: "quit",
          text: "退出",
          action: () => void exit(0),
        },
      ],
    });

    await TrayIcon.new({
      id: "traffic-light",
      tooltip: "红绿灯",
      icon: (await defaultWindowIcon()) ?? undefined,
      menu,
      showMenuOnLeftClick: false,
    });
  }
}
