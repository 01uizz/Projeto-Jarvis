import type { ToolContext, ToolDefinition, ToolResult } from "@/features/agent/types";
import { capabilityReady, findOnlineDevice, listCapabilities, runDeviceCommand } from "@/services/devices";

/** Aplicativos conhecidos (nome falado → pacote Android). Qualquer outro precisa do pacote exato. */
export const KNOWN_APPS: Record<string, string> = {
  whatsapp: "com.whatsapp",
  youtube: "com.google.android.youtube",
  chrome: "com.android.chrome",
  gmail: "com.google.android.gm",
  maps: "com.google.android.apps.maps",
  mapas: "com.google.android.apps.maps",
  spotify: "com.spotify.music",
  instagram: "com.instagram.android",
  telegram: "org.telegram.messenger",
  camera: "com.android.camera",
};

async function dispatch(ctx: ToolContext, capability: string, type: string, payload: Record<string, unknown>, timeoutMs: number): Promise<{ result?: ToolResult; data?: unknown }> {
  const device = await findOnlineDevice(ctx.supabase, ctx.userId);
  if (!device) {
    return {
      result: {
        ok: false,
        status: "unavailable",
        message: "Nenhum aparelho Android online no momento. Abra o app JARVIS no celular, conectado à internet, e tente de novo. Nada foi executado.",
      },
    };
  }
  const caps = await listCapabilities(ctx.supabase, ctx.userId, device.id);
  const ready = capabilityReady(caps, capability);
  if (!ready.ok) return { result: { ok: false, status: "unavailable", message: `${ready.reason} Nada foi executado.` } };

  const out = await runDeviceCommand(ctx.supabase, { userId: ctx.userId, deviceId: device.id, type, payload, timeoutMs });
  if (!out.success) {
    const msg = out.status === "timeout" ? "O aparelho não respondeu a tempo, então não sei se foi executado. Verifique se o app está aberto." : `O aparelho informou falha: ${out.errorMessage ?? out.errorCode ?? "motivo não informado"}.`;
    return { result: { ok: false, status: "error", message: msg } };
  }
  return { data: out.result };
}

export const deviceOpenApp: ToolDefinition = {
  name: "device_open_app",
  description: "Abre um aplicativo instalado no Android do usuário.",
  parameters: { app: "nome conhecido (whatsapp, youtube…) ou pacote Android" },
  permission: "device_control",
  risk: "medium",
  requiresConfirmation: true,
  implemented: true,
  describe: (p) => `Abrir o aplicativo ${String(p.app ?? "")} no seu Android`,
  async execute(p, ctx) {
    const raw = String(p.app ?? "").trim();
    const pkg = KNOWN_APPS[raw.toLowerCase()] ?? (/^[a-z][\w]*(\.[\w]+)+$/i.test(raw) ? raw : null);
    if (!pkg) return { ok: false, status: "error", message: `Não conheço o aplicativo "${raw}". Diga o nome do pacote Android (ex.: com.whatsapp).` };
    const r = await dispatch(ctx, "app_launch", "open_app", { package: pkg }, 20_000);
    if (r.result) return r.result;
    return { ok: true, status: "success", message: `Abri ${raw} no seu aparelho.`, data: r.data };
  },
};

export const deviceGetLocation: ToolDefinition = {
  name: "device_get_location",
  description: "Lê a localização atual do aparelho Android (com permissão).",
  parameters: {},
  permission: "device_control",
  risk: "medium",
  requiresConfirmation: true,
  implemented: true,
  describe: () => "Ler a localização atual do seu Android",
  async execute(_p, ctx) {
    const r = await dispatch(ctx, "location", "get_location", {}, 30_000);
    if (r.result) return r.result;
    const d = (r.data ?? {}) as { latitude?: number; longitude?: number; accuracy?: number };
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return { ok: false, status: "error", message: "O aparelho respondeu sem coordenadas válidas." };
    const acc = typeof d.accuracy === "number" ? ` (precisão ~${Math.round(d.accuracy)} m)` : "";
    return { ok: true, status: "success", auditMessage: "Localização do aparelho lida.", message: `Seu aparelho está em ${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}${acc}.`, data: d };
  },
};

export const deviceNotify: ToolDefinition = {
  name: "device_notify",
  description: "Mostra uma notificação local no aparelho Android.",
  parameters: { title: "string", body: "string" },
  permission: "device_control",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: (p) => `Notificar no Android: ${String(p.body ?? p.title ?? "")}`,
  async execute(p, ctx) {
    const body = String(p.body ?? "").trim();
    if (!body) return { ok: false, status: "error", message: "Qual texto devo mostrar na notificação?" };
    const r = await dispatch(ctx, "notifications", "show_notification", { title: String(p.title ?? "JARVIS"), body }, 20_000);
    if (r.result) return r.result;
    return { ok: true, status: "success", message: "A notificação foi exibida no seu aparelho.", data: r.data };
  },
};

export const deviceStatus: ToolDefinition = {
  name: "device_status",
  description: "Informa se há aparelho Android online e o que ele consegue fazer.",
  parameters: {},
  permission: "device_control",
  risk: "low",
  requiresConfirmation: false,
  implemented: true,
  describe: () => "Ver o estado do seu aparelho",
  async execute(_p, ctx) {
    const device = await findOnlineDevice(ctx.supabase, ctx.userId);
    if (!device) return { ok: true, status: "success", message: "Nenhum aparelho Android está online agora. Abra o JARVIS no celular, conectado à internet." };
    const caps = await listCapabilities(ctx.supabase, ctx.userId, device.id);
    const ok = caps.filter((c) => capabilityReady([c], c.capability).ok).map((c) => c.capability);
    const name = device.device_name ?? `${device.manufacturer ?? ""} ${device.model ?? ""}`.trim() ?? "aparelho";
    return { ok: true, status: "success", message: `${name || "Aparelho"} está online. Capacidades prontas: ${ok.length ? ok.join(", ") : "nenhuma"}.`, data: { device, caps } };
  },
};
