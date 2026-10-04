import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommandStatus, DeviceEventType, DeviceStatus } from "@/lib/schema";

/** Serviços de dispositivo. Rodam no app (Android/web) e no Core (servidor), sempre com cliente do usuário (RLS). */

export interface Device {
  id: string;
  device_name: string | null;
  manufacturer: string | null;
  model: string | null;
  android_version: string | null;
  app_version: string | null;
  status: DeviceStatus | string;
  last_seen_at: string | null;
  core_connected: boolean | null;
}

export interface Capability {
  capability: string;
  available: boolean;
  permission_granted: boolean | null;
  metadata: Record<string, unknown> | null;
}

/** Considera online só quem enviou sinal recentemente: status "online" antigo não é confiável. */
export const HEARTBEAT_MAX_AGE_MS = 90_000;

export function isFresh(lastSeenAt: string | null, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  return Number.isFinite(t) && now - t <= HEARTBEAT_MAX_AGE_MS;
}

const DEVICE_COLUMNS = "id, device_name, manufacturer, model, android_version, app_version, status, last_seen_at, core_connected";

export async function listDevices(supabase: SupabaseClient, userId: string): Promise<Device[]> {
  const { data, error } = await supabase.from("devices").select(DEVICE_COLUMNS).eq("user_id", userId).order("last_seen_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Device[];
}

export async function listCapabilities(supabase: SupabaseClient, userId: string, deviceId: string): Promise<Capability[]> {
  const { data, error } = await supabase.from("device_capabilities").select("capability, available, permission_granted, metadata").eq("user_id", userId).eq("device_id", deviceId);
  if (error) throw error;
  return (data ?? []) as Capability[];
}

/** Aparelho que o Core usa: o mais recente com status online e sinal de vida recente. */
export async function findOnlineDevice(supabase: SupabaseClient, userId: string): Promise<Device | null> {
  const devices = await listDevices(supabase, userId);
  return devices.find((d) => d.status === "online" && isFresh(d.last_seen_at)) ?? null;
}

export function capabilityReady(caps: Capability[], key: string): { ok: boolean; reason?: string } {
  const c = caps.find((x) => x.capability === key);
  if (!c) return { ok: false, reason: "O aparelho ainda não informou essa capacidade." };
  if (!c.available) {
    const why = c.metadata && typeof c.metadata.reason === "string" ? ` (${c.metadata.reason})` : "";
    return { ok: false, reason: `O aparelho não oferece essa capacidade${why}.` };
  }
  if (c.permission_granted !== true) return { ok: false, reason: "A permissão correspondente não foi concedida no Android." };
  return { ok: true };
}

export async function logDeviceEvent(
  supabase: SupabaseClient,
  e: { userId: string; deviceId: string | null; type: DeviceEventType; metadata?: Record<string, unknown> },
): Promise<void> {
  // Nunca registre dados sensíveis aqui (texto de mensagens, coordenadas, tokens).
  const { error } = await supabase.from("device_events").insert({ user_id: e.userId, device_id: e.deviceId, event_type: e.type, metadata: e.metadata ?? {} });
  if (error) console.error("[JARVIS] device_events", error.message);
}

export interface CommandOutcome {
  status: CommandStatus | "timeout";
  success: boolean;
  result: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  executionTimeMs: number | null;
  commandId: string;
}

const TERMINAL: string[] = ["completed", "failed", "cancelled", "expired"];

/**
 * Cria o comando e espera o resultado REAL gravado pelo aparelho em device_command_results.
 * Sem resultado dentro do prazo, o comando é marcado como expirado e o chamador recebe falha.
 */
export async function runDeviceCommand(
  supabase: SupabaseClient,
  p: { userId: string; deviceId: string; type: string; payload: Record<string, unknown>; timeoutMs?: number; pollMs?: number },
): Promise<CommandOutcome> {
  const timeoutMs = p.timeoutMs ?? 20_000;
  const pollMs = p.pollMs ?? 700;
  const { data: cmd, error } = await supabase
    .from("device_commands")
    .insert({
      user_id: p.userId,
      device_id: p.deviceId,
      command_type: p.type,
      payload: p.payload,
      status: "pending",
      requires_confirmation: false, // a confirmação já ocorreu no Core antes de chegar aqui
      expires_at: new Date(Date.now() + timeoutMs).toISOString(),
    })
    .select("id")
    .single();
  if (error || !cmd) throw error ?? new Error("O comando não foi gravado.");
  const commandId = String(cmd.id);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const { data: res } = await supabase
      .from("device_command_results")
      .select("success, result, error_code, error_message, execution_time_ms")
      .eq("command_id", commandId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res) {
      return {
        status: res.success ? "completed" : "failed",
        success: Boolean(res.success),
        result: res.result,
        errorCode: (res.error_code as string | null) ?? null,
        errorMessage: (res.error_message as string | null) ?? null,
        executionTimeMs: (res.execution_time_ms as number | null) ?? null,
        commandId,
      };
    }
    const { data: st } = await supabase.from("device_commands").select("status").eq("id", commandId).maybeSingle();
    if (st && typeof st.status === "string" && TERMINAL.includes(st.status)) {
      // Estado final sem linha de resultado (ex.: cancelado/expirado pelo aparelho)
      return { status: st.status as CommandStatus, success: false, result: null, errorCode: st.status, errorMessage: `O comando terminou como "${st.status}".`, executionTimeMs: null, commandId };
    }
  }
  await supabase.from("device_commands").update({ status: "expired" }).eq("id", commandId).in("status", ["pending", "sent"]);
  return { status: "timeout", success: false, result: null, errorCode: "timeout", errorMessage: "O aparelho não respondeu a tempo.", executionTimeMs: null, commandId };
}
