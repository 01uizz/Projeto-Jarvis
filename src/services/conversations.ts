import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, MessageMetadata, Role } from "@/types";

export async function getOrCreateConversation(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;
  const created = await supabase.from("conversations").insert({ user_id: userId, title: "Conversa com o JARVIS" }).select("id").single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

export async function loadMessages(supabase: SupabaseClient, conversationId: string, limit = 100): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at, metadata")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function saveMessage(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  role: Role,
  content: string,
  metadata: MessageMetadata | null = null,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ user_id: userId, conversation_id: conversationId, role, content, metadata })
    .select("id, role, content, created_at, metadata")
    .single();
  if (error) throw error;
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);
  return data as ChatMessage;
}

export async function updateMessageMetadata(supabase: SupabaseClient, userId: string, messageId: string, metadata: MessageMetadata): Promise<void> {
  const { error } = await supabase.from("messages").update({ metadata }).eq("id", messageId).eq("user_id", userId);
  if (error) throw error;
}

export async function startNewConversation(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase.from("conversations").insert({ user_id: userId, title: "Nova conversa" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
