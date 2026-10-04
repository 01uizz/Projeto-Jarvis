"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAuth, useTheme } from "@/components/Providers";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Loading, Tabs, useToast } from "@/components/ui";
import { ACCENT_COLORS } from "@/config/theme";
import { DevicesPanel } from "@/features/devices/DevicesPanel";
import { HistoryPanel } from "@/features/devices/HistoryPanel";
import { MemoryPanel } from "@/features/memory/MemoryPanel";
import { AutonomyPanel, PermissionsPanel } from "@/features/permissions/Panels";
import { DiagnosticsPanel } from "@/features/settings/DiagnosticsPanel";
import { PasswordMeter } from "@/features/settings/AuthScreen";
import { friendlyError } from "@/lib/errors";
import { evaluatePassword, isValidUsername, normalizeUsername, USERNAME_RULES } from "@/lib/password";
import type { AccentColor, AppNotification, ThemeMode } from "@/types";
import { formatWhen } from "@/utils/datetime";

type Section = "dispositivos" | "historico" | "perfil" | "tema" | "ia" | "memoria" | "permissoes" | "notificacoes" | "integracoes" | "automacoes" | "privacidade" | "seguranca" | "diagnostico";

const SECTIONS: Array<{ id: Section; label: string; hint: string }> = [
  { id: "dispositivos", label: "Dispositivos", hint: "Aparelhos Android, estado e capacidades" },
  { id: "historico", label: "Histórico", hint: "Ações, comandos e eventos" },
  { id: "perfil", label: "Perfil", hint: "Username e nome" },
  { id: "tema", label: "Tema", hint: "Modo e cor de destaque" },
  { id: "ia", label: "IA e autonomia", hint: "Até onde o JARVIS pode agir" },
  { id: "memoria", label: "Memória", hint: "O que o JARVIS guardou" },
  { id: "permissoes", label: "Permissões", hint: "Recursos liberados" },
  { id: "notificacoes", label: "Notificações", hint: "Avisos e lembretes" },
  { id: "integracoes", label: "Integrações", hint: "Gmail, Google Calendar, WhatsApp…" },
  { id: "automacoes", label: "Automações", hint: "Estrutura pendente" },
  { id: "privacidade", label: "Privacidade", hint: "Como seus dados são tratados" },
  { id: "seguranca", label: "Segurança", hint: "Senha, sessão e histórico de ações" },
  { id: "diagnostico", label: "Diagnóstico", hint: "Testar a conexão com o Supabase" },
];

function ProfilePanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [onboarded, setOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("profiles")
      .select("username, display_name, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast(friendlyError(error, "Não foi possível carregar o perfil."), "error");
        const p = data as { username?: string | null; display_name?: string | null; onboarding_completed?: boolean | null } | null;
        setUsername(p?.username ?? "");
        setName(p?.display_name ?? "");
        setOnboarded(Boolean(p?.onboarding_completed));
        setLoading(false);
      });
  }, [supabase, user, toast]);

  const save = async () => {
    if (!supabase || !user) return;
    const u = normalizeUsername(username);
    if (u && !isValidUsername(u)) {
      toast(`Username inválido. ${USERNAME_RULES}`, "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, username: u || null, display_name: name.trim() || null, onboarding_completed: true }, { onConflict: "id" });
    setBusy(false);
    if (error?.code === "23505") toast("Esse username já está em uso. Escolha outro.", "error");
    else toast(error ? friendlyError(error, "Não foi possível salvar o perfil.") : "Perfil salvo.", error ? "error" : "success");
    if (!error) setOnboarded(true);
  };

  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={name || username || user?.email} size={48} />
        <div className="min-w-0">
          <p className="break-all text-sm">{user?.email}</p>
          <p className="text-xs text-muted">O e-mail é da conta e não aparece como username.</p>
        </div>
      </div>
      <Input label="Username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="joao.silva" />
      <p className="-mt-2 text-xs text-muted">{USERNAME_RULES}</p>
      <Input label="Nome de exibição" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devo te chamar?" />
      {!onboarded ? <Badge tone="accent">Perfil ainda não concluído</Badge> : null}
      <Button onClick={save} loading={busy}>
        Salvar
      </Button>
    </div>
  );
}

