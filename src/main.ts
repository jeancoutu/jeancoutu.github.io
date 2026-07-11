import { mount } from "svelte";
import { waitLocale } from "svelte-i18n";
import { registerSW } from "virtual:pwa-register";
import "./app.css";
import App from "./App.svelte";
import { setupI18n } from "./lib/i18n";
import { initRouter, router, isAppRoot, pathFor } from "./lib/utils/router.svelte";
import { initSyncEngine } from "./lib/sync/engine";
import { initRealtimeSync } from "./lib/sync/realtime";

registerSW({ immediate: true });

async function bootstrap() {
  await setupI18n();
  await waitLocale();

  initRouter();
  initSyncEngine();
  initRealtimeSync();

  if (isAppRoot(window.location.pathname)) {
    const url = new URL(pathFor({ name: "planner" }), window.location.href);
    url.search = window.location.search;
    window.history.replaceState({}, "", url.href);
    router.current = { name: "planner" };
  }

  mount(App, {
    target: document.getElementById("app")!,
  });
}

bootstrap();
