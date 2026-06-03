import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { initRouter, route } from "./lib/utils/router";

initRouter();

const current = window.location.pathname.replace(/\/$/, "") || "/";
if (current === "/") {
  window.history.replaceState({}, "", "/planner");
  route.set({ name: "planner" });
}

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
