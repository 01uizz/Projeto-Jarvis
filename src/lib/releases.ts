import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifySupabaseError } from "@/services/diagnostics";

/**
 * app_releases já existe no Supabase. Os nomes de coluna abaixo vêm do prompt do projeto
 * (versão, version_code, notas, requisitos Android, link de download, is_required).
 * O normalizador aceita variações comuns para não quebrar se algum nome for ligeiramente diferente;
 * o que não for encontrado aparece como "não informado" — nunca é inventado.
 */
export interface Release {
  id: string | null;
  versionName: string | null;
  versionCode: number | null;
  notes: string | null;
  minAndroid: string | null;
  downloadUrl: string | null;
  isRequired: boolean;
  publishedAt: string | null;
}

type Row = Record<string, unknown>;

function pickString(row: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export function normalizeRelease(row: Row): Release {
  const code = row.version_code ?? row.versionCode;
  return {
    id: row.id != null ? String(row.id) : null,
    versionName: pickString(row, ["version_name", "version", "name"]),
    versionCode: typeof code === "number" ? code : code != null && !Number.isNaN(Number(code)) ? Number(code) : null,
    notes: pickString(row, ["release_notes", "notes", "changelog", "description"]),
    minAndroid: pickString(row, ["min_android_version", "min_android", "android_requirement", "requirements", "min_sdk"]),
    downloadUrl: pickString(row, ["download_url", "apk_url", "url", "file_url"]),
    isRequired: row.is_required === true,
    publishedAt: pickString(row, ["published_at", "released_at", "created_at"]),
  };
}

export async function fetchReleasesWith(client: SupabaseClient, limit = 10): Promise<{ releases: Release[]; error: string | null }> {
  const { data, error } = await client.from("app_releases").select("*").order("version_code", { ascending: false }).limit(limit);
  if (error) {
    const c = classifySupabaseError(error);
    return { releases: [], error: `${c.label}: ${c.help}` };
  }
  return { releases: ((data ?? []) as Row[]).map(normalizeRelease).filter((r) => r.versionCode !== null || r.versionName !== null), error: null };
}

/** Consulta anônima, no servidor (páginas públicas do site). */
export async function fetchReleasesPublic(limit = 10): Promise<{ releases: Release[]; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { releases: [], error: "O site ainda não está conectado ao Supabase (variáveis de ambiente ausentes)." };
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return await fetchReleasesWith(client, limit);
  } catch (e) {
    console.error("[JARVIS] app_releases", e);
    return { releases: [], error: "Não foi possível consultar as versões agora." };
  }
}
