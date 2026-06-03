import { writable } from "svelte/store";

export type Route =
  | { name: "planner" }
  | { name: "meals" }
  | { name: "meal"; id: string };

function parsePath(pathname: string): Route {
  const path = pathname.replace(/\/$/, "") || "/";

  if (path === "/" || path === "/planner") {
    return { name: "planner" };
  }
  if (path === "/meals") {
    return { name: "meals" };
  }
  const mealMatch = path.match(/^\/meal\/([^/]+)$/);
  if (mealMatch) {
    return { name: "meal", id: decodeURIComponent(mealMatch[1]) };
  }
  return { name: "planner" };
}

export const route = writable<Route>(parsePath(window.location.pathname));

export function navigate(to: string): void {
  window.history.pushState({}, "", to);
  route.set(parsePath(to));
}

export function initRouter(): void {
  window.addEventListener("popstate", () => {
    route.set(parsePath(window.location.pathname));
  });
}

export function pathFor(r: Route): string {
  switch (r.name) {
    case "planner":
      return "/planner";
    case "meals":
      return "/meals";
    case "meal":
      return `/meal/${encodeURIComponent(r.id)}`;
  }
}
