"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, ErrorState, Loading } from "@/components/ui";
import { AUTONOMY_LABELS } from "@/config/theme";
import { friendlyError } from "@/lib/errors";
import { getAutonomy } from "@/services/permissions";
import { checkVoiceSupport } from "@/services/voice";
import type { AutonomyLevel } from "@/types";
import { endOfDay, formatWhen, startOfDay } from "@/utils/datetime";

export type TabId = "inicio" | "chat" | "tarefas" | "agenda" | "mais";

interface DashData {
  name: string | null;
  openTasks: number;
  dueToday: number;
  overdue: number;
  tasks: Array<{ id: string; title: string; due_at: string | null }>;
  events: Array<{ id: string; title: string; starts_at: string }>;
  reminders: Array<{ id: string; message: string; remind_at: string }>;
  unread: number;
  notifications: Array<{ id: string; title: string; body: string | null; created_at: string }>;
  activity: Array<{ id: string; tool: string | null; status: string | null; created_at: string }>;
  autonomy: AutonomyLevel;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const STATUS_PT: Record<string, string> = {
  success: "executado",
  error: "erro",
  unavailable: "não conectado",
  denied: "bloqueado",
  pending_confirmation: "aguardando confirmação",
  cancelled: "cancelado",
};

function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: ReactNode }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">{title}</h2>
        {action ? (
          <button onClick={action.onClick} className="min-h-9 text-xs text-accent">
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export function DashboardView({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { supabase, user } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setError(null);
    const now = new Date();
    const nowIso = now.toISOString();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    try {
      const [profile, openTasks, dueToday, overdue, tasks, events, reminders, unread, notifications, activity, autonomy] = await Promise.all([
        supabase.from("profiles").select("display_name, username").eq("id", user.id).maybeSingle(),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending").gte("due_at", dayStart).lte("due_at", dayEnd),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending").lt("due_at", dayStart),
        supabase.from("tasks").select("id, title, due_at").eq("user_id", user.id).eq("status", "pending").order("due_at", { ascending: true, nullsFirst: false }).limit(5),
        supabase.from("calendar_events").select("id, title, starts_at").eq("user_id", user.id).gte("starts_at", nowIso).order("starts_at").limit(4),
        supabase.from("reminders").select("id, message, remind_at").eq("user_id", user.id).eq("status", "pending").gte("remind_at", nowIso).order("remind_at").limit(4),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
        supabase.from("notifications").select("id, title, body, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("audit_logs").select("id, tool, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        getAutonomy(supabase, user.id),
      ]);
      const failed = [profile, openTasks, dueToday, overdue, tasks, events, reminders, unread, notifications, activity].find((r) => r.error);
      if (failed?.error) throw failed.error;
      const p = profile.data as { display_name?: string | null; username?: string | null } | null;
      setData({
        name: p?.display_name || p?.username || null,
        openTasks: openTasks.count ?? 0,
        dueToday: dueToday.count ?? 0,
        overdue: overdue.count ?? 0,
        tasks: (tasks.data ?? []) as DashData["tasks"],
        events: (events.data ?? []) as DashData["events"],
        reminders: (reminders.data ?? []) as DashData["reminders"],
        unread: unread.count ?? 0,
        notifications: (notifications.data ?? []) as DashData["notifications"],
        activity: (activity.data ?? []) as DashData["activity"],
        autonomy,
      });
    } catch (e) {
      setError(friendlyError(e, "Não foi possível carregar o painel."));
    }
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading label="Carregando seu dia" />
      </div>
    );
  }

  const voice = checkVoiceSupport();
  const summary: string[] = [];
  if (data.dueToday > 0) summary.push(`${data.dueToday} ${data.dueToday === 1 ? "tarefa" : "tarefas"} para hoje`);
  if (data.overdue > 0) summary.push(`${data.overdue} ${data.overdue === 1 ? "atrasada" : "atrasadas"}`);
  if (data.events.length > 0) summary.push(`próximo evento: ${formatWhen(data.events[0].starts_at).toLowerCase()}`);
  if (data.unread > 0) summary.push(`${data.unread} ${data.unread === 1 ? "notificação nova" : "notificações novas"}`);

  return (
    <div className="h-full space-y-3 overflow-y-auto px-4 pb-6 pt-4">
      <header>
        <p className="text-sm text-muted">{greeting()}</p>
        <h1 className="text-2xl font-semibold">{data.name ?? "Olá"}</h1>
        <p className="mt-1 text-sm text-muted">{summary.length > 0 ? summary.join(" · ") : "Nada urgente por enquanto."}</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => onNavigate("chat")}>🎙 Falar com o JARVIS</Button>
        <Button variant="secondary" onClick={() => onNavigate("tarefas")}>
          + Nova tarefa
        </Button>
        <Button variant="secondary" onClick={() => onNavigate("agenda")}>
          📅 Agenda e lembretes
        </Button>
        <Button variant="secondary" onClick={() => onNavigate("mais")}>
          ⚙ Configurações
        </Button>
      </div>

      <Section title={`Tarefas pendentes (${data.openTasks})`} action={{ label: "Ver todas", onClick: () => onNavigate("tarefas") }}>
        {data.tasks.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma tarefa pendente.</p>
        ) : (
          data.tasks.map((t) => (
            <div key={t.id} className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="min-w-0 break-words">{t.title}</span>
              <span className="shrink-0 text-xs text-muted">{t.due_at ? formatWhen(t.due_at) : "sem prazo"}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Próximos eventos" action={{ label: "Agenda", onClick: () => onNavigate("agenda") }}>
        {data.events.length === 0 ? (
          <p className="text-sm text-muted">Nenhum evento marcado.</p>
        ) : (
          data.events.map((e) => (
            <div key={e.id} className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="min-w-0 break-words">{e.title}</span>
              <span className="shrink-0 text-xs text-muted">{formatWhen(e.starts_at)}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Lembretes" action={{ label: "Gerenciar", onClick: () => onNavigate("agenda") }}>
        {data.reminders.length === 0 ? (
          <p className="text-sm text-muted">Nenhum lembrete pendente.</p>
        ) : (
          data.reminders.map((r) => (
            <div key={r.id} className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="min-w-0 break-words">{r.message}</span>
              <span className="shrink-0 text-xs text-muted">{formatWhen(r.remind_at)}</span>
            </div>
          ))
        )}
      </Section>

      <Section title={`Notificações${data.unread ? ` (${data.unread} novas)` : ""}`}>
        {data.notifications.length === 0 ? (
          <p className="text-sm text-muted">Sem notificações.</p>
        ) : (
          data.notifications.map((n) => (
            <div key={n.id} className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="min-w-0 break-words">{n.body ?? n.title}</span>
              <span className="shrink-0 text-xs text-muted">{formatWhen(n.created_at)}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Atividade recente do JARVIS">
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação registrada ainda.</p>
        ) : (
          data.activity.map((a) => (
            <div key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{a.tool ?? "—"}</span>
              <span className="text-xs text-muted">
                {STATUS_PT[a.status ?? ""] ?? a.status} · {formatWhen(a.created_at)}
              </span>
            </div>
          ))
        )}
      </Section>

      <Section title="Status do JARVIS">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="success">Banco conectado</Badge>
          <Badge tone="accent">{AUTONOMY_LABELS[data.autonomy].name}</Badge>
          <Badge tone={voice.supported ? "success" : "neutral"}>{voice.supported ? "Voz disponível" : "Voz indisponível"}</Badge>
          <Badge>Push desativado</Badge>
          <Badge>Nenhuma integração externa</Badge>
        </div>
        {!voice.supported && voice.reason ? <p className="text-xs text-muted">{voice.reason}</p> : null}
      </Section>
    </div>
  );
}
