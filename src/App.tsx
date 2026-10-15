import { useMemo, useSyncExternalStore } from "react";
import { LightControl } from "./lightControl";
import { WindowDrag } from "./windowDrag";
import { WindowResize } from "./windowResize";
import "./App.css";

const LIGHTS = ["red", "yellow", "green"] as const;

function App() {
  const control = useMemo(() => new LightControl(0), []);
  const drag = useMemo(() => new WindowDrag(), []);
  const resize = useMemo(() => new WindowResize(), []);
  const active = useSyncExternalStore(control.subscribe, control.getActiveIndex);

  return (
    <main className="container" onMouseDown={drag.handleMouseDown}>
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
