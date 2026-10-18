import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { connectBridge } from "./bridgeSync";
import { exposeControl } from "./controlApi";
import { GhostMode } from "./ghostMode";
import { LedScreen } from "./LedScreen";
import { LightControl, type LightState } from "./lightControl";
import { Skin } from "./skin";
import { Sound } from "./sound";
import { TrayMenu } from "./trayMenu";
import { WindowDrag } from "./windowDrag";
import { WindowResize } from "./windowResize";

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
  const control = useMemo(() => new LightControl(STATE, LED_TEXT), []);
  const drag = useMemo(() => new WindowDrag(), []);
  const resize = useMemo(() => new WindowResize(), []);
  const ghost = useMemo(() => new GhostMode(), []);
  const skin = useMemo(() => new Skin(), []);
  const sound = useMemo(() => new Sound(control), [control]);
  const tray = useMemo(
    () => new TrayMenu(ghost, skin, control, sound),
    [ghost, skin, control, sound],
  );
  const ghosting = useSyncExternalStore(ghost.subscribe, ghost.isGhosting);
  const transparency = useSyncExternalStore(
    ghost.subscribe,
    ghost.getTransparency,
  );
  const active = useSyncExternalStore(control.subscribe, control.getState) + 1;
  const label = useSyncExternalStore(control.subscribe, control.getDisplay);

  const ledOptions = useMemo(
    () => ({ ...LED_OPTIONS, text: label }),
    [label],
  );

  useEffect(() => {
    void tray.mount();
  }, [tray]);

  // 右键弹托盘同款菜单，顶掉网页自带的调试菜单
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void tray.popup(event.clientX, event.clientY);
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, [tray]);

  useEffect(() => exposeControl(control), [control]);

  useEffect(() => sound.start(), [sound]);

  useEffect(() => connectBridge(control), [control]);

  useEffect(() => {
    void resize.restore();
  }, [resize]);

  return (
    <main
      className={ghosting ? "container ghosting" : "container"}
      style={
        { "--ghost-opacity": (100 - transparency) / 100 } as CSSProperties
      }
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
