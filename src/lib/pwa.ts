import { registerSW } from "virtual:pwa-register";

export const updateServiceWorker = registerSW({ immediate: true });

// autoUpdate activates a new service worker in the background, but the
// already-open tab keeps running the old JS until the page reloads. Without
// this, a deploy only takes effect on the *second* open of the app.
let hasReloadedForUpdate = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (hasReloadedForUpdate) return;
  hasReloadedForUpdate = true;
  window.location.reload();
});

// check for updates whenever the app becomes visible again
// the down side of this is that the app can refresh while we are using it
// for now manually update the version with the parameters button
// document.addEventListener("visibilitychange", async () => {
//   if (document.visibilityState !== "visible") return;
//   const registration = await navigator.serviceWorker?.getRegistration();
//   await registration?.update();
// });

export async function checkForAppUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update();
  window.location.reload();
}
