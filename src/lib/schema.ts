/**
 * Estrutura ESPERADA das tabelas do Android/Core que já existem no Supabase.
 *
 * O prompt do projeto define os NOMES das tabelas e de alguns campos (ex.: device_command_results:
 * command_id, device_id, success, result, error_code, error_message, execution_time_ms), mas não a
 * lista completa de colunas das demais. Os nomes marcados como ASSUMIDO abaixo foram deduzidos do
 * prompt. Eles ficam TODOS aqui, num único lugar, e o Diagnóstico (Mais → Diagnóstico) confere cada um
 * no banco real. Se algum não existir, o app mostra exatamente qual tabela/coluna falta, e NADA é
 * alterado no banco automaticamente. Corrija este arquivo (nome real) ou adicione a coluna no Supabase.
 */
export const DEVICE_SCHEMA = {
  devices: {
    // ASSUMIDO: id, user_id, device_name, manufacturer, model, android_version, app_version, device_identifier,
    // status (online|offline|connecting|blocked|revoked), last_seen_at, core_connected, onboarding_completed
    columns: ["id", "user_id", "device_name", "manufacturer", "model", "android_version", "app_version", "device_identifier", "status", "last_seen_at", "core_connected", "onboarding_completed"],
  },
  device_capabilities: {
    // ASSUMIDO: capability (chave: microphone, notifications…), available, permission_granted, metadata
    columns: ["id", "device_id", "user_id", "capability", "available", "permission_granted", "metadata"],
  },
  device_commands: {
    // ASSUMIDO: command_type, payload, status, requires_confirmation, expires_at
    columns: ["id", "user_id", "device_id", "command_type", "payload", "status", "requires_confirmation", "expires_at", "created_at"],
  },
  device_command_results: {
    // Definido no prompt
    columns: ["id", "command_id", "device_id", "success", "result", "error_code", "error_message", "execution_time_ms"],
  },
  device_events: {
    // ASSUMIDO: event_type, metadata
    columns: ["id", "user_id", "device_id", "event_type", "metadata", "created_at"],
  },
  device_installations: {
    // ASSUMIDO (campos listados no prompt): app_release_id, version_name, version_code, installation_status, installation_source, installed_at, first_launch_at, last_launch_at
    columns: ["id", "user_id", "device_id", "app_release_id", "version_name", "version_code", "installation_status", "installation_source", "installed_at", "first_launch_at", "last_launch_at"],
  },
  device_onboarding: {
    // ASSUMIDO: step, completed, completed_at
    columns: ["id", "user_id", "device_id", "step", "completed", "completed_at"],
  },
  device_push_tokens: {
    // ASSUMIDO: token, platform
    columns: ["id", "user_id", "device_id", "token", "platform"],
  },
  app_releases: {
    // Lido com select("*") e normalizado (src/lib/releases.ts); aqui só a conferência básica.
    columns: ["id", "version_code", "is_required"],
  },
} as const;

export type DeviceTable = keyof typeof DEVICE_SCHEMA;

/** Estados de dispositivo e de comando definidos no prompt. */
export const DEVICE_STATUSES = ["online", "offline", "connecting", "blocked", "revoked"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const COMMAND_STATUSES = ["pending", "sent", "received", "running", "completed", "failed", "cancelled", "expired", "requires_confirmation"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const CAPABILITY_KEYS = [
  "android_device",
  "microphone",
  "speech_recognition",
  "text_to_speech",
  "notifications",
  "location",
  "files",
  "contacts",
  "calendar",
  "app_launch",
  "background_tasks",
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const DEVICE_EVENT_TYPES = [
  "first_launch",
  "login",
  "onboarding_started",
  "onboarding_completed",
  "permission_granted",
  "permission_denied",
  "device_registered",
  "capability_updated",
  "core_connected",
  "core_disconnected",
  "app_updated",
  "app_started",
  "command_received",
  "command_completed",
  "command_failed",
] as const;
export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];
