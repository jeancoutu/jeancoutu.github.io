import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { initRouter, route, isAppRoot, pathFor } from "./lib/utils/router";
import {
  clearPlannerShareParam,
  readPlannerShareParam,
} from "./lib/utils/planShare";
import { weeklyPlan } from "./lib/stores/weeklyPlan";

initRouter();

if (isAppRoot(window.location.pathname)) {
  const url = new URL(pathFor({ name: "planner" }), window.location.href);
  url.search = window.location.search;
  window.history.replaceState({}, "", url.href);
  route.set({ name: "planner" });
}

const sharedPlan = readPlannerShareParam();
if (sharedPlan) {
  weeklyPlan.importPlan(sharedPlan);
  clearPlannerShareParam();
}

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
