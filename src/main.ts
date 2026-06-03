import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { initRouter, route, isAppRoot, pathFor } from "./lib/utils/router";

initRouter();

if (isAppRoot(window.location.pathname)) {
  window.history.replaceState({}, "", pathFor({ name: "planner" }));
  route.set({ name: "planner" });
}

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
