import type { CapabilityKey } from "@/lib/schema";
import { isNativeAndroid } from "./platform";

export interface DetectedCapability {
  capability: CapabilityKey;
  available: boolean;
  permission_granted: boolean;
  metadata: Record<string, unknown>;
}

const NOT_IMPLEMENTED = "Ainda não implementado nesta versão do aplicativo.";

type PermState = "granted" | "denied" | "prompt" | "prompt-with-rationale" | string;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[JARVIS] capability", e);
    return fallback;
  }
}

/**
 * Detecta o que o aparelho REALMENTE consegue fazer agora. Nada é marcado como disponível sem verificação:
 * o que não existe ou não foi implementado fica available=false com o motivo em metadata.reason.
 */
export async function detectCapabilities(): Promise<DetectedCapability[]> {
  const native = isNativeAndroid();
  const out: DetectedCapability[] = [];
  const add = (capability: CapabilityKey, available: boolean, permission_granted: boolean, metadata: Record<string, unknown> = {}) =>
    out.push({ capability, available, permission_granted: available && permission_granted, metadata });

  add("android_device", native, native, native ? {} : { reason: "Não está rodando no aplicativo Android." });

  if (native) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const sttAvailable = await safe(async () => (await SpeechRecognition.available()).available, false);
    const mic: PermState = await safe(async () => (await SpeechRecognition.checkPermissions()).speechRecognition, "denied");
    add("microphone", sttAvailable, mic === "granted", sttAvailable ? { permission: mic } : { reason: "Reconhecimento de voz indisponível neste aparelho." });
    add("speech_recognition", sttAvailable, mic === "granted", sttAvailable ? { engine: "android" } : { reason: "Serviço de reconhecimento de voz não encontrado." });

    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const notif: PermState = await safe(async () => (await LocalNotifications.checkPermissions()).display, "denied");
    add("notifications", true, notif === "granted", { permission: notif, kind: "local" });

    const { Geolocation } = await import("@capacitor/geolocation");
    const loc: PermState = await safe(async () => (await Geolocation.checkPermissions()).location, "denied");
    add("location", true, loc === "granted", { permission: loc });

    add("app_launch", true, true, { note: "Não exige permissão do Android; apps precisam estar instalados." });
  } else {
    add("microphone", false, false, { reason: "Disponível apenas no aplicativo Android." });
    add("speech_recognition", false, false, { reason: "Disponível apenas no aplicativo Android." });
    add("notifications", false, false, { reason: "Disponível apenas no aplicativo Android." });
    add("location", false, false, { reason: "Disponível apenas no aplicativo Android." });
    add("app_launch", false, false, { reason: "Disponível apenas no aplicativo Android." });
  }

  const tts = typeof window !== "undefined" && "speechSynthesis" in window;
  add("text_to_speech", tts, true, tts ? { engine: "webview" } : { reason: "Síntese de voz indisponível." });

  add("files", false, false, { reason: NOT_IMPLEMENTED });
  add("contacts", false, false, { reason: NOT_IMPLEMENTED });
  add("calendar", false, false, { reason: NOT_IMPLEMENTED });
  add("background_tasks", false, false, { reason: "O Android restringe execução em segundo plano; o JARVIS só recebe comandos com o app aberto." });
  return out;
}

export type RequestableCapability = "microphone" | "notifications" | "location";

/** Pede a permissão real ao Android. Retorna true somente se o usuário concedeu. */
export async function requestCapabilityPermission(cap: RequestableCapability): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    if (cap === "microphone") {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      return (await SpeechRecognition.requestPermissions()).speechRecognition === "granted";
    }
    if (cap === "notifications") {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      return (await LocalNotifications.requestPermissions()).display === "granted";
    }
    const { Geolocation } = await import("@capacitor/geolocation");
    return (await Geolocation.requestPermissions({ permissions: ["location"] })).location === "granted";
  } catch (e) {
    console.error("[JARVIS] request permission", e);
    return false;
  }
}
