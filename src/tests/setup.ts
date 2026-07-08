import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { init, register, waitLocale } from "svelte-i18n";

// Mock localStorage
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageData).forEach((k) => delete localStorageData[k]); }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Supabase mock
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// Real i18n, so component tests query actual rendered copy (and catch broken
// translation keys) instead of asserting against raw key strings.
register("en", () => import("../lib/i18n/en.json"));
register("fr", () => import("../lib/i18n/fr.json"));
await init({ fallbackLocale: "en", initialLocale: "en" });
await waitLocale();
