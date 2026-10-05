import { isNativeAndroid } from "./platform";

/**
 * Identificador do aparelho GERADO pelo aplicativo (UUID). Não usa IMEI nem outros identificadores restritos.
 * Fica no armazenamento de preferências do app só para o app se reconhecer; os dados do aparelho vivem no Supabase.
 */
const KEY = "jarvis.device_identifier";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  throw new Error("Este aparelho não consegue gerar um identificador seguro.");
}

export async function getDeviceIdentifier(): Promise<string> {
  if (isNativeAndroid()) {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: KEY });
    if (value) return value;
    const id = newId();
    await Preferences.set({ key: KEY, value: id });
    return id;
  }
  const existing = window.localStorage.getItem(KEY);
  if (existing) return existing;
  const id = newId();
  window.localStorage.setItem(KEY, id);
  return id;
}
