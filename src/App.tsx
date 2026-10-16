import { useEffect, useMemo, useSyncExternalStore } from "react";
import { GhostMode } from "./ghostMode";
import { LightControl } from "./lightControl";
import { TrayMenu } from "./trayMenu";
import { WindowDrag } from "./windowDrag";
import { WindowResize } from "./windowResize";
import "./App.css";

const LIGHTS = ["red", "yellow", "green"] as const;

function App() {
  const control = useMemo(() => new LightControl(0), []);
  const drag = useMemo(() => new WindowDrag(), []);
  const resize = useMemo(() => new WindowResize(), []);
  const ghost = useMemo(() => new GhostMode(), []);
  const tray = useMemo(() => new TrayMenu(ghost), [ghost]);
  const active = useSyncExternalStore(control.subscribe, control.getActiveIndex);
  const ghosting = useSyncExternalStore(ghost.subscribe, ghost.isGhosting);

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
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={i === active}
            className={`lamp ${color} ${i === active ? "on" : "off"}`}
            onClick={() => control.touch(i)}
          >
            <span className="face" />
            <span className="mouth" />
          </button>
        ))}
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
