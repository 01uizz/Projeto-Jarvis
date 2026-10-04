import type { SupabaseClient } from "@supabase/supabase-js";

export interface FoundRow {
  id: string;
  label: string;
  [key: string]: unknown;
}

export type FindResult = { kind: "one"; row: FoundRow } | { kind: "none" } | { kind: "many"; rows: FoundRow[] };

function clean(text: string): string {
  return text.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Localiza um registro do usuário por id ou por trecho de texto (ex.: "estudar matemática").
 * Se houver mais de um candidato, devolve a lista para o agente pedir que o usuário seja específico.
 */
export async function findOwned(
  supabase: SupabaseClient,
  userId: string,
  table: "tasks" | "reminders" | "calendar_events",
  textColumn: "title" | "message",
  params: { id?: unknown; match?: unknown },
  extraFilter?: (q: any) => any,
): Promise<FindResult> {
  let q = supabase.from(table).select(`id, ${textColumn}`).eq("user_id", userId);
  if (extraFilter) q = extraFilter(q);
  if (typeof params.id === "string" && params.id) {
    q = q.eq("id", params.id);
  } else {
    const term = clean(String(params.match ?? ""));
    if (!term) return { kind: "none" };
    q = q.ilike(textColumn, `%${term}%`);
  }
  const { data, error } = await q.limit(6);
  if (error) throw error;
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({ ...r, id: String(r.id), label: String(r[textColumn] ?? "") }));
  if (rows.length === 0) return { kind: "none" };
  if (rows.length === 1) return { kind: "one", row: rows[0] };
  // Correspondência exata de título resolve a ambiguidade
  const term = clean(String(params.match ?? "")).toLowerCase();
  const exact = rows.filter((r) => r.label.toLowerCase() === term);
  if (exact.length === 1) return { kind: "one", row: exact[0] };
  return { kind: "many", rows };
}

export function ambiguityMessage(noun: string, rows: FoundRow[]): string {
  return `Encontrei mais de ${noun} com esse nome:\n${rows.map((r) => `• ${r.label}`).join("\n")}\nQual deles? Diga o nome completo.`;
}
