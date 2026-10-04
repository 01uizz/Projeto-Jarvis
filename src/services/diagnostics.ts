import { DEVICE_SCHEMA } from "@/lib/schema";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isLocalhostUrl } from "@/lib/site";

export type DiagStatus = "ok" | "fail" | "warn";

export interface DiagResult {
  id: string;
  group: string;
  name: string;
  status: DiagStatus;
  /** O que foi verificado e o resultado, em linguagem simples. */
  detail: string;
}

export type ErrorKind = "table" | "column" | "rls" | "auth" | "key" | "network" | "constraint" | "type" | "query";

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

/** Descobre a causa provável de um erro do Supabase/PostgREST. */
export function classifySupabaseError(raw: unknown): { kind: ErrorKind; label: string; help: string } {
  const err = (raw && typeof raw === "object" ? raw : { message: String(raw) }) as PgLikeError;
  const msg = (err.message ?? "").toLowerCase();
  const code = err.code ?? "";
  const original = err.message ?? "erro desconhecido";

  if (/failed to fetch|networkerror|load failed|network request failed/.test(msg)) {
    return { kind: "network", label: "Rede", help: "Não foi possível falar com o Supabase. Verifique a internet e se a URL do projeto está correta." };
  }
  if (/invalid api key|apikey/.test(msg) || err.status === 401) {
    return { kind: "key", label: "Chave inválida", help: "A chave publishable foi recusada. Confira NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel (sem espaços) e faça um novo deploy." };
  }
  if (code === "42P01" || code === "PGRST205" || /could not find the table|relation .* does not exist/.test(msg)) {
    return { kind: "table", label: "Tabela inexistente", help: `A tabela não existe neste projeto. Execute as migrações em migrations/ no SQL Editor. (${original})` };
  }
  if (code === "42703" || code === "PGRST204" || /column .* does not exist|could not find the .* column/.test(msg)) {
    return { kind: "column", label: "Coluna inexistente", help: `Falta uma coluna que o app usa. Execute migrations/002_auth_profile_agent.sql. (${original})` };
  }
  if (code === "42501" || /row-level security|permission denied/.test(msg)) {
    return { kind: "rls", label: "RLS / permissão", help: `O banco bloqueou a operação. Se o usuário está logado e o dado é dele, a política de RLS está faltando ou errada para esta tabela. (${original})` };
  }
  if (code === "PGRST301" || code === "PGRST302" || /jwt/.test(msg)) {
    return { kind: "auth", label: "Autenticação", help: `A sessão expirou ou é inválida. Saia e entre de novo. (${original})` };
  }
  if (code === "23502") {
    return { kind: "constraint", label: "Coluna obrigatória", help: `A tabela tem uma coluna NOT NULL que o app não preenche. Ajuste a tabela ou o código. (${original})` };
  }
  if (code === "23503") {
    return { kind: "constraint", label: "Relacionamento", help: `Chave estrangeira inválida (o registro referenciado não existe). (${original})` };
  }
  if (code === "23505") {
    return { kind: "constraint", label: "Valor duplicado", help: `Já existe um registro com esse valor único. (${original})` };
  }
  if (code === "23514") {
    return { kind: "constraint", label: "Regra da tabela (CHECK)", help: `Um valor não é aceito por uma regra CHECK da tabela (por exemplo, valores permitidos de status ou role). (${original})` };
  }
  if (code === "22P02" || code === "42804" || /invalid input syntax|is of type/.test(msg)) {
    return { kind: "type", label: "Tipo incorreto", help: `O tipo de uma coluna é diferente do esperado pelo app. (${original})` };
  }
  return { kind: "query", label: "Erro de consulta", help: original };
}

