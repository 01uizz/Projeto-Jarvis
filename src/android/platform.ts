import { Capacitor } from "@capacitor/core";

/** True somente dentro do aplicativo Android (Capacitor). No navegador/PWA o aparelho NÃO é registrado como Android. */
export function isNativeAndroid(): boolean {
  try {
    return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}
