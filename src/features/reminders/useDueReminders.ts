"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/Providers";
import { useToast } from "@/components/ui";

/**
 * Verifica lembretes vencidos enquanto o app está aberto e os mostra dentro do app.
 * Limitação: sem push notifications, nada é entregue com o app fechado.
 */
export function useDueReminders() {
  const { supabase, user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (!supabase || !user) return;
    let stopped = false;

    const check = async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("id, message")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .lte("remind_at", new Date().toISOString())
        .limit(10);
      if (error || !data || stopped) return;
      for (const r of data) {
        const { error: upErr } = await supabase.from("reminders").update({ status: "sent" }).eq("id", r.id).eq("user_id", user.id).eq("status", "pending");
        if (upErr) continue;
        toast(`⏰ ${r.message}`, "info");
        await supabase.from("notifications").insert({ user_id: user.id, title: "Lembrete", body: r.message, kind: "lembrete" });
      }
    };

    check();
    const timer = setInterval(check, 30_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [supabase, user, toast]);
}
