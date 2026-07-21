"use client";

import { useCallback, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { supabase } from "@/app/lib/supabase";

type Role = "user" | "assistant";

function toUIMessage(row: { id: string; role: string; content: string }): UIMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text", text: row.content }],
  };
}

function titleFromText(text: string) {
  const trimmed = text.trim();
  return trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed;
}

/** Zapisuje i wczytuje rozmowę z Supabase (tabele conversations/messages), izolowane per user_id — patrz W2_HISTORIA.md/W3_LOGIN_PRYWATNOSC.md */
export function useConversationPersistence(enabled: boolean, userId: string | null) {
  const conversationIdRef = useRef<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(enabled);

  /**
   * Wczytuje wskazaną rozmowę (np. "Kontynuuj rozmowę" z /history) albo, gdy nie podano id,
   * najnowszą aktywną (patrz W2_HISTORIA.md).
   */
  const loadConversation = useCallback(
    async (conversationId?: string): Promise<UIMessage[]> => {
      if (!enabled || !userId) return [];
      try {
        let targetId = conversationId ?? null;

        if (!targetId) {
          const { data: conversation } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!conversation) return [];
          targetId = String(conversation.id);
        }

        const { data: rows } = await supabase
          .from("messages")
          .select("id, role, content")
          .eq("conversation_id", targetId)
          .order("created_at", { ascending: true });

        conversationIdRef.current = targetId;
        return (rows ?? []).map(toUIMessage);
      } catch (err) {
        console.error("Nie udało się wczytać historii rozmowy:", err);
        return [];
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [enabled, userId]
  );

  const saveUserMessage = useCallback(
    async (text: string) => {
      if (!enabled || !userId) return;
      try {
        let conversationId = conversationIdRef.current;
        if (!conversationId) {
          const { data, error } = await supabase
            .from("conversations")
            .insert({ title: titleFromText(text), user_id: userId })
            .select("id")
            .single();
          if (error || !data) throw error;
          conversationId = data.id;
          conversationIdRef.current = conversationId;
        }
        const { error: messageError } = await supabase
          .from("messages")
          .insert({ conversation_id: conversationId, role: "user" as Role, content: text });
        if (messageError) throw messageError;
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch (err) {
        console.error("Nie udało się zapisać wiadomości użytkownika:", err);
      }
    },
    [enabled, userId]
  );

  const saveAssistantMessage = useCallback(
    async (text: string) => {
      const conversationId = conversationIdRef.current;
      if (!enabled || !conversationId) return;
      try {
        const { error: messageError } = await supabase
          .from("messages")
          .insert({ conversation_id: conversationId, role: "assistant" as Role, content: text });
        if (messageError) throw messageError;
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch (err) {
        console.error("Nie udało się zapisać odpowiedzi agenta:", err);
      }
    },
    [enabled]
  );

  const startNewConversation = useCallback(() => {
    conversationIdRef.current = null;
  }, []);

  return {
    isLoadingHistory,
    loadConversation,
    saveUserMessage,
    saveAssistantMessage,
    startNewConversation,
  };
}
