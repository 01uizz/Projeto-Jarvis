"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { friendlyError } from "@/lib/errors";
import type { Task, TaskPriority } from "@/types";

export function useTasks() {
  const { supabase, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("tasks")
      .select("id, title, description, due_at, priority, status, created_at")
      .eq("user_id", user.id)
      .order("status", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (err) setError(friendlyError(err, "Não foi possível carregar as tarefas."));
    else setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = async (input: { title: string; due_at: string | null; priority: TaskPriority }) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("tasks").insert({ user_id: user.id, status: "pending", ...input });
    if (err) throw err;
    await reload();
  };

  const update = async (id: string, patch: Partial<Pick<Task, "title" | "due_at" | "priority" | "status">>) => {
    if (!supabase || !user) return;
    const extra = patch.status === "done" ? { completed_at: new Date().toISOString() } : patch.status === "pending" ? { completed_at: null } : {};
    const { error: err } = await supabase
      .from("tasks")
      .update({ ...patch, ...extra, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (err) throw err;
    await reload();
  };

  const remove = async (id: string) => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id);
    if (err) throw err;
    await reload();
  };

  return { tasks, loading, error, reload, add, update, remove };
}
