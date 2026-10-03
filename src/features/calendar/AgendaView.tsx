"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Loading, Modal, Tabs, useToast } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatWhen } from "@/utils/datetime";

interface AgendaItem {
  key: string;
  kind: "event" | "task" | "reminder";
  id: string;
  title: string;
  at: string;
}

type Kind = "reminder" | "event";

const KIND_LABEL = { event: "Evento", task: "Tarefa", reminder: "Lembrete" } as const;

export function AgendaView() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<Kind>("reminder");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 30 * 24 * 3600 * 1000);
    const f = from.toISOString();
    const t = to.toISOString();
    const [events, tasks, reminders] = await Promise.all([
      supabase.from("calendar_events").select("id, title, starts_at").eq("user_id", user.id).gte("starts_at", f).lte("starts_at", t).order("starts_at"),
      supabase.from("tasks").select("id, title, due_at").eq("user_id", user.id).eq("status", "pending").gte("due_at", f).lte("due_at", t).order("due_at"),
      supabase.from("reminders").select("id, message, remind_at").eq("user_id", user.id).eq("status", "pending").gte("remind_at", f).lte("remind_at", t).order("remind_at"),
    ]);
    const failed = events.error ?? tasks.error ?? reminders.error;
    if (failed) {
      setError(friendlyError(failed, "Não foi possível carregar a agenda."));
    } else {
      const merged: AgendaItem[] = [
        ...(events.data ?? []).map((e) => ({ key: `e${e.id}`, kind: "event" as const, id: e.id as string, title: e.title as string, at: e.starts_at as string })),
        ...(tasks.data ?? []).map((x) => ({ key: `t${x.id}`, kind: "task" as const, id: x.id as string, title: x.title as string, at: x.due_at as string })),
        ...(reminders.data ?? []).map((r) => ({ key: `r${r.id}`, kind: "reminder" as const, id: r.id as string, title: r.message as string, at: r.remind_at as string })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      setItems(merged);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !title.trim() || !when) return;
    setBusy(true);
    try {
      const iso = new Date(when).toISOString();
      const res =
        kind === "reminder"
          ? await supabase.from("reminders").insert({ user_id: user.id, message: title.trim(), remind_at: iso, status: "pending" })
          : await supabase.from("calendar_events").insert({ user_id: user.id, title: title.trim(), starts_at: iso });
      if (res.error) throw res.error;
      setCreating(false);
      setTitle("");
      setWhen("");
      await load();
    } catch (err) {
      toast(friendlyError(err, "Não foi possível salvar. Tente novamente."), "error");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: AgendaItem) => {
    if (!supabase || !user || item.kind === "task") return;
    const res =
      item.kind === "reminder"
        ? await supabase.from("reminders").update({ status: "cancelled" }).eq("id", item.id).eq("user_id", user.id)
        : await supabase.from("calendar_events").delete().eq("id", item.id).eq("user_id", user.id);
    if (res.error) toast(friendlyError(res.error), "error");
    else await load();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          + Novo
        </Button>
      </header>
      <p className="px-4 pb-2 text-xs text-muted">Próximos 30 dias. Calendário interno; Google Calendar e Outlook ainda não estão conectados.</p>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loading />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState title="Agenda livre" description="Nenhum compromisso, tarefa com data ou lembrete nos próximos 30 dias." />
        ) : (
          items.map((it) => (
            <Card key={it.key} className="anim-in flex items-center gap-3 !p-3">
              <div className="min-w-0 flex-1">
                <p className="break-words text-[15px]">{it.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted">{formatWhen(it.at)}</span>
                  <Badge tone={it.kind === "task" ? "neutral" : "accent"}>{KIND_LABEL[it.kind]}</Badge>
                </div>
              </div>
              {it.kind !== "task" ? (
                <Button variant="ghost" size="sm" onClick={() => removeItem(it)} aria-label={`Remover ${it.title}`}>
                  Remover
                </Button>
              ) : null}
            </Card>
          ))
        )}
      </div>

      <Modal open={creating} title="Novo item" onClose={() => setCreating(false)}>
        <form onSubmit={create} className="space-y-3">
          <Tabs
            value={kind}
            onChange={setKind}
            items={[
              { value: "reminder", label: "Lembrete" },
              { value: "event", label: "Evento" },
            ]}
          />
          <Input label={kind === "reminder" ? "Lembrar de" : "Título"} value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input label="Data e horário" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          <Button type="submit" className="w-full" loading={busy}>
            Salvar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
