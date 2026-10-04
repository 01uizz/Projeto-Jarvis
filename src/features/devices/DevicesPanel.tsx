"use client";

import { useCallback, useEffect, useState } from "react";
import { useDeviceRuntime } from "@/android/runtime";
import { requestCapabilityPermission } from "@/android/capabilities";
import type { RequestableCapability } from "@/android/capabilities";
import { useAuth } from "@/components/Providers";
import { Badge, Button, Card, EmptyState, ErrorState, Loading, useToast } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { isFresh, listCapabilities, listDevices } from "@/services/devices";
import type { Capability, Device } from "@/services/devices";
import { formatWhen } from "@/utils/datetime";

const TONE: Record<string, "success" | "danger" | "neutral" | "accent"> = { online: "success", connecting: "accent", offline: "neutral", blocked: "danger", revoked: "danger" };
const STATUS_LABEL: Record<string, string> = { online: "online", connecting: "conectando", offline: "offline", blocked: "bloqueado", revoked: "revogado" };
const REQUESTABLE: Record<string, RequestableCapability> = { microphone: "microphone", speech_recognition: "microphone", notifications: "notifications", location: "location" };

export function DevicesPanel() {
  const { supabase, user } = useAuth();
  const rt = useDeviceRuntime();
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [caps, setCaps] = useState<Record<string, Capability[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const list = await listDevices(supabase, user.id);
      setDevices(list);
      const entries = await Promise.all(list.map(async (d) => [d.id, await listCapabilities(supabase, user.id, d.id)] as const));
      setCaps(Object.fromEntries(entries));
      setError(null);
    } catch (e) {
      setError(friendlyError(e, "Não foi possível carregar os dispositivos."));
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (d: Device, status: "blocked" | "revoked" | "offline") => {
    if (!supabase || !user) return;
    const { error: err } = await supabase.from("devices").update({ status }).eq("id", d.id).eq("user_id", user.id);
    if (err) toast(friendlyError(err), "error");
    else await load();
  };

  const grant = async (key: string) => {
    const cap = REQUESTABLE[key];
    if (!cap) return;
    const ok = await requestCapabilityPermission(cap);
    toast(ok ? "Permissão concedida." : "Permissão negada no Android.", ok ? "success" : "error");
    await rt.refreshCapabilities();
    await load();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (devices.length === 0) return <EmptyState title="Nenhum aparelho registrado" description="Instale o aplicativo Android e entre com a sua conta: o aparelho aparece aqui." />;

  return (
    <div className="space-y-3">
      {devices.map((d) => {
        const stale = d.status === "online" && !isFresh(d.last_seen_at);
        const shown = stale ? "offline" : d.status;
        const mine = d.id === rt.deviceId;
        return (
          <Card key={d.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {d.device_name ?? "Aparelho"} {mine ? <span className="text-xs text-accent">(este)</span> : null}
                </p>
                <p className="text-xs text-muted">
                  Android {d.android_version ?? "?"} · app {d.app_version ?? "?"} · visto {d.last_seen_at ? formatWhen(d.last_seen_at) : "nunca"}
                </p>
              </div>
              <Badge tone={TONE[shown] ?? "neutral"}>{STATUS_LABEL[shown] ?? shown}</Badge>
            </div>
            <p className="text-xs text-muted">Core: {d.core_connected && !stale ? "conectado" : "desconectado"}</p>
            <div className="flex flex-wrap gap-1.5">
              {(caps[d.id] ?? []).map((c) => {
                const ready = c.available && c.permission_granted === true;
                const reason = c.metadata && typeof c.metadata.reason === "string" ? c.metadata.reason : undefined;
                const label = ready ? "pronto" : !c.available ? "indisponível" : "sem permissão";
                return (
                  <span key={c.capability} title={reason}>
                    <Badge tone={ready ? "success" : c.available ? "accent" : "neutral"}>
                      {c.capability} · {label}
                    </Badge>
                    {mine && c.available && !ready && REQUESTABLE[c.capability] ? (
                      <button className="ml-1 text-xs text-accent underline" onClick={() => void grant(c.capability)}>
                        permitir
                      </button>
                    ) : null}
                  </span>
                );
              })}
              {(caps[d.id] ?? []).length === 0 ? <span className="text-xs text-muted">Capacidades ainda não informadas pelo aparelho.</span> : null}
            </div>
            {!mine ? (
              <div className="flex gap-2">
                {d.status === "blocked" ? (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(d, "offline")}>
                    Desbloquear
                  </Button>
                ) : d.status !== "revoked" ? (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(d, "blocked")}>
                    Bloquear
                  </Button>
                ) : null}
                {d.status !== "revoked" ? (
                  <Button size="sm" variant="danger" onClick={() => setStatus(d, "revoked")}>
                    Revogar
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
