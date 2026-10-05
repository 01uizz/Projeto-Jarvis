import { isNativeAndroid } from "./platform";

/** Erro de comando com código estável, gravado em device_command_results.error_code. */
export class CommandError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface CommandRow {
  id: string;
  command_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  requires_confirmation?: boolean | null;
  expires_at?: string | null;
}

type Handler = (payload: Record<string, unknown>) => Promise<unknown>;

function requireNative() {
  if (!isNativeAndroid()) throw new CommandError("not_android", "Este aparelho não está rodando o aplicativo Android.");
}

const handlers: Record<string, Handler> = {
  async open_app(payload) {
    requireNative();
    const pkg = typeof payload.package === "string" ? payload.package : "";
    if (!/^[a-z][\w]*(\.[\w]+)+$/i.test(pkg)) throw new CommandError("invalid_payload", "Pacote do aplicativo inválido.");
    const { AppLauncher } = await import("@capacitor/app-launcher");
    const can = await AppLauncher.canOpenUrl({ url: pkg }).catch(() => ({ value: false }));
    if (!can.value) throw new CommandError("app_not_found", `O aplicativo ${pkg} não está instalado ou não pode ser aberto.`);
    const res = await AppLauncher.openUrl({ url: pkg });
    if (!res.completed) throw new CommandError("open_failed", "O Android não abriu o aplicativo.");
    return { opened: pkg };
  },

  async get_location() {
    requireNative();
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted") throw new CommandError("permission_denied", "A permissão de localização não está concedida.");
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000 });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
    } catch (e) {
      throw new CommandError("location_unavailable", e instanceof Error ? e.message : "Não foi possível obter a localização.");
    }
  },

  async show_notification(payload) {
    requireNative();
    const body = typeof payload.body === "string" ? payload.body.slice(0, 500) : "";
    if (!body) throw new CommandError("invalid_payload", "Notificação sem texto.");
    const title = typeof payload.title === "string" && payload.title ? payload.title.slice(0, 80) : "JARVIS";
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") throw new CommandError("permission_denied", "A permissão de notificações não está concedida.");
    const id = Math.floor(Date.now() % 2_000_000_000);
    await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(Date.now() + 1000) } }] });
    return { notification_id: id };
  },
};

export function supportedCommandTypes(): string[] {
  return Object.keys(handlers);
}

export async function executeCommand(cmd: CommandRow): Promise<unknown> {
  const handler = handlers[cmd.command_type];
  if (!handler) throw new CommandError("unsupported_command", `Este aplicativo não sabe executar "${cmd.command_type}".`);
  return handler(cmd.payload ?? {});
}
