import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { isTauriRuntime } from "./tauri";

export async function notifyFocusSessionComplete(): Promise<void> {
  if (isTauriRuntime()) {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === "granted";
    }
    if (permissionGranted) {
      sendNotification({
        title: "LearningAppOffline",
        body: "Focus session complete",
      });
    }
    return;
  }

  if (typeof Notification === "undefined") {
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission === "granted") {
    new Notification("LearningAppOffline", { body: "Focus session complete" });
  }
}
