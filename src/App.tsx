import { useEffect, useState } from "react";
import "./App.css";

const LIGHTS = ["red", "yellow", "green"] as const;
const SWITCH_MS = 5000;

function App() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % LIGHTS.length);
    }, SWITCH_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="container">
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
      </div>
    </main>
  );
}

export default App;
