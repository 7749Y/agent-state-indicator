import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { connectBridge } from "./bridgeSync";
import { exposeControl } from "./controlApi";
import { GhostMode } from "./ghostMode";
import { LedScreen } from "./LedScreen";
import { LightControl, type LightState } from "./lightControl";
import { Skin } from "./skin";
import { SmallMode } from "./smallMode";
import { Sound } from "./sound";
import { TrayMenu } from "./trayMenu";
import { UpdateCheck } from "./updateCheck";
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
  const small = useMemo(() => new SmallMode(), []);
  const resize = useMemo(() => new WindowResize(small), [small]);
  const ghost = useMemo(() => new GhostMode(), []);
  const skin = useMemo(() => new Skin(), []);
  const sound = useMemo(() => new Sound(control), [control]);
  const update = useMemo(() => new UpdateCheck(), []);
  const tray = useMemo(
    () => new TrayMenu(ghost, skin, control, sound, small, update),
    [ghost, skin, control, sound, small, update],
  );
  const ghosting = useSyncExternalStore(ghost.subscribe, ghost.isGhosting);
  const transparency = useSyncExternalStore(
    ghost.subscribe,
    ghost.getTransparency,
  );
  const revealed = useSyncExternalStore(ghost.subscribe, ghost.isRevealed);
  const smallOn = useSyncExternalStore(small.subscribe, small.isSmall);
  const active = useSyncExternalStore(control.subscribe, control.getState) + 1;
  const label = useSyncExternalStore(control.subscribe, control.getDisplay);

  const ledOptions = useMemo(
    () => ({ ...LED_OPTIONS, text: label }),
    [label],
  );

  useEffect(() => {
    void tray.mount();
  }, [tray]);

  // 每次启动查一次新版本，结果通过 update 订阅同步到菜单
  useEffect(() => {
    void update.check();
  }, [update]);

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

  // 虚化中切换 state：临时取消透明度，过几秒再恢复
  useEffect(() => {
    ghost.reveal();
  }, [ghost, active]);

  useEffect(() => connectBridge(control), [control]);

  useEffect(() => {
    void resize.restore();
  }, [resize]);

  // 切换小灯模式时改窗口比例；启动那次交给 restore
  const lastSmall = useRef(smallOn);
  useEffect(() => {
    if (lastSmall.current === smallOn) return;
    lastSmall.current = smallOn;
    void resize.applySmall(smallOn);
  }, [resize, smallOn]);

  return (
    <main
      className={`container${ghosting ? " ghosting" : ""}${smallOn ? " small" : ""}`}
      style={
        {
          "--ghost-opacity": revealed ? 1 : (100 - transparency) / 100,
        } as CSSProperties
      }
      onMouseDown={drag.handleMouseDown}
    >
      <div className="traffic-light">
        {smallOn ? (
          <div className={`lamp ${LIGHTS[active]} on`}>
            <span className="face" />
            <span className="mouth" />
          </div>
        ) : (
          <>
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
          </>
        )}
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
