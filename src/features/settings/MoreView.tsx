"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth, useTheme } from "@/components/Providers";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Loading, Tabs, useToast } from "@/components/ui";
import { ACCENT_COLORS } from "@/config/theme";
import { MemoryPanel } from "@/features/memory/MemoryPanel";
import { AutonomyPanel, PermissionsPanel } from "@/features/permissions/Panels";
import { friendlyError } from "@/lib/errors";
import type { AccentColor, ThemeMode } from "@/types";
import { formatWhen } from "@/utils/datetime";

type Section = "perfil" | "tema" | "ia" | "memoria" | "permissoes" | "notificacoes" | "integracoes" | "automacoes" | "privacidade" | "seguranca";

const SECTIONS: Array<{ id: Section; label: string; hint: string }> = [
  { id: "perfil", label: "Perfil", hint: "Seu nome" },
  { id: "tema", label: "Tema", hint: "Modo e cor de destaque" },
  { id: "ia", label: "IA e autonomia", hint: "Até onde o JARVIS pode agir" },
  { id: "memoria", label: "Memória", hint: "O que o JARVIS guardou" },
  { id: "permissoes", label: "Permissões", hint: "Recursos liberados" },
  { id: "notificacoes", label: "Notificações", hint: "Avisos e lembretes" },
  { id: "integracoes", label: "Integrações", hint: "Gmail, Google Calendar, WhatsApp…" },
  { id: "automacoes", label: "Automações", hint: "Em breve" },
  { id: "privacidade", label: "Privacidade", hint: "Como seus dados são tratados" },
  { id: "seguranca", label: "Segurança", hint: "Sessão e histórico de ações" },
];

function ProfilePanel() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName((data?.display_name as string | null) ?? ""));
  }, [supabase, user]);

  const save = async () => {
    if (!supabase || !user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: name.trim() || null }, { onConflict: "id" });
    setBusy(false);
    toast(error ? friendlyError(error, "Não foi possível salvar o perfil.") : "Perfil salvo.", error ? "error" : "success");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={name || user?.email} size={48} />
        <p className="min-w-0 break-all text-sm text-muted">{user?.email}</p>
      </div>
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devo te chamar?" />
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
  const [items, setItems] = useState<Array<{ id: string; title: string; body: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error: err } = await supabase.from("notifications").select("id, title, body, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (err) setError(friendlyError(err, "Não foi possível carregar as notificações."));
    else {
      setError(null);
      setItems((data ?? []) as typeof items);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Os lembretes aparecem aqui e como aviso dentro do app enquanto ele estiver aberto. Notificações push ainda não estão ativas.</p>
      {items.length === 0 ? (
        <EmptyState title="Sem notificações" />
      ) : (
        items.map((n) => (
          <Card key={n.id} className="!p-3">
            <p className="text-[15px]">{n.body ?? n.title}</p>
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
      <p className="text-sm text-muted">A estrutura está pronta, mas nenhuma integração externa foi implementada ainda. Nada é enviado ou lido de serviços externos.</p>
      {INTEGRATIONS.map((i) => (
        <Card key={i.key} className="flex items-center justify-between !p-3">
          <span className="text-[15px]">{i.label}</span>
          <Badge tone={status[i.key] === "connected" ? "success" : "neutral"}>{status[i.key] === "connected" ? "Conectado" : "Não disponível"}</Badge>
        </Card>
      ))}
    </div>
  );
}

function SecurityPanel() {
  const { supabase, user, signOut } = useAuth();
  const [logs, setLogs] = useState<Array<{ id: string; tool: string | null; status: string | null; created_at: string }>>([]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("audit_logs")
      .select("id, tool, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setLogs((data ?? []) as typeof logs));
  }, [supabase, user]);

  return (
    <div className="space-y-4">
      <Button variant="danger" onClick={() => void signOut()}>
        Sair da conta
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted">Últimas ações registradas</p>
        {logs.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação registrada ainda.</p>
        ) : (
          logs.map((l) => (
            <Card key={l.id} className="flex items-center justify-between !p-3">
              <span className="text-sm">{l.tool ?? "—"}</span>
              <span className="text-xs text-muted">
                {l.status} · {formatWhen(l.created_at)}
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
      <p>Seus dados ficam no seu projeto Supabase e só a sua conta consegue acessá-los (regras de segurança por usuário).</p>
      <p>O JARVIS só guarda na memória o que você pede ou adiciona. Você pode editar, desativar ou excluir qualquer item em Memória.</p>
      <p>Nenhuma chave privada é guardada no app. Ações sensíveis sempre exigem a sua confirmação e ficam registradas no histórico.</p>
    </div>
  );
}

function Panel({ section }: { section: Section }): ReactNode {
  switch (section) {
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
      return <EmptyState title="Automações em breve" description="As tabelas já existem no banco, mas o motor que executa automações agendadas ainda não foi implementado." />;
    case "privacidade":
      return <PrivacyPanel />;
    case "seguranca":
      return <SecurityPanel />;
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
