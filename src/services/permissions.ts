import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_AUTONOMY } from "@/config/theme";
import type { AutonomyLevel } from "@/types";

/** Permissões que começam liberadas. As de alto risco começam bloqueadas até o usuário ativar. */
export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  memory: true,
  tasks: true,
  reminders: true,
  calendar: true,
  web_search: true,
  email: false,
  messaging: false,
  payments: false,
  purchases: false,
};

export const PERMISSION_LABELS: Record<string, string> = {
  memory: "Memória",
  tasks: "Tarefas",
  reminders: "Lembretes",
  calendar: "Calendário",
  web_search: "Pesquisa na web",
  email: "E-mail",
  messaging: "Mensagens (WhatsApp etc.)",
  payments: "Pagamentos",
  purchases: "Compras",
};

export async function getPermissions(supabase: SupabaseClient, userId: string): Promise<Record<string, boolean>> {
  const result = { ...DEFAULT_PERMISSIONS };
  const { data, error } = await supabase.from("user_permissions").select("permission, granted").eq("user_id", userId);
  if (error) {
    console.error("[JARVIS] user_permissions", error);
    return result;
  }
  for (const row of data ?? []) {
    if (typeof row.permission === "string") result[row.permission] = Boolean(row.granted);
  }
  return result;
}

export async function setPermission(supabase: SupabaseClient, userId: string, permission: string, granted: boolean): Promise<void> {
  const { error } = await supabase
    .from("user_permissions")
    .upsert({ user_id: userId, permission, granted }, { onConflict: "user_id,permission" });
  if (error) throw error;
}

export async function hasPermission(supabase: SupabaseClient, userId: string, permission: string): Promise<boolean> {
  const all = await getPermissions(supabase, userId);
  return all[permission] ?? false;
}

export async function getAutonomy(supabase: SupabaseClient, userId: string): Promise<AutonomyLevel> {
  const { data, error } = await supabase.from("user_settings").select("autonomy_level").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("[JARVIS] user_settings", error);
    return DEFAULT_AUTONOMY;
  }
  const v = Number(data?.autonomy_level);
  return v === 0 || v === 1 || v === 2 || v === 3 ? (v as AutonomyLevel) : DEFAULT_AUTONOMY;
}

export async function setAutonomy(supabase: SupabaseClient, userId: string, level: AutonomyLevel): Promise<void> {
  const { error } = await supabase.from("user_settings").upsert({ user_id: userId, autonomy_level: level }, { onConflict: "user_id" });
  if (error) throw error;
}
