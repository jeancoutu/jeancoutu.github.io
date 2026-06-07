import { mount } from "svelte";
import { waitLocale } from "svelte-i18n";
import "./app.css";
import App from "./App.svelte";
import { setupI18n } from "./lib/i18n";
import { initRouter, route, isAppRoot, pathFor } from "./lib/utils/router";
import {
  clearPlannerShareParam,
  readPlannerShareParam,
} from "./lib/utils/planShare";
import { pendingSharePlan } from "./lib/stores/pendingSharePlan";

async function bootstrap() {
  await setupI18n();
  await waitLocale();

  initRouter();

  if (isAppRoot(window.location.pathname)) {
    const url = new URL(pathFor({ name: "planner" }), window.location.href);
    url.search = window.location.search;
    window.history.replaceState({}, "", url.href);
    route.set({ name: "planner" });
  }

  const sharedPlan = readPlannerShareParam();
  if (sharedPlan) {
    pendingSharePlan.setPending(sharedPlan);
    clearPlannerShareParam();
  }

  mount(App, {
    target: document.getElementById("app")!,
  });
}

bootstrap();
