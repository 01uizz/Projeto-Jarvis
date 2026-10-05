import type { SupabaseClient } from "@supabase/supabase-js";
import { isNativeAndroid } from "./platform";

/** id numérico estável a partir do UUID do lembrete (o Android exige inteiro). */
function notificationId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(h, 31) + uuid.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/**
 * Agenda notificações LOCAIS para os lembretes pendentes das próximas 48 h. Funciona com o app fechado
 * (o Android entrega o alarme local). Sem permissão de notificações, não agenda nada e não finge.
 * Não é push remoto: lembretes criados depois só são agendados na próxima abertura do app.
 */
export async function scheduleReminderNotifications(supabase: SupabaseClient, userId: string): Promise<number> {
  if (!isNativeAndroid()) return 0;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return 0;
  const now = new Date();
  const until = new Date(now.getTime() + 48 * 3_600_000);
  const { data, error } = await supabase
    .from("reminders")
    .select("id, message, remind_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gt("remind_at", now.toISOString())
    .lte("remind_at", until.toISOString())
    .order("remind_at", { ascending: true })
    .limit(60);
  if (error || !data?.length) return 0;
  await LocalNotifications.schedule({
    notifications: data.map((r) => ({ id: notificationId(String(r.id)), title: "Lembrete", body: String(r.message), schedule: { at: new Date(String(r.remind_at)), allowWhileIdle: true } })),
  });
  return data.length;
}
