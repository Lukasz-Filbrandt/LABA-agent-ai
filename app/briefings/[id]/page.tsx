"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/app/lib/supabase";
import { formatBriefingDate } from "@/app/lib/briefing-format";

type Briefing = {
  id: string;
  content: string;
  date: string;
  isFromCron: boolean;
};

export default function BriefingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [briefing, setBriefing] = useState<Briefing | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("briefings")
      .select("id, content, date, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!data) {
      setBriefing(null);
      return;
    }

    setBriefing({
      id: String(data.id),
      content: data.content,
      date: data.date,
      isFromCron: data.user_id === null,
    });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopy = async () => {
    if (!briefing) return;
    try {
      await navigator.clipboard.writeText(briefing.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Nie udało się skopiować briefingu:", err);
    }
  };

  if (briefing === undefined) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Wczytuję briefing...</p>
      </main>
    );
  }

  if (briefing === null) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
          Nie znaleziono tego briefingu — mógł zostać usunięty.
        </p>
        <Link
          href="/briefings"
          className="btn btn-ghost"
          style={{ padding: "8px 16px", borderRadius: 8, display: "inline-block" }}
        >
          ← Wróć do listy
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Link
          href="/briefings"
          className="btn btn-ghost"
          style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13 }}
        >
          ← Wróć do listy
        </Link>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleCopy}
          style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13 }}
        >
          {copied ? "✅ Skopiowano" : "📋 Kopiuj"}
        </button>
      </div>

      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>{formatBriefingDate(briefing.date)}</h1>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
          {briefing.isFromCron
            ? "✅ wygenerowany automatycznie (z cron)"
            : "👤 wygenerowany ręcznie"}
        </p>
      </header>

      <div
        style={{
          padding: "20px 24px",
          borderRadius: 12,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.content}</ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
