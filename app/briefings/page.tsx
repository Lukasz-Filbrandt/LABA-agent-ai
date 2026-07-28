"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth-context";
import { formatBriefingDate, toPlainPreview } from "@/app/lib/briefing-format";

type Briefing = {
  id: string;
  content: string;
  date: string;
  createdAt: string;
  isFromCron: boolean;
};

export default function BriefingsPage() {
  const { getAccessToken } = useAuth();
  const [briefings, setBriefings] = useState<Briefing[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("briefings")
      .select("id, content, date, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) {
      console.error("Nie udało się wczytać briefingów:", error);
      setBriefings([]);
      return;
    }

    setBriefings(
      data.map((b) => ({
        id: String(b.id),
        content: b.content,
        date: b.date,
        createdAt: b.created_at,
        isFromCron: b.user_id === null,
      }))
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/briefings/generate", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        showToast(result.error || "Nie udało się wygenerować briefingu");
        return;
      }

      await load();
      showToast("✅ Briefing wygenerowany");
    } catch (err) {
      console.error("Nie udało się wygenerować briefingu:", err);
      showToast("Nie udało się wygenerować briefingu");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>📰 Briefingi</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
            Automatyczne podsumowania dnia od Twojego agenta
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating}
          style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, flexShrink: 0 }}
        >
          {generating ? "Generuję..." : "🔄 Wygeneruj teraz"}
        </button>
      </header>

      {briefings === null && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Wczytuję briefingi...</p>
      )}

      {briefings !== null && briefings.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            border: "1px dashed var(--color-border)",
            borderRadius: 12,
            color: "var(--color-text-muted)",
          }}
        >
          <p style={{ marginBottom: 16 }}>Brak briefingów. Cron job wygeneruje pierwszy jutro rano!</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: "10px 20px", borderRadius: 8 }}
          >
            {generating ? "Generuję..." : "🔄 Wygeneruj teraz"}
          </button>
        </div>
      )}

      {briefings !== null && briefings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {briefings.map((b) => (
            <Link
              key={b.id}
              href={`/briefings/${b.id}`}
              className="history-card-link"
              style={{
                display: "block",
                padding: "16px 18px",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                background: "var(--color-surface)",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--color-text)" }}>
                {formatBriefingDate(b.date)}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {toPlainPreview(b.content)}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 10 }}>
                {b.isFromCron ? "✅ wygenerowany automatycznie (z cron)" : "👤 wygenerowany ręcznie"}
              </div>
            </Link>
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
