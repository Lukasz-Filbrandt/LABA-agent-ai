"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { formatRelativeDate, formatTime } from "@/app/lib/format-relative-date";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  title: string | null;
  updatedAt: string;
};

export default function HistoryConversationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [conversation, setConversation] = useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);

  const load = useCallback(async () => {
    const [{ data: conversationRow }, { data: messageRows }] = await Promise.all([
      supabase.from("conversations").select("id, title, updated_at").eq("id", id).maybeSingle(),
      supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (!conversationRow) {
      setConversation(null);
      return;
    }

    setConversation({
      id: String(conversationRow.id),
      title: conversationRow.title,
      updatedAt: conversationRow.updated_at,
    });
    setMessages(
      (messageRows ?? []).map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      }))
    );
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (conversation === undefined) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Wczytuję rozmowę...</p>
      </main>
    );
  }

  if (conversation === null) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          Nie znaleziono tej rozmowy — mogła zostać usunięta.
        </p>
        <Link href="/history" className="btn btn-ghost" style={{ padding: "8px 16px", borderRadius: 8, display: "inline-block" }}>
          ← Wróć do listy
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Link href="/history" className="btn btn-ghost" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13 }}>
          ← Wróć do listy
        </Link>
        <Link
          href={`/chat?continueId=${conversation.id}`}
          className="btn btn-primary"
          style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13 }}
        >
          🔄 Kontynuuj rozmowę
        </Link>
      </div>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>{conversation.title || "(bez tytułu)"}</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Ostatnia aktywność: {formatRelativeDate(conversation.updatedAt)}
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: isUser ? "var(--color-primary)" : "var(--color-primary-light)",
                  color: isUser ? "var(--color-on-primary)" : "var(--color-text)",
                  border: isUser ? "none" : "1px solid var(--color-border)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                {isUser ? "Ty" : "Agent"} · {formatTime(m.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
