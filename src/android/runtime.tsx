"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/Providers";
import { ConfirmDialog } from "@/components/ui";
import { coreClient } from "@/core/coreClient";
import { fetchReleasesWith } from "@/lib/releases";
import type { Release } from "@/lib/releases";
import { logDeviceEvent } from "@/services/devices";
import { CommandError, executeCommand } from "./commands";
import type { CommandRow } from "./commands";
import { isNativeAndroid } from "./platform";
import { getAppInfo, recordInstallation, registerDevice, syncCapabilities } from "./registration";
import type { AppInfo } from "./registration";
import { scheduleReminderNotifications } from "./reminders";

export type RuntimeStatus = "inactive" | "starting" | "online" | "connecting" | "offline" | "blocked" | "revoked" | "error";

export interface DeviceRuntimeState {
  native: boolean;
  status: RuntimeStatus;
  deviceId: string | null;
  coreConnected: boolean;
  realtimeConnected: boolean;
  onboardingCompleted: boolean | null;
  error: string | null;
  app: AppInfo | null;
  update: { release: Release; required: boolean } | null;
  refreshCapabilities: () => Promise<void>;
  markOnboardingDone: () => void;
  retry: () => void;
}

const noop = async () => {};
const Ctx = createContext<DeviceRuntimeState>({
  native: false,
  status: "inactive",
  deviceId: null,
  coreConnected: false,
  realtimeConnected: false,
  onboardingCompleted: null,
  error: null,
  app: null,
  update: null,
  refreshCapabilities: noop,
  markOnboardingDone: () => {},
  retry: () => {},
});
export const useDeviceRuntime = () => useContext(Ctx);

const HEARTBEAT_MS = 30_000;
const POLL_MS = 5_000;
const BACKOFF_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

interface PendingConfirm {
  cmd: CommandRow;
  resolve: (ok: boolean) => void;
}

