import type { ToolDefinition } from "@/features/agent/types";
import { deviceGetLocation, deviceNotify, deviceOpenApp, deviceStatus } from "./device";
import { calendarCreate, calendarDelete, calendarRead, calendarUpdate } from "./calendar";
import { memorySave, memorySearch } from "./memory";
import { notificationsRead } from "./notifications";
import { createReminder, deleteReminder, updateReminder } from "./reminders";
import { createTask, deleteTask, listTasks, updateTask } from "./tasks";
import { emailSend, messageSend, paymentExecute, webSearch } from "./unavailable";

/** Para adicionar uma função nova, crie a ferramenta e registre-a aqui. */
const ALL_TOOLS: ToolDefinition[] = [
  createTask,
  listTasks,
  updateTask,
  deleteTask,
  createReminder,
  updateReminder,
  deleteReminder,
  memorySave,
  memorySearch,
  calendarRead,
  calendarCreate,
  calendarUpdate,
  calendarDelete,
  notificationsRead,
  deviceOpenApp,
  deviceGetLocation,
  deviceNotify,
  deviceStatus,
  webSearch,
  emailSend,
  messageSend,
  paymentExecute,
];

export const toolRegistry: Record<string, ToolDefinition> = Object.fromEntries(ALL_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry[name];
}

export function listTools(): ToolDefinition[] {
  return ALL_TOOLS;
}