const COLUMNS: Record<string, string[]> = {
  profiles: ["id", "username", "display_name", "onboarding_completed"],
  user_settings: ["user_id", "autonomy_level"],
  theme_preferences: ["user_id", "accent_color", "theme_mode"],
  conversations: ["id", "user_id", "title", "updated_at"],
  messages: ["id", "user_id", "conversation_id", "role", "content", "metadata", "created_at"],
  memories: ["id", "user_id", "content", "category", "source", "confidence", "is_active"],
  tasks: ["id", "user_id", "title", "description", "due_at", "priority", "status", "category", "source", "completed_at"],
  reminders: ["id", "user_id", "message", "remind_at", "status", "source"],
  calendar_events: ["id", "user_id", "title", "starts_at", "ends_at", "description", "location", "source"],
  notifications: ["id", "user_id", "title", "body", "kind", "read_at", "created_at"],
  user_permissions: ["id", "user_id", "permission", "granted"],
  integrations: ["id", "user_id", "provider", "status"],
  action_confirmations: ["id", "user_id", "tool", "params", "summary", "status", "resolved_at"],
  audit_logs: ["id", "user_id", "action", "tool", "status", "origin", "result", "error", "metadata", "created_at"],
};

type Emit = (r: DiagResult) => void;

function mk(group: string, id: string, name: string, status: DiagStatus, detail: string): DiagResult {
  return { id, group, name, status, detail };
}

function failFrom(group: string, id: string, name: string, err: unknown): DiagResult {
  const c = classifySupabaseError(err);
  return mk(group, id, name, "fail", `${c.label}: ${c.help}`);
}

