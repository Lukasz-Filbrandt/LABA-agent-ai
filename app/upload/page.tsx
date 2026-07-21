"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { formatRelativeDate } from "@/app/lib/format-relative-date";
import { useAuth } from "@/app/lib/auth-context";

type Progress = { current: number; total: number };

type Chunk = { id: string; content: string; chunkIndex: number };
type DocSummary = { title: string; chunks: Chunk[]; addedAt: string };

type SearchResult = { title: string; content: string; similarity: number };

type StreamEvent =
  | { type: "progress"; current: number; total: number }
  | { type: "done"; chunks_saved: number }
  | { type: "error"; message: string; chunks_saved: number };

/** Polska odmiana liczebnika: forms = [1, 2-4, 5+ (i 12-14)] */
function polishPlural(n: number, forms: [string, string, string]): string {
  if (n === 1) return forms[0];
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return forms[1];
  return forms[2];
}

const chunkWord = (n: number) => polishPlural(n, ["fragment", "fragmenty", "fragmentów"]);
const docWord = (n: number) => polishPlural(n, ["dokument", "dokumenty", "dokumentów"]);

const EXAMPLES: { label: string; title: string; content: string }[] = [
  {
    label: "📄 Cennik",
    title: "Cennik 2026",
    content: `CENNIK USŁUG 2026

Pakiet Basic: 99 zł/miesiąc
- 5 użytkowników
- 10 GB miejsca
- Wsparcie email

Pakiet Premium: 299 zł/miesiąc
- 25 użytkowników
- 100 GB miejsca
- Wsparcie email + telefon
- Priorytetowa obsługa

Pakiet VIP: 599 zł/miesiąc
- Nielimitowani użytkownicy
- 1 TB miejsca
- Wsparcie 24/7
- Dedykowany opiekun
- Szkolenie wdrożeniowe

Wszystkie pakiety z 14-dniowym okresem próbnym.
Faktura VAT wystawiana automatycznie.
Rezygnacja możliwa w dowolnym momencie.`,
  },
  {
    label: "❓ FAQ",
    title: "FAQ",
    content: `Q: Jak mogę anulować subskrypcję?
A: Wyślij email na support@firma.pl z prośbą o anulowanie — subskrypcja zostanie zakończona na koniec bieżącego okresu rozliczeniowego.

Q: Czy mogę zmienić pakiet w trakcie miesiąca?
A: Tak, zmiana pakietu jest możliwa w dowolnym momencie — różnica w cenie zostanie rozliczona proporcjonalnie.

Q: Jakie metody płatności akceptujecie?
A: Akceptujemy karty płatnicze, przelewy oraz BLIK.`,
  },
  {
    label: "📜 Regulamin",
    title: "Regulamin firmy",
    content: `§1. Postanowienia ogólne
1.1 Niniejszy regulamin określa zasady korzystania z usługi.
1.2 Korzystanie z usługi oznacza akceptację niniejszego regulaminu.

§2. Zasady płatności
2.1 Opłata pobierana jest z góry za każdy okres rozliczeniowy.
2.2 Faktura VAT wystawiana jest automatycznie po zaksięgowaniu płatności.`,
  },
];

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadPageInner />
    </Suspense>
  );
}

