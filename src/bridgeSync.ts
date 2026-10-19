import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LightControl, LightState } from "./lightControl";

/**
 * 本地 HTTP 桥的前端半边：
 * 先挂好监听，再把当前参数交给 Rust 并让它落盘 bridge.json，
 * 之后每次改动推给镜像；桥写进来时回写控制类。
 */
export function connectBridge(control: LightControl) {
  const push = () => {
    void invoke("sync_control", {
      state: control.getState(),
      text: control.getText(),
    });
  };

  let unsubscribe = () => {};
  let unlisten = () => {};
  let stopped = false;

  void listen<{ state: LightState; text: string }>("bridge:ctl", (event) =>
    control.set(event.payload.state, event.payload.text),
  ).then((stop) => {
    if (stopped) {
      stop();
      return;
    }
    unlisten = stop;

    void invoke("bridge_ready", {
      state: control.getState(),
      text: control.getText(),
    }).then(() => {
      if (!stopped) unsubscribe = control.subscribe(push);
    });
  });

  return () => {
    stopped = true;
    unsubscribe();
    unlisten();
  };
}
