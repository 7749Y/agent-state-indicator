import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyStoredSkin } from "./skin";
import "./base.css";
import "./skinCartoon.css";
import "./skinFlat.css";

applyStoredSkin();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