export function DeviceRuntimeProvider({ children }: { children: ReactNode }) {
  const { supabase, user } = useAuth();
  const native = isNativeAndroid();
  const [status, setStatus] = useState<RuntimeStatus>(native ? "starting" : "inactive");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [coreConnected, setCoreConnected] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [app, setApp] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<{ release: Release; required: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const capsRefresh = useRef<() => Promise<void>>(noop);

  useEffect(() => {
    if (!native || !supabase || !user) return;
    let stopped = false;
    let channel: RealtimeChannel | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let backoffIndex = 0;
    let wasCoreConnected = false;
    let blocked = false;
    const userId = user.id;
    const handling = new Set<string>();

    const askConfirm = (cmd: CommandRow) => new Promise<boolean>((resolve) => setConfirm({ cmd, resolve }));

    const finish = async (devId: string, cmd: CommandRow, ok: boolean, started: number, payload: { result?: unknown; code?: string; message?: string }) => {
      const { error: rErr } = await supabase.from("device_command_results").insert({
        command_id: cmd.id,
        device_id: devId,
        success: ok,
        result: ok ? (payload.result ?? {}) : {},
        error_code: ok ? null : (payload.code ?? "error"),
        error_message: ok ? null : (payload.message ?? "Falha ao executar."),
        execution_time_ms: Date.now() - started,
      });
      if (rErr) console.error("[JARVIS] device_command_results", rErr.message);
      await supabase.from("device_commands").update({ status: ok ? "completed" : "failed" }).eq("id", cmd.id).eq("user_id", userId);
      await logDeviceEvent(supabase, { userId, deviceId: devId, type: ok ? "command_completed" : "command_failed", metadata: { command_type: cmd.command_type, ...(ok ? {} : { error_code: payload.code ?? "error" }) } });
    };

    const handleCommand = async (devId: string, cmd: CommandRow) => {
      if (blocked || handling.has(cmd.id)) return;
      handling.add(cmd.id);
      try {
        // "Reivindica" o comando: só quem muda pending → received executa (evita execução dupla Realtime + polling)
        const { data: claimed, error: cErr } = await supabase
          .from("device_commands")
          .update({ status: "received" })
          .eq("id", cmd.id)
          .eq("user_id", userId)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (cErr || !claimed) return;
        if (cmd.expires_at && new Date(cmd.expires_at).getTime() < Date.now()) {
          await supabase.from("device_commands").update({ status: "expired" }).eq("id", cmd.id).eq("user_id", userId);
          return;
        }
        await logDeviceEvent(supabase, { userId, deviceId: devId, type: "command_received", metadata: { command_type: cmd.command_type } });
        const started = Date.now();
        if (cmd.requires_confirmation) {
          await supabase.from("device_commands").update({ status: "requires_confirmation" }).eq("id", cmd.id).eq("user_id", userId);
          const ok = await askConfirm(cmd);
          if (!ok) {
            await supabase.from("device_commands").update({ status: "cancelled" }).eq("id", cmd.id).eq("user_id", userId);
            return;
          }
        }
        await supabase.from("device_commands").update({ status: "running" }).eq("id", cmd.id).eq("user_id", userId);
        try {
          const result = await executeCommand(cmd);
          await finish(devId, cmd, true, started, { result });
        } catch (e) {
          const code = e instanceof CommandError ? e.code : "execution_error";
          const message = e instanceof Error ? e.message : "Falha ao executar.";
          await finish(devId, cmd, false, started, { code, message });
        }
      } finally {
        handling.delete(cmd.id);
      }
    };

    const COMMAND_COLUMNS = "id, command_type, payload, status, requires_confirmation, expires_at";

    const pollPending = async (devId: string) => {
      const { data } = await supabase
        .from("device_commands")
        .select(COMMAND_COLUMNS)
        .eq("device_id", devId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);
      for (const row of (data ?? []) as CommandRow[]) await handleCommand(devId, row);
    };

    const subscribe = (devId: string) => {
      if (stopped) return;
      if (channel) void supabase.removeChannel(channel);
      channel = supabase
        .channel(`device-commands-${devId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "device_commands", filter: `device_id=eq.${devId}` }, (payload) => {
          void handleCommand(devId, payload.new as CommandRow);
        })
        .subscribe((s) => {
          if (stopped) return;
          if (s === "SUBSCRIBED") {
            backoffIndex = 0;
            setRealtimeConnected(true);
            void pollPending(devId); // pega o que chegou enquanto estava desconectado
            return;
          }
          if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            setRealtimeConnected(false);
            if (reconnect) clearTimeout(reconnect);
            const wait = BACKOFF_MS[Math.min(backoffIndex++, BACKOFF_MS.length - 1)];
            reconnect = setTimeout(() => subscribe(devId), wait);
          }
        });
    };

    const beat = async (devId: string, app: AppInfo) => {
      const { data: row } = await supabase.from("devices").select("status").eq("id", devId).eq("user_id", userId).maybeSingle();
      const current = String(row?.status ?? "");
      if (current === "blocked" || current === "revoked") {
        blocked = true;
        setStatus(current);
        setCoreConnected(false);
        if (channel) void supabase.removeChannel(channel);
        return;
      }
      let core = false;
      try {
        core = (await coreClient.ping(supabase)).ok;
      } catch {
        core = false;
      }
      if (stopped) return;
      setCoreConnected(core);
      const next: RuntimeStatus = core ? "online" : "connecting";
      setStatus(next);
      await supabase
        .from("devices")
        .update({ status: core ? "online" : "connecting", core_connected: core, last_seen_at: new Date().toISOString(), app_version: app.versionName })
        .eq("id", devId)
        .eq("user_id", userId);
      if (core !== wasCoreConnected) {
        wasCoreConnected = core;
        await logDeviceEvent(supabase, { userId, deviceId: devId, type: core ? "core_connected" : "core_disconnected" });
      }
    };

    const goOffline = () => {
      if (!deviceIdRef.current || blocked) return;
      void supabase.from("devices").update({ status: "offline", core_connected: false }).eq("id", deviceIdRef.current).eq("user_id", userId);
    };

    const deviceIdRef = { current: null as string | null };

    const start = async () => {
      setStatus("starting");
      setError(null);
      try {
        const appInfo = await getAppInfo();
        setApp(appInfo);
        const reg = await registerDevice(supabase, userId);
        if (stopped) return;
        deviceIdRef.current = reg.deviceId;
        setDeviceId(reg.deviceId);
        setOnboardingCompleted(reg.onboardingCompleted);
        try {
          if (window.sessionStorage.getItem("jarvis.just_logged_in") === "1") {
            window.sessionStorage.removeItem("jarvis.just_logged_in");
            await logDeviceEvent(supabase, { userId, deviceId: reg.deviceId, type: "login" });
          }
        } catch {
          /* sessionStorage indisponível: sem evento de login */
        }
        await logDeviceEvent(supabase, { userId, deviceId: reg.deviceId, type: "app_started", metadata: { version_code: appInfo.versionCode } });
        if (reg.status === "blocked" || reg.status === "revoked") {
          blocked = true;
          setStatus(reg.status);
          return;
        }

        // Atualização: compara com app_releases (is_required → bloqueia o uso até atualizar)
        const { releases } = await fetchReleasesWith(supabase, 1);
        const latest = releases[0] ?? null;
        await recordInstallation(supabase, userId, reg.deviceId, appInfo, latest);
        if (latest && latest.versionCode !== null && latest.versionCode > appInfo.versionCode) setUpdate({ release: latest, required: latest.isRequired });
        else setUpdate(null);

        capsRefresh.current = async () => {
          await syncCapabilities(supabase, userId, reg.deviceId);
        };
        await syncCapabilities(supabase, userId, reg.deviceId);

        await beat(reg.deviceId, appInfo);
        subscribe(reg.deviceId);
        heartbeat = setInterval(() => void beat(reg.deviceId, appInfo), HEARTBEAT_MS);
        poll = setInterval(() => void pollPending(reg.deviceId), POLL_MS);
        void scheduleReminderNotifications(supabase, userId);
      } catch (e) {
        console.error("[JARVIS] device runtime", e);
        if (stopped) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Não foi possível registrar este aparelho.");
      }
    };

    void start();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") goOffline();
      else if (deviceIdRef.current) {
        void capsRefresh.current(); // permissões podem ter mudado nas configurações do Android
        subscribe(deviceIdRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", goOffline);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", goOffline);
      if (heartbeat) clearInterval(heartbeat);
      if (poll) clearInterval(poll);
      if (reconnect) clearTimeout(reconnect);
      if (channel) void supabase.removeChannel(channel);
      goOffline();
    };
  }, [native, supabase, user, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const refreshCapabilities = useCallback(() => capsRefresh.current(), []);
  const markOnboardingDone = useCallback(() => setOnboardingCompleted(true), []);

  return (
    <Ctx.Provider value={{ native, status, deviceId, coreConnected, realtimeConnected, onboardingCompleted, error, app, update, refreshCapabilities, markOnboardingDone, retry }}>
      {children}
      <ConfirmDialog
        open={confirm !== null}
        title="O JARVIS quer executar uma ação neste aparelho"
        message={confirm ? `Comando: ${confirm.cmd.command_type}. Deseja permitir?` : ""}
        confirmLabel="Permitir"
        onConfirm={() => {
          confirm?.resolve(true);
          setConfirm(null);
        }}
        onClose={() => {
          confirm?.resolve(false);
          setConfirm(null);
        }}
      />
    </Ctx.Provider>
  );
}
