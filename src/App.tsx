import { useEffect, useMemo, useSyncExternalStore } from "react";
import { GhostMode } from "./ghostMode";
import { LedScreen } from "./LedScreen";
import { LightControl, type LightState } from "./lightControl";
import { TrayMenu } from "./trayMenu";
import { WindowDrag } from "./windowDrag";
import { WindowResize } from "./windowResize";
import "./App.css";

const LIGHTS = ["red", "yellow", "green"] as const;

/** 可调参数：灯的状态，-1 红灯、0 黄灯、1 绿灯 */
const STATE: LightState = 0;

/** LED 屏文本，前面自动拼上 state */
const LED_TEXT = "测试中";

/** LED 屏参数：滚动速度、文字大小 */
const LED_OPTIONS = {
  speed: 40,
  fontSize: 40,
};

function App() {
  const control = useMemo(() => new LightControl(STATE), []);
  const drag = useMemo(() => new WindowDrag(), []);
  const resize = useMemo(() => new WindowResize(), []);
  const ghost = useMemo(() => new GhostMode(), []);
  const tray = useMemo(() => new TrayMenu(ghost), [ghost]);
  const ghosting = useSyncExternalStore(ghost.subscribe, ghost.isGhosting);
  const state = control.getState();
  const active = state + 1;

  const ledOptions = useMemo(
    () => ({ ...LED_OPTIONS, text: `[${state}] ${LED_TEXT}` }),
    [state],
  );

  useEffect(() => {
    void tray.mount();
  }, [tray]);

  return (
    <main
      className={ghosting ? "container ghosting" : "container"}
      onMouseDown={drag.handleMouseDown}
    >
      <div className="traffic-light">
        {LIGHTS.map((color, i) => (
          <div
            key={color}
            className={`lamp ${color} ${i === active ? "on" : "off"}`}
          >
            <span className="face" />
            <span className="mouth" />
          </div>
        ))}
        <LedScreen options={ledOptions} />
      </div>
      <div
        className="corner-handle"
        data-no-drag
        onMouseDown={resize.handleMouseDown}
      />
    </main>
  );
}

export default App;
