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

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
}

export interface Reminder {
  id: string;
  message: string;
  remind_at: string;
  status: "pending" | "sent" | "cancelled";
  created_at: string;
}

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
}

export type AccentColor = "red" | "blue" | "pink" | "orange" | "yellow";
export type ThemeMode = "dark" | "light" | "system";
export type AutonomyLevel = 0 | 1 | 2 | 3;