/** Insere, lê, altera e apaga um registro de teste. Falha na etapa exata e tenta limpar o que criou. */
async function roundtrip(
  supabase: SupabaseClient,
  emit: Emit,
  table: string,
  label: string,
  row: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<void> {
  const group = "Gravação e RLS";
  const id = `rt-${table}`;
  const ins = await supabase.from(table).insert(row).select("id").single();
  if (ins.error || !ins.data?.id) {
    emit(ins.error ? failFrom(group, id, `${label}: criar`, ins.error) : mk(group, id, `${label}: criar`, "fail", "O banco aceitou a gravação mas não devolveu o registro (verifique a política de SELECT)."));
    return;
  }
  const rowId = ins.data.id as string;
  const sel = await supabase.from(table).select("id").eq("id", rowId);
  if (sel.error || !sel.data || sel.data.length !== 1) {
    emit(sel.error ? failFrom(group, id, `${label}: ler`, sel.error) : mk(group, id, `${label}: ler`, "fail", "O registro criado não pôde ser lido de volta."));
    await supabase.from(table).delete().eq("id", rowId);
    return;
  }
  const upd = await supabase.from(table).update(patch).eq("id", rowId).select("id");
  if (upd.error || !upd.data || upd.data.length !== 1) {
    emit(upd.error ? failFrom(group, id, `${label}: editar`, upd.error) : mk(group, id, `${label}: editar`, "fail", "A edição não alterou nenhuma linha (política de UPDATE ausente?)."));
    await supabase.from(table).delete().eq("id", rowId);
    return;
  }
  const del = await supabase.from(table).delete().eq("id", rowId).select("id");
  if (del.error || !del.data || del.data.length !== 1) {
    emit(del.error ? failFrom(group, id, `${label}: excluir`, del.error) : mk(group, id, `${label}: excluir`, "fail", "A exclusão não removeu nenhuma linha (política de DELETE ausente?). O registro de teste ficou no banco."));
    return;
  }
  emit(mk(group, id, label, "ok", "Criar, ler, editar e excluir funcionam."));
}

export async function runDiagnostics(supabase: SupabaseClient, user: User, emit: Emit): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const tag = "[diagnóstico]";

  // 1) Variáveis de ambiente e URL
  const gc = "Conexão";
  if (!url || !key) {
    emit(mk(gc, "env", "Variáveis de ambiente", "fail", "NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidas neste deploy."));
    return;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    emit(mk(gc, "env", "URL do Supabase", "warn", `A URL "${url}" não tem o formato https://SEU-PROJETO.supabase.co. Confirme se está correta.`));
  } else {
    emit(mk(gc, "env", "Variáveis de ambiente", "ok", "URL e chave publishable definidas."));
  }
  if (/service_role|sb_secret_/i.test(key)) {
    emit(mk(gc, "key-kind", "Tipo da chave", "fail", "ATENÇÃO: a chave configurada parece ser uma chave SECRETA. Nunca use isso no frontend. Troque pela publishable e gere uma nova chave secreta no Supabase."));
    return;
  }
  emit(mk(gc, "key-kind", "Tipo da chave", "ok", "Chave pública (publishable/anon), apropriada para o frontend."));

  // 2) Alcançabilidade da URL
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: key } });
    if (res.ok) emit(mk(gc, "reach", "URL do projeto acessível", "ok", "O serviço de autenticação respondeu."));
    else if (res.status === 401 || res.status === 403) emit(mk(gc, "reach", "URL do projeto acessível", "fail", "A URL responde, mas recusou a chave. Confira NEXT_PUBLIC_SUPABASE_ANON_KEY."));
    else emit(mk(gc, "reach", "URL do projeto acessível", "fail", `O servidor respondeu com status ${res.status}. O projeto pode estar pausado no painel do Supabase.`));
  } catch (e) {
    emit(failFrom(gc, "reach", "URL do projeto acessível", e));
    return;
  }

  // 3) Sessão e usuário
  const ga = "Autenticação";
  const session = await supabase.auth.getSession();
  if (session.error || !session.data.session) {
    emit(mk(ga, "session", "Sessão", "fail", "Nenhuma sessão ativa. Saia e entre de novo."));
    return;
  }
  emit(mk(ga, "session", "Sessão", "ok", "Sessão ativa neste aparelho."));
  const who = await supabase.auth.getUser();
  if (who.error || who.data.user?.id !== user.id) {
    emit(who.error ? failFrom(ga, "user", "Usuário validado no servidor", who.error) : mk(ga, "user", "Usuário validado no servidor", "fail", "O servidor devolveu outro usuário."));
    return;
  }
  emit(mk(ga, "user", "Usuário validado no servidor", "ok", `${who.data.user.email ?? "sem e-mail"} (confirmado: ${who.data.user.email_confirmed_at ? "sim" : "não"})`));

  if (isLocalhostUrl(window.location.origin)) {
    emit(mk(ga, "origin", "Endereço do app", "warn", "Você está em localhost. Links de e-mail só funcionam em produção se o cadastro for feito pelo endereço da Vercel."));
  }

  const profile = await supabase.from("profiles").select("id, username, display_name").eq("id", user.id).maybeSingle();
  if (profile.error) emit(failFrom(ga, "profile", "Perfil", profile.error));
  else if (!profile.data) emit(mk(ga, "profile", "Perfil", "warn", "O perfil ainda não existe (é criado automaticamente no primeiro carregamento). Atualize a página e rode de novo."));
  else emit(mk(ga, "profile", "Perfil", "ok", `username: ${(profile.data as { username?: string }).username ?? "não definido"}`));

  // 4) Tabelas e colunas
  const gt = "Tabelas e colunas";
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const res = await supabase.from(table).select(cols.join(",")).limit(1);
    if (res.error) emit(failFrom(gt, `tbl-${table}`, table, res.error));
    else emit(mk(gt, `tbl-${table}`, table, "ok", "Tabela e colunas esperadas existem e são legíveis."));
  }

  // 4b) Tabelas do Android/Core (já existem no Supabase; aqui só conferimos os nomes assumidos, sem alterar nada)
  const gd = "Android e Core";
  for (const [table, def] of Object.entries(DEVICE_SCHEMA)) {
    const cols = [...def.columns] as string[];
    const all = await supabase.from(table).select(cols.join(",")).limit(1);
    if (!all.error) {
      emit(mk(gd, `dev-${table}`, table, "ok", "Tabela e colunas esperadas existem e são legíveis."));
      continue;
    }
    const first = classifySupabaseError(all.error);
    if (first.kind === "table") {
      emit(mk(gd, `dev-${table}`, table, "fail", `TABELA AUSENTE: "${table}" não existe (ou não está exposta à API). Nada foi criado automaticamente.`));
      continue;
    }
    if (first.kind !== "column") {
      emit(failFrom(gd, `dev-${table}`, table, all.error));
      continue;
    }
    const missing: string[] = [];
    for (const c of cols) {
      const one = await supabase.from(table).select(c).limit(1);
      if (one.error && classifySupabaseError(one.error).kind === "column") missing.push(c);
    }
    emit(
      mk(
        gd,
        `dev-${table}`,
        table,
        "fail",
        `COLUNA(S) AUSENTE(S) em "${table}": ${missing.join(", ") || "(não identificada)"}. O app assume esses nomes (src/lib/schema.ts). Informe o nome real ou confirme a coluna; nada foi alterado no banco.`,
      ),
    );
  }
  try {
    const t0 = Date.now();
    const res = await fetch("/api/core/ping", { headers: { Authorization: `Bearer ${session.data.session.access_token}` } });
    if (res.ok) emit(mk(gd, "core-ping", "JARVIS Core (/api/core/ping)", "ok", `O Core validou a sessão (${Date.now() - t0} ms).`));
    else emit(mk(gd, "core-ping", "JARVIS Core (/api/core/ping)", "fail", `O Core respondeu ${res.status}. Confirme as variáveis do Supabase no deploy da Vercel.`));
  } catch (e) {
    emit(failFrom(gd, "core-ping", "JARVIS Core (/api/core/ping)", e));
  }

  // 5) Gravação real em cada módulo
  const future = new Date(Date.now() + 3600_000).toISOString();
  await roundtrip(supabase, emit, "tasks", "Tarefas", { user_id: user.id, title: `${tag} tarefa`, status: "pending", priority: "low", source: "manual" }, { title: `${tag} editada` });
  await roundtrip(supabase, emit, "reminders", "Lembretes", { user_id: user.id, message: `${tag} lembrete`, remind_at: future, status: "cancelled", source: "manual" }, { message: `${tag} editado` });
  await roundtrip(supabase, emit, "calendar_events", "Agenda", { user_id: user.id, title: `${tag} evento`, starts_at: future, ends_at: future, source: "manual" }, { title: `${tag} editado` });
  await roundtrip(supabase, emit, "memories", "Memória", { user_id: user.id, content: `${tag} memória`, category: "contexto", source: "diagnóstico", confidence: 1, is_active: false }, { content: `${tag} editada` });
  await roundtrip(supabase, emit, "notifications", "Notificações", { user_id: user.id, title: `${tag}`, body: `${tag} notificação`, kind: "sistema" }, { read_at: new Date().toISOString() });
  await roundtrip(supabase, emit, "action_confirmations", "Confirmações (actions)", { user_id: user.id, tool: "diagnostico", params: {}, summary: `${tag}`, status: "cancelled" }, { status: "confirmed" });

  // Conversa + mensagem
  {
    const group = "Gravação e RLS";
    const conv = await supabase.from("conversations").insert({ user_id: user.id, title: `${tag} conversa` }).select("id").single();
    if (conv.error || !conv.data?.id) {
      emit(failFrom(group, "rt-conv", "Conversas e mensagens: criar conversa", conv.error ?? "sem retorno"));
    } else {
      const convId = conv.data.id as string;
      const msg = await supabase.from("messages").insert({ user_id: user.id, conversation_id: convId, role: "user", content: `${tag} mensagem`, metadata: null }).select("id").single();
      if (msg.error || !msg.data?.id) {
        emit(failFrom(group, "rt-conv", "Conversas e mensagens: criar mensagem", msg.error ?? "sem retorno"));
      } else {
        const back = await supabase.from("messages").select("id").eq("conversation_id", convId);
        const delMsg = await supabase.from("messages").delete().eq("id", msg.data.id as string).select("id");
        if (back.error || (back.data ?? []).length !== 1) emit(failFrom(group, "rt-conv", "Conversas e mensagens: ler", back.error ?? "a mensagem não foi lida de volta"));
        else if (delMsg.error) emit(failFrom(group, "rt-conv", "Conversas e mensagens: excluir mensagem", delMsg.error));
        else emit(mk(group, "rt-conv", "Conversas e mensagens", "ok", "Criar conversa, gravar e ler mensagem funcionam (o histórico persiste)."));
      }
      await supabase.from("conversations").delete().eq("id", convId);
    }
  }

  // Tema (regrava os valores atuais)
  {
    const group = "Gravação e RLS";
    const cur = await supabase.from("theme_preferences").select("accent_color, theme_mode").eq("user_id", user.id).maybeSingle();
    if (cur.error) emit(failFrom(group, "rt-theme", "Tema", cur.error));
    else {
      const row = (cur.data as { accent_color?: string; theme_mode?: string } | null) ?? {};
      const up = await supabase
        .from("theme_preferences")
        .upsert({ user_id: user.id, accent_color: row.accent_color ?? "red", theme_mode: row.theme_mode ?? "dark" }, { onConflict: "user_id" });
      emit(up.error ? failFrom(group, "rt-theme", "Tema", up.error) : mk(group, "rt-theme", "Tema", "ok", "Preferências de tema são gravadas no Supabase."));
    }
  }

  // Auditoria (só inserção)
  {
    const group = "Gravação e RLS";
    const a = await supabase.from("audit_logs").insert({ user_id: user.id, action: `${tag} verificação`, tool: "diagnostico", status: "success", origin: "system", metadata: {} });
    emit(a.error ? failFrom(group, "rt-audit", "Auditoria", a.error) : mk(group, "rt-audit", "Auditoria", "ok", "O registro de ações é gravado (esse log de teste permanece, por ser somente inserção)."));
  }

  // 6) Isolamento entre usuários (RLS)
  const gr = "Gravação e RLS";
  const stranger = crypto.randomUUID();
  const intrusion = await supabase.from("tasks").insert({ user_id: stranger, title: `${tag} intrusão`, status: "pending" }).select("id");
  if (intrusion.error) {
    const c = classifySupabaseError(intrusion.error);
    emit(
      c.kind === "rls"
        ? mk(gr, "rls-write", "RLS: gravar como outro usuário", "ok", "Bloqueado corretamente pelo banco.")
        : mk(gr, "rls-write", "RLS: gravar como outro usuário", "warn", `Bloqueado, mas por outro motivo (${c.label}). ${c.help}`),
    );
  } else {
    emit(mk(gr, "rls-write", "RLS: gravar como outro usuário", "fail", "PERIGO: o banco aceitou gravar uma tarefa em nome de outro usuário. A política de INSERT da tabela tasks está aberta demais."));
    const ids = ((intrusion.data ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length) await supabase.from("tasks").delete().in("id", ids);
  }
  const all = await supabase.from("tasks").select("user_id").limit(500);
  if (all.error) emit(failFrom(gr, "rls-read", "RLS: ler dados de outros usuários", all.error));
  else {
    const foreign = ((all.data ?? []) as Array<{ user_id: string }>).filter((r) => r.user_id !== user.id).length;
    emit(
      foreign === 0
        ? mk(gr, "rls-read", "RLS: ler dados de outros usuários", "ok", "A consulta sem filtro só devolveu linhas do próprio usuário.")
        : mk(gr, "rls-read", "RLS: ler dados de outros usuários", "fail", `PERIGO: ${foreign} tarefa(s) de outros usuários apareceram. A política de SELECT da tabela tasks está aberta demais.`),
    );
  }
}

export function formatReport(results: DiagResult[]): string {
  const icon = { ok: "OK   ", warn: "AVISO", fail: "FALHA" } as const;
  return [`Diagnóstico JARVIS · ${new Date().toLocaleString("pt-BR")}`, ...results.map((r) => `${icon[r.status]} [${r.group}] ${r.name}: ${r.detail}`)].join("\n");
}
