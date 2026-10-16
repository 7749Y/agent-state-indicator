import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LightControl, LightState } from "./lightControl";

/**
 * 本地 HTTP 桥的前端半边：
 * 把参数推给 Rust 镜像，桥写进来时再回写控制类。
 */
export function connectBridge(control: LightControl) {
  const push = () => {
    void invoke("sync_control", {
      state: control.getState(),
      text: control.getText(),
    });
  };

  const unsubscribe = control.subscribe(push);
  push();

  const listening = listen<{ state: LightState; text: string }>(
    "bridge:ctl",
    (event) => control.set(event.payload.state, event.payload.text),
  );

  return () => {
    unsubscribe();
    void listening.then((unlisten) => unlisten());
  };
}
