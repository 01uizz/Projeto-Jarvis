import type { ToolDefinition } from "@/features/agent/types";
import { calendarRead } from "./calendar";
import { memorySave, memorySearch } from "./memory";
import { createReminder } from "./reminders";
import { createTask, listTasks } from "./tasks";
import { emailSend, messageSend, paymentExecute, webSearch } from "./unavailable";

/** Para adicionar uma função nova (ex.: update_task), crie a ferramenta e registre aqui. */
const ALL_TOOLS: ToolDefinition[] = [
  createTask,
  listTasks,
  createReminder,
  memorySave,
  memorySearch,
  calendarRead,
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