function ThemePanel() {
  const { accent, mode, setAccent, setMode } = useTheme();
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-muted">Modo</p>
        <Tabs<ThemeMode>
          value={mode}
          onChange={(m) => void setMode(m)}
          items={[
            { value: "dark", label: "Escuro" },
            { value: "light", label: "Claro" },
            { value: "system", label: "Sistema" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted">Cor de destaque</p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((c) => (
            <button
              key={c}
              onClick={() => void setAccent(c)}
              aria-label={ACCENT_COLORS[c].label}
              aria-pressed={accent === c}
              className={`h-11 w-11 rounded-full border-2 transition ${accent === c ? "border-text" : "border-transparent"}`}
              style={{ background: ACCENT_COLORS[c].hex }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsPanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("notifications")
      .select("id, title, body, kind, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (err) setError(friendlyError(err, "Não foi possível carregar as notificações."));
    else {
      setError(null);
      setItems((data ?? []) as AppNotification[]);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (err) toast(friendlyError(err), "error");
    else await load();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Os lembretes aparecem aqui e como aviso dentro do app enquanto ele estiver aberto. Notificações push (com o app fechado) ainda não estão ativas; a estrutura está pronta para isso.
      </p>
      {unread > 0 ? (
        <Button variant="secondary" size="sm" onClick={markAllRead}>
          Marcar {unread} como lida(s)
        </Button>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="Sem notificações" />
      ) : (
        items.map((n) => (
          <Card key={n.id} className="!p-3">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-[15px] ${n.read_at ? "text-muted" : ""}`}>{n.body ?? n.title}</p>
              {n.kind ? <Badge tone={n.read_at ? "neutral" : "accent"}>{n.kind}</Badge> : null}
            </div>
            <p className="text-xs text-muted">{formatWhen(n.created_at)}</p>
          </Card>
        ))
      )}
    </div>
  );
}

const INTEGRATIONS = [
  { key: "google", label: "Google (Gmail e Calendar)" },
  { key: "microsoft", label: "Microsoft (Outlook)" },
  { key: "whatsapp", label: "WhatsApp" },
];

function IntegrationsPanel() {
  const { supabase, user } = useAuth();
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("integrations")
      .select("provider, status")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const row of data ?? []) map[String(row.provider)] = String(row.status);
        setStatus(map);
      });
  }, [supabase, user]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Essa integração ainda não está conectada. A estrutura está pronta, mas nenhum serviço externo foi implementado: nada é lido nem enviado.</p>
      {INTEGRATIONS.map((i) => (
        <Card key={i.key} className="flex items-center justify-between !p-3">
          <span className="text-[15px]">{i.label}</span>
          <Badge tone={status[i.key] === "connected" ? "success" : "neutral"}>{status[i.key] === "connected" ? "Conectado" : "Não conectado"}</Badge>
        </Card>
      ))}
    </div>
  );
}

function ChangePassword() {
  const { supabase } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!evaluatePassword(password).acceptable) {
      toast("Escolha uma senha mais forte: 8+ caracteres e nível \"média\" ou superior.", "error");
      return;
    }
    if (password !== confirm) {
      toast("A confirmação não é igual à senha.", "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast(friendlyError(error, "Não foi possível alterar a senha."), "error");
    else {
      toast("Senha alterada.", "success");
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-sm font-medium text-muted">Alterar senha</h3>
      <Input label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {password ? <PasswordMeter password={password} /> : null}
      <Input label="Confirmar nova senha" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" variant="secondary" loading={busy} disabled={!password}>
        Alterar senha
      </Button>
    </form>
  );
}

function SecurityPanel() {
  const { supabase, user, signOut } = useAuth();
  const [logs, setLogs] = useState<Array<{ id: string; tool: string | null; status: string | null; origin: string | null; created_at: string }>>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("audit_logs")
      .select("id, tool, status, origin, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setLogs((data ?? []) as typeof logs));
  }, [supabase, user]);

  return (
    <div className="space-y-6">
      <ChangePassword />
      <Button variant="danger" onClick={() => void signOut()}>
        Sair da conta
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted">Últimas ações registradas</p>
        {logs.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação registrada ainda.</p>
        ) : (
          logs.map((l) => (
            <Card key={l.id} className="flex items-center justify-between gap-2 !p-3">
              <span className="text-sm">{l.tool ?? "—"}</span>
              <span className="text-right text-xs text-muted">
                {l.status} · {l.origin ?? "—"} · {formatWhen(l.created_at)}
              </span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function PrivacyPanel() {
  return (
    <div className="space-y-3 text-sm text-muted">
      <p>Seus dados ficam no seu projeto Supabase e só a sua conta consegue acessá-los (regras de segurança por usuário, RLS).</p>
      <p>O JARVIS só guarda na memória o que você pede ou adiciona. Você pode editar, desativar ou excluir qualquer item em Memória.</p>
      <p>Nenhuma chave privada é guardada no app. Ações sensíveis sempre exigem a sua confirmação e ficam registradas no histórico.</p>
    </div>
  );
}

function Panel({ section }: { section: Section }): ReactNode {
  switch (section) {
    case "dispositivos":
      return <DevicesPanel />;
    case "historico":
      return <HistoryPanel />;
    case "perfil":
      return <ProfilePanel />;
    case "tema":
      return <ThemePanel />;
    case "ia":
      return <AutonomyPanel />;
    case "memoria":
      return <MemoryPanel />;
    case "permissoes":
      return <PermissionsPanel />;
    case "notificacoes":
      return <NotificationsPanel />;
    case "integracoes":
      return <IntegrationsPanel />;
    case "automacoes":
      return <EmptyState title="Automações ainda não disponíveis" description="As tabelas automations e automation_runs existem, mas o prompt não define as colunas delas, e a regra é não inventar estrutura. Informe as colunas reais (nome, gatilho, ação, agenda, estado) para eu implementar. Também falta um motor que execute em segundo plano com o app fechado, que o Android restringe." />;
    case "privacidade":
      return <PrivacyPanel />;
    case "seguranca":
      return <SecurityPanel />;
    case "diagnostico":
      return <DiagnosticsPanel />;
  }
}

export function MoreView() {
  const [section, setSection] = useState<Section | null>(null);
  const current = SECTIONS.find((s) => s.id === section);

  if (section && current) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-2 px-2 pb-2 pt-3">
          <Button variant="ghost" size="sm" onClick={() => setSection(null)} aria-label="Voltar">
            ← Voltar
          </Button>
          <h1 className="text-lg font-semibold">{current.label}</h1>
        </header>
        <div className="anim-in min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <Panel section={section} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pb-3 pt-4">
        <h1 className="text-xl font-semibold">Mais</h1>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-6">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left transition active:scale-[0.99]">
            <span>
              <span className="block text-[15px] font-medium">{s.label}</span>
              <span className="block text-xs text-muted">{s.hint}</span>
            </span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
