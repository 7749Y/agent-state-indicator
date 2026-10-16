import type { LightControl, LightState } from "./lightControl";

declare global {
  interface Window {
    /** 控制工具：ctl() 读，ctl(state, text) 写，写成功返回 0 */
    ctl?: (state?: LightState, text?: string) => string | number;
  }
}

/** 把控制工具挂到 window.ctl，返回摘除函数 */
export function exposeControl(control: LightControl) {
  window.ctl = (state, text) => {
    if (state === undefined) return control.getDisplay();

    control.set(state, text ?? control.getText());
    return 0;
  };

  return () => {
    delete window.ctl;
  };
}
