/** Converte erros técnicos em mensagens amigáveis e registra o detalhe no console. */
export function friendlyError(error: unknown, fallback = "Não foi possível concluir essa ação. Tente novamente."): string {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
  // Detalhe técnico fica apenas no log.
  console.error("[JARVIS]", error);

  const text = raw.toLowerCase();
  if (text.includes("supabase_env_missing")) return "O JARVIS ainda não está conectado ao banco de dados. Verifique as variáveis de ambiente.";
  if (text.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (text.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (text.includes("user already registered")) return "Já existe uma conta com esse e-mail.";
  if (text.includes("password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (text.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde um instante e tente de novo.";
  if (text.includes("failed to fetch") || text.includes("network")) return "Sem conexão no momento. Verifique sua internet.";
  if (text.includes("row-level security") || text.includes("permission denied")) return "Você não tem permissão para realizar essa ação.";
  return fallback;
}
