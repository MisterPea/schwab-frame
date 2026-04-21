import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.scss";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
