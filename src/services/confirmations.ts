import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolParams } from "@/features/agent/types";

export interface StoredConfirmation {
  id: string;
  tool: string;
  params: ToolParams;
  summary: string;
  status: "pending" | "confirmed" | "cancelled";
}

export async function createConfirmation(
  supabase: SupabaseClient,
  userId: string,
  tool: string,
  params: ToolParams,
  summary: string,
): Promise<StoredConfirmation> {
  const { data, error } = await supabase
    .from("action_confirmations")
    .insert({ user_id: userId, tool, params, summary, status: "pending" })
    .select("id, tool, params, summary, status")
    .single();
  if (error) throw error;
  return data as StoredConfirmation;
}

export async function getConfirmation(supabase: SupabaseClient, userId: string, id: string): Promise<StoredConfirmation | null> {
  const { data, error } = await supabase
    .from("action_confirmations")
    .select("id, tool, params, summary, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as StoredConfirmation | null) ?? null;
}

export async function resolveConfirmation(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  status: "confirmed" | "cancelled",
): Promise<void> {
  const { error } = await supabase
    .from("action_confirmations")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw error;
}
