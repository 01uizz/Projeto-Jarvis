"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, ErrorState, Input, Loading, Modal, Switch, Tabs, Textarea, useToast } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import type { CalendarEvent, Reminder } from "@/types";
import { formatWhen } from "@/utils/datetime";

interface AgendaItem {
  key: string;
  kind: "event" | "task" | "reminder";
  id: string;
  title: string;
  at: string;
  event?: CalendarEvent;
}

const KIND_LABEL = { event: "Evento", task: "Tarefa", reminder: "Lembrete" } as const;

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------------- Eventos ---------------- */
function EventForm({ initial, onClose, onSaved }: { initial?: CalendarEvent; onClose: () => void; onSaved: () => void }) {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [start, setStart] = useState(toLocalInput(initial?.starts_at));
  const initialDuration = initial?.ends_at ? Math.max(5, Math.round((new Date(initial.ends_at).getTime() - new Date(initial.starts_at).getTime()) / 60000)) : 60;
  const [duration, setDuration] = useState(String(initialDuration));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !title.trim() || !start) return;
    setBusy(true);
    try {
      const startsAt = new Date(start);
      const minutes = Math.max(1, Number(duration) || 60);
      const row = {
        title: title.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + minutes * 60000).toISOString(),
        description: description.trim() || null,
        location: location.trim() || null,
      };
      const res = initial
        ? await supabase.from("calendar_events").update(row).eq("id", initial.id).eq("user_id", user.id)
        : await supabase.from("calendar_events").insert({ ...row, user_id: user.id, source: "manual" });
      if (res.error) throw res.error;
      onSaved();
      onClose();
    } catch (err) {
      toast(friendlyError(err, "Não foi possível salvar o evento. Tente novamente."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      <Input label="Início" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
      <Input label="Duração (minutos)" type="number" inputMode="numeric" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
      <Input label="Local (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} />
      <Textarea label="Descrição (opcional)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <Button type="submit" className="w-full" loading={busy}>
        Salvar
      </Button>
    </form>
  );
}

/* ---------------- Lembretes ---------------- */
function ReminderForm({ initial, onClose, onSaved }: { initial?: Reminder; onClose: () => void; onSaved: () => void }) {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [message, setMessage] = useState(initial?.message ?? "");
  const [when, setWhen] = useState(toLocalInput(initial?.remind_at));
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !message.trim() || !when) return;
    setBusy(true);
    try {
      const iso = new Date(when).toISOString();
      const res = initial
        ? await supabase.from("reminders").update({ message: message.trim(), remind_at: iso, status: "pending" }).eq("id", initial.id).eq("user_id", user.id)
        : await supabase.from("reminders").insert({ user_id: user.id, message: message.trim(), remind_at: iso, status: "pending", source: "manual" });
      if (res.error) throw res.error;
      onSaved();
      onClose();
    } catch (err) {
      toast(friendlyError(err, "Não foi possível salvar o lembrete. Tente novamente."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Lembrar de" value={message} onChange={(e) => setMessage(e.target.value)} required autoFocus />
      <Input label="Data e horário" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      <p className="text-xs text-muted">O aviso aparece dentro do app enquanto ele estiver aberto. Avisos com o app fechado ainda não estão disponíveis.</p>
      <Button type="submit" className="w-full" loading={busy}>
        Salvar
      </Button>
    </form>
  );
}

function RemindersList() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; item?: Reminder }>({ open: false });
  const [deleting, setDeleting] = useState<Reminder | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("reminders")
      .select("id, message, remind_at, status, source, created_at")
      .eq("user_id", user.id)
      .order("remind_at", { ascending: true })
      .limit(200);
    if (err) setError(friendlyError(err, "Não foi possível carregar os lembretes."));
    else {
      setError(null);
      setItems((data ?? []) as Reminder[]);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (r: Reminder, active: boolean) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("reminders").update({ status: active ? "pending" : "cancelled" }).eq("id", r.id).eq("user_id", user.id);
    if (err) toast(friendlyError(err), "error");
    else await load();
  };

  const remove = async (r: Reminder) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("reminders").delete().eq("id", r.id).eq("user_id", user.id);
    if (err) toast(friendlyError(err), "error");
    else await load();
  };

  return (
    <>
      <div className="flex justify-end px-4 pb-2">
        <Button size="sm" onClick={() => setForm({ open: true })}>
          + Lembrete
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loading />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum lembrete" description={'Crie um aqui ou peça no chat: "Me lembre de estudar às 20h".'} />
        ) : (
          items.map((r) => (
            <Card key={r.id} className="anim-in flex items-center gap-3 !p-3">
              <div className="min-w-0 flex-1">
                <p className={`break-words text-[15px] ${r.status === "pending" ? "" : "text-muted"}`}>{r.message}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">{formatWhen(r.remind_at)}</span>
                  {r.status === "sent" ? <Badge tone="success">Avisado</Badge> : null}
                  {r.status === "cancelled" ? <Badge>Desativado</Badge> : null}
                  {r.source === "agent" ? <Badge tone="accent">via JARVIS</Badge> : null}
                </div>
              </div>
              {r.status !== "sent" ? <Switch checked={r.status === "pending"} onChange={(v) => toggle(r, v)} label={r.status === "pending" ? "Desativar lembrete" : "Ativar lembrete"} /> : null}
              <Dropdown
                label="⋯"
                items={[
                  { label: "Editar", onSelect: () => setForm({ open: true, item: r }) },
                  { label: "Excluir", danger: true, onSelect: () => setDeleting(r) },
                ]}
              />
            </Card>
          ))
        )}
      </div>
      <Modal open={form.open} title={form.item ? "Editar lembrete" : "Novo lembrete"} onClose={() => setForm({ open: false })}>
        {form.open ? <ReminderForm initial={form.item} onClose={() => setForm({ open: false })} onSaved={load} /> : null}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir lembrete"
        message={`Excluir "${deleting?.message ?? ""}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove(deleting)}
      />
    </>
  );
}

/* ---------------- Tela ---------------- */
export function AgendaView() {
  const { supabase, user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"agenda" | "lembretes">("agenda");
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; item?: CalendarEvent }>({ open: false });
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);

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
      supabase
        .from("calendar_events")
        .select("id, title, starts_at, ends_at, description, location, source")
        .eq("user_id", user.id)
        .gte("starts_at", f)
        .lte("starts_at", t)
        .order("starts_at"),
      supabase.from("tasks").select("id, title, due_at").eq("user_id", user.id).eq("status", "pending").gte("due_at", f).lte("due_at", t).order("due_at"),
      supabase.from("reminders").select("id, message, remind_at").eq("user_id", user.id).eq("status", "pending").gte("remind_at", f).lte("remind_at", t).order("remind_at"),
    ]);
    const failed = events.error ?? tasks.error ?? reminders.error;
    if (failed) {
      setError(friendlyError(failed, "Não foi possível carregar a agenda."));
    } else {
      const merged: AgendaItem[] = [
        ...((events.data ?? []) as CalendarEvent[]).map((e) => ({ key: `e${e.id}`, kind: "event" as const, id: e.id, title: e.title, at: e.starts_at, event: e })),
        ...((tasks.data ?? []) as Array<{ id: string; title: string; due_at: string }>).map((x) => ({ key: `t${x.id}`, kind: "task" as const, id: x.id, title: x.title, at: x.due_at })),
        ...((reminders.data ?? []) as Array<{ id: string; message: string; remind_at: string }>).map((r) => ({ key: `r${r.id}`, kind: "reminder" as const, id: r.id, title: r.message, at: r.remind_at })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      setItems(merged);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  const removeEvent = async (ev: CalendarEvent) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("calendar_events").delete().eq("id", ev.id).eq("user_id", user.id);
    if (err) toast(friendlyError(err), "error");
    else await load();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <h1 className="text-xl font-semibold">Agenda</h1>
        {tab === "agenda" ? (
          <Button size="sm" onClick={() => setForm({ open: true })}>
            + Evento
          </Button>
        ) : null}
      </header>
      <div className="px-4 pb-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "agenda", label: "Próximos 30 dias" },
            { value: "lembretes", label: "Lembretes" },
          ]}
        />
      </div>

      {tab === "lembretes" ? (
        <RemindersList />
      ) : (
        <>
          <p className="px-4 pb-2 text-xs text-muted">Calendário interno do JARVIS. Google Calendar e Outlook ainda não estão conectados.</p>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loading />
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : items.length === 0 ? (
              <EmptyState title="Agenda livre" description="Nenhum evento, tarefa com data ou lembrete nos próximos 30 dias." />
            ) : (
              items.map((it) => (
                <Card key={it.key} className="anim-in flex items-center gap-3 !p-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px]">{it.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted">{formatWhen(it.at)}</span>
                      <Badge tone={it.kind === "task" ? "neutral" : "accent"}>{KIND_LABEL[it.kind]}</Badge>
                      {it.event?.location ? <span className="text-xs text-muted">📍 {it.event.location}</span> : null}
                      {it.event?.source === "agent" ? <Badge tone="accent">via JARVIS</Badge> : null}
                    </div>
                  </div>
                  {it.event ? (
                    <Dropdown
                      label="⋯"
                      items={[
                        { label: "Editar", onSelect: () => setForm({ open: true, item: it.event }) },
                        { label: "Excluir", danger: true, onSelect: () => setDeleting(it.event ?? null) },
                      ]}
                    />
                  ) : null}
                </Card>
              ))
            )}
          </div>
          <Modal open={form.open} title={form.item ? "Editar evento" : "Novo evento"} onClose={() => setForm({ open: false })}>
            {form.open ? <EventForm initial={form.item} onClose={() => setForm({ open: false })} onSaved={load} /> : null}
          </Modal>
          <ConfirmDialog
            open={deleting !== null}
            title="Excluir evento"
            message={`Excluir "${deleting?.title ?? ""}"? Essa ação não pode ser desfeita.`}
            confirmLabel="Excluir"
            onClose={() => setDeleting(null)}
            onConfirm={() => deleting && void removeEvent(deleting)}
          />
        </>
      )}
    </div>
  );
}
