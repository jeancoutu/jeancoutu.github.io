import { register, init } from "svelte-i18n";

register("en", () => import("./en.json"));
register("fr", () => import("./fr.json"));

export async function setupI18n(): Promise<void> {
  document.documentElement.lang = "fr";

  await init({
    fallbackLocale: "en",
    initialLocale: "fr",
  });
}
