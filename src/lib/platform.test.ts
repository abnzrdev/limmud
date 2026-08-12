import { afterEach, expect, it, vi } from "vitest";
import { isAndroidRuntime } from "./platform";

afterEach(() => vi.unstubAllGlobals());

it("requires both the Tauri runtime and an Android user agent", () => {
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14)" });
  expect(isAndroidRuntime()).toBe(true);

  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" });
  expect(isAndroidRuntime()).toBe(false);

  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14)" });
  expect(isAndroidRuntime()).toBe(false);
});
