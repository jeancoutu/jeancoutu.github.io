import { registerSW } from "virtual:pwa-register";

export const updateServiceWorker = registerSW({ immediate: true });

export async function checkForAppUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update();
  window.location.reload();
}
