import type { SupabaseClient } from "@supabase/supabase-js";
import { logDeviceEvent } from "@/services/devices";
import type { Release } from "@/lib/releases";
import { detectCapabilities } from "./capabilities";
import { getDeviceIdentifier } from "./identity";

export interface AppInfo {
  versionName: string;
  versionCode: number;
}

export async function getAppInfo(): Promise<AppInfo> {
  const { App } = await import("@capacitor/app");
  const info = await App.getInfo();
  return { versionName: info.version, versionCode: Number(info.build) || 0 };
}

export interface Registration {
  deviceId: string;
  status: string;
  created: boolean;
  onboardingCompleted: boolean;
}

/** Registra (ou reconhece) este aparelho em `devices`. Aparelhos bloqueados/revogados não são reativados. */
export async function registerDevice(supabase: SupabaseClient, userId: string): Promise<Registration> {
  const identifier = await getDeviceIdentifier();
  const { Device } = await import("@capacitor/device");
  const info = await Device.getInfo();
  const app = await getAppInfo();
  const fields = {
    device_name: `${info.manufacturer ?? ""} ${info.model ?? ""}`.trim() || "Android",
    manufacturer: info.manufacturer ?? null,
    model: info.model ?? null,
    android_version: info.osVersion ?? null,
    app_version: app.versionName,
  };

  const { data: existing, error: selErr } = await supabase
    .from("devices")
    .select("id, status, onboarding_completed")
    .eq("user_id", userId)
    .eq("device_identifier", identifier)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing) {
    const status = String(existing.status ?? "offline");
    if (status === "blocked" || status === "revoked") {
      return { deviceId: String(existing.id), status, created: false, onboardingCompleted: Boolean(existing.onboarding_completed) };
    }
    const { error } = await supabase
      .from("devices")
      .update({ ...fields, status: "connecting", last_seen_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { deviceId: String(existing.id), status: "connecting", created: false, onboardingCompleted: Boolean(existing.onboarding_completed) };
  }

  const { data: created, error: insErr } = await supabase
    .from("devices")
    .insert({ user_id: userId, device_identifier: identifier, ...fields, status: "connecting", last_seen_at: new Date().toISOString(), core_connected: false, onboarding_completed: false })
    .select("id")
    .single();
  if (insErr || !created) throw insErr ?? new Error("O aparelho não foi registrado.");
  await logDeviceEvent(supabase, { userId, deviceId: String(created.id), type: "device_registered", metadata: { app_version: app.versionName } });
  return { deviceId: String(created.id), status: "connecting", created: true, onboardingCompleted: false };
}

/** Grava as capacidades detectadas. Registra capability_updated só quando algo mudou (sem dados sensíveis). */
export async function syncCapabilities(supabase: SupabaseClient, userId: string, deviceId: string): Promise<number> {
  const detected = await detectCapabilities();
  const { data: rows, error } = await supabase.from("device_capabilities").select("id, capability, available, permission_granted").eq("device_id", deviceId).eq("user_id", userId);
  if (error) throw error;
  type CapRow = { id: string; capability: string; available: boolean; permission_granted: boolean | null };
  const byKey = new Map(((rows ?? []) as CapRow[]).map((r): [string, CapRow] => [String(r.capability), r]));
  const changed: string[] = [];
  for (const c of detected) {
    const prev = byKey.get(c.capability);
    if (prev) {
      if (prev.available === c.available && prev.permission_granted === c.permission_granted) continue;
      const { error: upErr } = await supabase
        .from("device_capabilities")
        .update({ available: c.available, permission_granted: c.permission_granted, metadata: c.metadata })
        .eq("id", prev.id)
        .eq("user_id", userId);
      if (upErr) throw upErr;
      changed.push(c.capability);
    } else {
      const { error: insErr } = await supabase
        .from("device_capabilities")
        .insert({ user_id: userId, device_id: deviceId, capability: c.capability, available: c.available, permission_granted: c.permission_granted, metadata: c.metadata });
      if (insErr) throw insErr;
      changed.push(c.capability);
    }
  }
  if (changed.length) await logDeviceEvent(supabase, { userId, deviceId, type: "capability_updated", metadata: { capabilities: changed } });
  return detected.length;
}

/** Registra a instalação/versão em device_installations (uma linha por aparelho + version_code). */
export async function recordInstallation(supabase: SupabaseClient, userId: string, deviceId: string, app: AppInfo, release: Release | null): Promise<void> {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("device_installations")
    .select("id, version_code")
    .eq("device_id", deviceId)
    .eq("user_id", userId)
    .order("installed_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const current = (rows ?? []).find((r) => Number(r.version_code) === app.versionCode);
  if (current) {
    const { error: upErr } = await supabase.from("device_installations").update({ last_launch_at: now }).eq("id", current.id).eq("user_id", userId);
    if (upErr) throw upErr;
    return;
  }
  const matching = release && release.versionCode === app.versionCode ? release.id : null;
  const { error: insErr } = await supabase.from("device_installations").insert({
    user_id: userId,
    device_id: deviceId,
    app_release_id: matching,
    version_name: app.versionName,
    version_code: app.versionCode,
    installation_status: "installed",
    installation_source: "apk",
    installed_at: now,
    first_launch_at: now,
    last_launch_at: now,
  });
  if (insErr) throw insErr;
  const hadPrevious = (rows ?? []).length > 0;
  await logDeviceEvent(supabase, { userId, deviceId, type: hadPrevious ? "app_updated" : "first_launch", metadata: { version_name: app.versionName, version_code: app.versionCode } });
}

export async function markOnboardingStep(supabase: SupabaseClient, userId: string, deviceId: string, step: string, completed: boolean): Promise<void> {
  const { data: prev, error } = await supabase.from("device_onboarding").select("id").eq("device_id", deviceId).eq("user_id", userId).eq("step", step).maybeSingle();
  if (error) throw error;
  const row = { completed, completed_at: completed ? new Date().toISOString() : null };
  const res = prev
    ? await supabase.from("device_onboarding").update(row).eq("id", prev.id).eq("user_id", userId)
    : await supabase.from("device_onboarding").insert({ user_id: userId, device_id: deviceId, step, ...row });
  if (res.error) throw res.error;
}

export async function completeOnboarding(supabase: SupabaseClient, userId: string, deviceId: string): Promise<void> {
  const { error } = await supabase.from("devices").update({ onboarding_completed: true }).eq("id", deviceId).eq("user_id", userId);
  if (error) throw error;
  const { error: pErr } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
  if (pErr) console.error("[JARVIS] profiles.onboarding_completed", pErr.message);
  await logDeviceEvent(supabase, { userId, deviceId, type: "onboarding_completed" });
}
