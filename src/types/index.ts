export type Role = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  created_at: string;
  metadata?: MessageMetadata | null;
}

export interface MessageMetadata {
  actions?: ActionSummary[];
  confirmation?: PendingConfirmation | null;
}

export type ActionStatus = "success" | "error" | "unavailable" | "denied" | "pending_confirmation" | "cancelled";

export interface ActionSummary {
  tool: string;
  status: ActionStatus;
  summary: string;
}

export interface PendingConfirmation {
  id: string;
  tool: string;
  summary: string;
  status: "pending" | "confirmed" | "cancelled";
}

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "done";
export type RecordSource = "manual" | "agent";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  category: string | null;
  source: RecordSource | null;
  created_at: string;
}

export type ReminderStatus = "pending" | "sent" | "cancelled";

export interface Reminder {
  id: string;
  message: string;
  remind_at: string;
  status: ReminderStatus;
  source: RecordSource | null;
  created_at: string;
}

export const MEMORY_TYPES = ["preferência", "informação pessoal", "objetivo", "contexto", "hábito", "informação temporária"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface Memory {
  id: string;
  content: string;
  category: string | null;
  source: string | null;
  confidence: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  location: string | null;
  source: RecordSource | null;
}

export const NOTIFICATION_KINDS = ["tarefa", "lembrete", "evento", "sistema", "segurança", "integração", "ação do agente"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  kind: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  onboarding_completed: boolean | null;
}

export type AccentColor = "red" | "blue" | "pink" | "orange" | "yellow";
export type ThemeMode = "dark" | "light" | "system";
export type AutonomyLevel = 0 | 1 | 2 | 3;
