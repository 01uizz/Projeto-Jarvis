import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * JARVIS Core (servidor). Cada requisição vem com o token de sessão do usuário (Authorization: Bearer).
 * O Core cria um cliente Supabase COM ESSE TOKEN + chave pública: a RLS continua valendo e nenhuma
 * chave privada (service_role) é usada ou necessária.
 */
export interface CoreSession {
  supabase: SupabaseClient;
  userId: string;
}

export class CoreAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function authenticate(request: Request): Promise<CoreSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new CoreAuthError("O Core não está conectado ao Supabase (variáveis de ambiente ausentes).", 503);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new CoreAuthError("Sessão ausente. Entre novamente.", 401);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new CoreAuthError("Sessão inválida ou expirada. Entre novamente.", 401);
  return { supabase, userId: data.user.id };
}

export function jsonError(e: unknown): Response {
  if (e instanceof CoreAuthError) return Response.json({ error: e.message }, { status: e.status });
  console.error("[JARVIS Core]", e);
  return Response.json({ error: "O Core encontrou um erro inesperado. Tente novamente." }, { status: 500 });
}