function UploadPageInner() {
  const { user, getAccessToken } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocSummary[] | null>(null);
  const [deletingTitle, setDeletingTitle] = useState<string | null>(null);
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const highlightedDoc = searchParams.get("doc");
  const scrolledToHighlightRef = useRef(false);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    const { data, error: fetchError } = await supabase
      .from("documents")
      .select("id, title, content, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (fetchError || !data) {
      console.error("Nie udało się wczytać listy dokumentów:", fetchError);
      setDocuments([]);
      return;
    }

    const byTitle = new Map<string, { chunks: Chunk[]; addedAt: string }>();
    for (const row of data) {
      const chunkIndex = (row.metadata as { chunk_index?: number } | null)?.chunk_index ?? 0;
      const chunk: Chunk = { id: row.id, content: row.content, chunkIndex };
      const existing = byTitle.get(row.title);
      if (existing) {
        existing.chunks.push(chunk);
      } else {
        byTitle.set(row.title, { chunks: [chunk], addedAt: row.created_at });
      }
    }

    setDocuments(
      Array.from(byTitle.entries()).map(([t, v]) => ({
        title: t,
        chunks: v.chunks.sort((a, b) => a.chunkIndex - b.chunkIndex),
        addedAt: v.addedAt,
      }))
    );
  }, [user]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Link "📎 Źródło" z czatu (?doc=Nazwa) — rozwiń i podświetl wskazany dokument
  useEffect(() => {
    if (!highlightedDoc || !documents || scrolledToHighlightRef.current) return;
    if (!documents.some((d) => d.title === highlightedDoc)) return;

    scrolledToHighlightRef.current = true;
    setExpandedTitles((prev) => new Set(prev).add(highlightedDoc));
    document
      .getElementById(`doc-${highlightedDoc}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedDoc, documents]);

  const toggleExpand = (docTitle: string) => {
    setExpandedTitles((prev) => {
      const next = new Set(prev);
      if (next.has(docTitle)) next.delete(docTitle);
      else next.add(docTitle);
      return next;
    });
  };

  const handleExample = (example: (typeof EXAMPLES)[number]) => {
    setTitle(example.title);
    setContent(example.content);
    setError(null);
    setDoneMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setDoneMessage(null);
    setProgress(null);

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/upload-knowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Nie udało się zapisać dokumentu.");
      }
      if (!res.body) throw new Error("Brak odpowiedzi z serwera.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          if (!rawLine.trim()) continue;
          const event = JSON.parse(rawLine) as StreamEvent;

          if (event.type === "progress") {
            setProgress({ current: event.current, total: event.total });
          } else if (event.type === "done") {
            setDoneMessage(`✅ Zapisano ${event.chunks_saved} ${chunkWord(event.chunks_saved)}!`);
            setTitle("");
            setContent("");
            void loadDocuments();
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleDelete = async (docTitle: string) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć dokument "${docTitle}" wraz ze wszystkimi fragmentami? Tej operacji nie można cofnąć.`
    );
    if (!confirmed) return;

    if (!user) return;
    setDeletingTitle(docTitle);
    try {
      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("title", docTitle)
        .eq("user_id", user.id);
      if (deleteError) throw deleteError;
      setDocuments((prev) => (prev ?? []).filter((d) => d.title !== docTitle));
    } catch (err) {
      console.error("Nie udało się usunąć dokumentu:", err);
      setError("Nie udało się usunąć dokumentu.");
    } finally {
      setDeletingTitle(null);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults(null);

    try {
      const embedRes = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: searchQuery.trim() }),
      });
      const embedData = await embedRes.json();
      if (!embedRes.ok) throw new Error(embedData.error ?? "Nie udało się wygenerować embeddingu.");

      const { data, error: rpcError } = await supabase.rpc("match_documents", {
        query_embedding: embedData.embedding,
        match_threshold: 0.5,
        match_count: 5,
      });
      if (rpcError) throw rpcError;

      setSearchResults((data as SearchResult[] | null) ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSearching(false);
    }
  };

  const percent = progress ? Math.round((progress.current / progress.total) * 100) : 0;
  const totalChunks = documents?.reduce((sum, d) => sum + d.chunks.length, 0) ?? 0;
  const totalDocs = documents?.length ?? 0;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px 64px" }}>
      <header style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>📚 Baza wiedzy</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wklej tekst — agent będzie z niego korzystał
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="btn btn-chip"
            onClick={() => handleExample(ex)}
            style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13 }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
          className="input-field"
          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Wklej tutaj treść dokumentu..."
          className="input-field"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "inherit",
            minHeight: 300,
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !title.trim() || !content.trim()}
          style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 8, fontSize: 14 }}
        >
          📤 Zapisz w bazie wiedzy
        </button>
      </form>

      <div style={{ paddingTop: 16 }}>
        {isLoading && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: "var(--color-primary-light)",
              fontSize: 13,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              {progress
                ? `Przetwarzam fragment ${progress.current} z ${progress.total}...`
                : "Dzielę tekst na fragmenty..."}
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "var(--color-border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  background: "var(--color-primary)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger-border)",
              color: "var(--color-danger)",
              fontSize: 13,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {doneMessage && !isLoading && !error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--color-primary-light)",
              border: "1px solid var(--color-border)",
              color: "var(--color-primary-hover)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {doneMessage}
          </div>
        )}
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Twoja baza wiedzy</h2>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {totalChunks} {chunkWord(totalChunks)} z {totalDocs} {docWord(totalDocs)}
        </p>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj w bazie wiedzy... (test bez agenta)"
            className="input-field"
            style={{ flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13 }}
          />
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={isSearching || !searchQuery.trim()}
            style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13 }}
          >
            {isSearching ? "Szukam..." : "🔍 Szukaj"}
          </button>
        </form>

        {searchError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--color-danger-bg)",
              border: "1px solid var(--color-danger-border)",
              color: "var(--color-danger)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            ⚠️ {searchError}
          </div>
        )}

        {searchResults && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {searchResults.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Brak wyników — żaden fragment nie pasuje wystarczająco dobrze (próg podobieństwa 0.5).
              </p>
            ) : (
              searchResults.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    <span>{r.title}</span>
                    <span style={{ color: "var(--color-primary-hover)", fontWeight: 600 }}>
                      {(r.similarity * 100).toFixed(0)}% podobieństwa
                    </span>
                  </div>
                  <div style={{ color: "var(--color-text-muted)" }}>{r.content}</div>
                </div>
              ))
            )}
          </div>
        )}

        {documents === null && (
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>Wczytuję dokumenty...</p>
        )}

        {documents !== null && documents.length === 0 && (
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Baza wiedzy jest pusta — wklej pierwszy dokument powyżej.
          </p>
        )}

        {documents !== null && documents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {documents.map((d) => {
              const isExpanded = expandedTitles.has(d.title);
              const isHighlighted = d.title === highlightedDoc;
              return (
                <div
                  key={d.title}
                  id={`doc-${d.title}`}
                  className="history-card"
                  style={{
                    flexDirection: "column",
                    alignItems: "stretch",
                    ...(isHighlighted
                      ? { borderColor: "var(--color-primary)", boxShadow: "0 0 0 2px var(--color-primary-light)" }
                      : {}),
                  }}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(d.title)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "inherit",
                        font: "inherit",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "var(--color-text)" }}>
                        {isExpanded ? "▾" : "▸"} {d.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                        {d.chunks.length} {chunkWord(d.chunks.length)} · dodano {formatRelativeDate(d.addedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost"
                      onClick={() => handleDelete(d.title)}
                      disabled={deletingTitle === d.title}
                      aria-label={`Usuń dokument ${d.title}`}
                      style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, flexShrink: 0 }}
                    >
                      🗑️ Usuń
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid var(--color-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {d.chunks.map((c, i) => (
                        <div
                          key={c.id}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "var(--color-primary-light)",
                            fontSize: 12.5,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--color-text-muted)",
                              marginBottom: 4,
                            }}
                          >
                            Fragment {i + 1}/{d.chunks.length}
                          </div>
                          {c.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
