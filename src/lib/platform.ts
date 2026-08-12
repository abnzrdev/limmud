export function isAndroidRuntime(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return typeof window.__TAURI_INTERNALS__ !== "undefined"
    && /Android/i.test(navigator.userAgent);
}
