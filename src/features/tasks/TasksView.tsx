"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Badge, Button, Card, Checkbox, ConfirmDialog, Dropdown, EmptyState, ErrorState, Input, Loading, Modal, Select, Tabs, useToast } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import type { Task, TaskPriority } from "@/types";
import { formatWhen } from "@/utils/datetime";
import { useTasks } from "./useTasks";
import type { TaskInput } from "./useTasks";

type Filter = "pending" | "done" | "all";
const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Baixa", medium: "Média", high: "Alta" };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TaskForm({ initial, onSubmit, onClose }: { initial?: Task; onSubmit: (v: TaskInput) => Promise<void>; onClose: () => void }) {
  const [category, setCategory] = useState(initial?.category ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [due, setDue] = useState(toLocalInput(initial?.due_at ?? null));
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), due_at: due ? new Date(due).toISOString() : null, priority, category: category.trim() || null });
      onClose();
    } catch (err) {
      toast(friendlyError(err, "Não foi possível salvar essa tarefa. Tente novamente."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Tarefa" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Estudar para prova" required autoFocus />
      <Input label="Data e horário (opcional)" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      <Input label="Categoria (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Estudos, Casa, Trabalho…" />
      <Select label="Prioridade" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
        <option value="low">Baixa</option>
        <option value="medium">Média</option>
        <option value="high">Alta</option>
      </Select>
      <Button type="submit" className="w-full" loading={busy}>
        Salvar
      </Button>
    </form>
  );
}

export function TasksView() {
  const { tasks, loading, error, reload, add, update, remove } = useTasks();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("pending");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const visible = tasks.filter((t) => (filter === "all" ? true : t.status === filter));

  const toggle = async (t: Task) => {
    try {
      await update(t.id, { status: t.status === "done" ? "pending" : "done" });
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          + Nova
        </Button>
      </header>
      <div className="px-4 pb-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: "pending", label: "Pendentes" },
            { value: "done", label: "Concluídas" },
            { value: "all", label: "Todas" },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loading />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : visible.length === 0 ? (
          <EmptyState title="Nenhuma tarefa aqui" description="Crie uma tarefa pelo botão acima ou peça ao JARVIS no chat." />
        ) : (
          visible.map((t) => (
            <Card key={t.id} className="anim-in flex items-center gap-3 !p-3">
              <Checkbox checked={t.status === "done"} onChange={() => toggle(t)} label={`Concluir ${t.title}`} />
              <div className="min-w-0 flex-1">
                <p className={`break-words text-[15px] ${t.status === "done" ? "text-muted line-through" : ""}`}>{t.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {t.due_at ? <span className="text-xs text-muted">{formatWhen(t.due_at)}</span> : null}
                  <Badge tone={t.priority === "high" ? "danger" : t.priority === "medium" ? "accent" : "neutral"}>{PRIORITY_LABEL[t.priority] ?? t.priority}</Badge>
                  {t.category ? <Badge>{t.category}</Badge> : null}
                  {t.source === "agent" ? <Badge tone="accent">via JARVIS</Badge> : null}
                </div>
              </div>
              <Dropdown
                label="⋯"
                items={[
                  { label: "Editar", onSelect: () => setEditing(t) },
                  { label: "Excluir", danger: true, onSelect: () => setDeleting(t) },
                ]}
              />
            </Card>
          ))
        )}
      </div>

      <Modal open={creating} title="Nova tarefa" onClose={() => setCreating(false)}>
        <TaskForm onSubmit={add} onClose={() => setCreating(false)} />
      </Modal>
      <Modal open={editing !== null} title="Editar tarefa" onClose={() => setEditing(null)}>
        {editing ? <TaskForm initial={editing} onSubmit={(v) => update(editing.id, v)} onClose={() => setEditing(null)} /> : null}
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir tarefa"
        message={`Excluir "${deleting?.title ?? ""}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove(deleting.id);
          } catch (e) {
            toast(friendlyError(e), "error");
          }
        }}
      />
    </div>
  );
}
