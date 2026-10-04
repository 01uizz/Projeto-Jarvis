import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentResponse } from "@/features/agent/agent";

/** Cliente do JARVIS Core (rotas /api/core/* no servidor). Usa a sessão real do usuário; nada é simulado. */
export class CoreUnavailableError extends Error {}

async function call<T>(supabase: SupabaseClient, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CoreUnavailableError("Sessão ausente. Entre novamente.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 50_000);
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !body) throw new CoreUnavailableError(body?.error ?? `O Core respondeu com erro (${res.status}).`);
    return body;
  } catch (e) {
    if (e instanceof CoreUnavailableError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw new CoreUnavailableError("O Core demorou demais para responder.");
    throw new CoreUnavailableError("Não consegui falar com o Core. Verifique a conexão com a internet.");
  } finally {
    clearTimeout(timer);
  }
}

export const coreClient = {
  message: (supabase: SupabaseClient, message: string) => call<AgentResponse>(supabase, "/api/core/message", { method: "POST", body: JSON.stringify({ message }) }),
  resolve: (supabase: SupabaseClient, confirmationId: string, approve: boolean) =>
    call<AgentResponse>(supabase, "/api/core/resolve", { method: "POST", body: JSON.stringify({ confirmationId, approve }) }),
  ping: (supabase: SupabaseClient) => call<{ ok: boolean; time: string }>(supabase, "/api/core/ping", { method: "GET", timeoutMs: 10_000 }),
};
