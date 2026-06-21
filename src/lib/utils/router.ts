import { writable } from "svelte/store";
import {appPath, isAppRoot, stripBase} from "./paths";

export type Route =
  | { name: "planner" }
  | { name: "meals" }
  | { name: "meal"; id: string }
  | { name: "settings" };

function parseLogicalPath(pathname: string): Route {
  const path = stripBase(pathname).replace(/\/$/, "") || "/";

  if (path === "/" || path === "/planner") {
    return { name: "planner" };
  }
  if (path === "/meals") {
    return { name: "meals" };
  }
  if (path === "/settings") {
    return { name: "settings" };
  }
  const mealMatch = path.match(/^\/meal\/([^/]+)$/);
  if (mealMatch) {
    return { name: "meal", id: decodeURIComponent(mealMatch[1]) };
  }
  return { name: "planner" };
}

export const route = writable<Route>(parseLogicalPath(window.location.pathname));

export function navigate(logicalPath: string): void {
  const segment = logicalPath.replace(/^\//, "");
  const href = appPath(segment);
  window.history.pushState({}, "", href);
  route.set(parseLogicalPath(href));
}

export function initRouter(): void {
  window.addEventListener("popstate", () => {
    route.set(parseLogicalPath(window.location.pathname));
  });
}

export function pathFor(r: Route): string {
  switch (r.name) {
    case "planner":
      return appPath("/planner");
    case "meals":
      return appPath("/meals");
    case "meal":
      return appPath(`/meal/${encodeURIComponent(r.id)}`);
    case "settings":
      return appPath("/settings");
  }
}

export { isAppRoot };
