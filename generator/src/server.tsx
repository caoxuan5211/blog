import { renderToString } from "react-dom/server";
import { App } from "./App";
import type { RouteData } from "./types";
import "./styles.css";

export function render(route: RouteData) {
  return renderToString(<App route={route} />);
}
