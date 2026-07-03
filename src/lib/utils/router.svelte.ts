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
    return { name: "meal", id: decodeURIComponent(mealMatch[1]!) };
  }
  return { name: "planner" };
}

class RouterStore {
  current = $state<Route>(parseLogicalPath(window.location.pathname));
}

export const router = new RouterStore();

let navigatedWithinApp = false;

export function navigate(logicalPath: string): void {
  const segment = logicalPath.replace(/^\//, "");
  const href = appPath(segment);
  window.history.pushState({}, "", href);
  router.current = parseLogicalPath(href);
  navigatedWithinApp = true;
}

// True once the app has pushed at least one route since load, meaning
// there's in-app history to return to via window.history.back().
export function hasNavigatedInApp(): boolean {
  return navigatedWithinApp;
}

export function initRouter(): void {
  window.addEventListener("popstate", () => {
    router.current = parseLogicalPath(window.location.pathname);
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
