"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { formatRelativeDate } from "@/app/lib/format-relative-date";

type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string | null;
};

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });

    if (error || !rows) {
      console.error("Nie udało się wczytać historii rozmów:", error);
      setConversations([]);
      return;
    }

    const ids = rows.map((r) => r.id);
    const messagesByConversation = new Map<string, { content: string }[]>();

    if (ids.length > 0) {
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id, content")
        .in("conversation_id", ids)
        .order("created_at", { ascending: true });

      for (const m of messages ?? []) {
        const key = String(m.conversation_id);
        const list = messagesByConversation.get(key) ?? [];
        list.push({ content: m.content });
        messagesByConversation.set(key, list);
      }
    }

    setConversations(
      rows.map((r) => {
        const msgs = messagesByConversation.get(String(r.id)) ?? [];
        const last = msgs[msgs.length - 1];
        return {
          id: String(r.id),
          title: r.title,
          updatedAt: r.updated_at,
          messageCount: msgs.length,
          lastMessagePreview: last ? truncate(last.content, 100) : null,
        };
      })
    );
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDelete = async (id: string, title: string | null) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć rozmowę "${title || "(bez tytułu)"}"? Tej operacji nie można cofnąć.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await supabase.from("messages").delete().eq("conversation_id", id);
      const { error } = await supabase.from("conversations").delete().eq("id", id);
      if (error) throw error;

      setConversations((prev) => (prev ?? []).filter((c) => c.id !== id));
      showToast("Rozmowa usunięta");
    } catch (err) {
      console.error("Nie udało się usunąć rozmowy:", err);
      showToast("Nie udało się usunąć rozmowy");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>📜 Historia rozmów</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wszystkie Twoje rozmowy z agentem
        </p>
      </header>

      {conversations === null && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Wczytuję rozmowy...</p>
      )}

      {conversations !== null && conversations.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            border: "1px dashed var(--color-border)",
            borderRadius: 12,
            color: "var(--color-text-muted)",
          }}
        >
          <p style={{ marginBottom: 16 }}>Nie masz jeszcze żadnych rozmów. Zacznij nową!</p>
          <Link href="/chat" className="btn btn-primary" style={{ padding: "10px 20px", borderRadius: 8, display: "inline-block" }}>
            Rozpocznij rozmowę
          </Link>
        </div>
      )}

      {conversations !== null && conversations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {conversations.map((c) => (
            <div key={c.id} className="history-card">
              <Link href={`/history/${c.id}`} className="history-card-link">
                <div style={{ fontWeight: 700, color: "var(--color-text)" }}>
                  {c.title || "(bez tytułu)"}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  {formatRelativeDate(c.updatedAt)} · {c.messageCount}{" "}
                  {c.messageCount === 1 ? "wiadomość" : "wiadomości"}
                </div>
                {c.lastMessagePreview && (
                  <div
                    style={{
                      fontSize: 13,
                      fontStyle: "italic",
                      color: "var(--color-text-muted)",
                      marginTop: 6,
                    }}
                  >
                    {c.lastMessagePreview}
                  </div>
                )}
              </Link>
              <button
                type="button"
                className="btn btn-danger-ghost"
                onClick={() => handleDelete(c.id, c.title)}
                disabled={deletingId === c.id}
                aria-label="Usuń rozmowę"
                style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, flexShrink: 0 }}
              >
                🗑️ Usuń
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--color-text)",
            color: "var(--color-bg)",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            zIndex: 100,
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
