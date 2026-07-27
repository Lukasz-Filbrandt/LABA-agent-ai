"use client";

import { useState } from "react";

const EXAMPLE_TEXT = `Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.

Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło ale nie dostaje maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.

Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.`;

type ParsedMail = {
  key: string;
  number: string;
  subject: string;
  category: string;
  priority: string;
  justification: string;
  draft: string;
};

type PriorityMeta = {
  bucket: "high" | "medium" | "low" | "spam" | "unknown";
  label: string;
  color: string;
  bg: string;
};

function priorityMeta(priority: string): PriorityMeta {
  if (/🗑️|spam/i.test(priority)) {
    return { bucket: "spam", label: "🗑️ Spam", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)" };
  }
  if (/🔴|wysoki/i.test(priority)) {
    return { bucket: "high", label: "🔴 Wysoki", color: "#fb7185", bg: "rgba(251, 113, 133, 0.12)" };
  }
  if (/🟡|średni/i.test(priority)) {
    return { bucket: "medium", label: "🟡 Średni", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.12)" };
  }
  if (/🟢|niski/i.test(priority)) {
    return { bucket: "low", label: "🟢 Niski", color: "#34d399", bg: "rgba(52, 211, 153, 0.12)" };
  }
  return { bucket: "unknown", label: priority || "⏳ Analizuję…", color: "var(--color-border)", bg: "var(--color-surface)" };
}

/** Wyciąga wartość jednowierszowej komórki tabeli markdown `| Nazwa | wartość |` */
function tableCell(section: string, field: string): string {
  const match = section.match(new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|\\n]+)\\|`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parseResult(text: string): { mails: ParsedMail[]; summaryText: string | null } {
  const summaryIndex = text.search(/##\s*📊?\s*Podsumowanie/i);
  const body = summaryIndex >= 0 ? text.slice(0, summaryIndex) : text;
  const summaryText = summaryIndex >= 0 ? text.slice(summaryIndex) : null;

  const sections = body.split(/(?=###\s*Mail\b)/g).filter((s) => /^###\s*Mail\b/.test(s.trim()));

  const mails: ParsedMail[] = sections.map((section, i) => {
    const headerMatch = section.match(/###\s*Mail\s+(\d+)\s*:?\s*(.*)/);
    const draftMatch = section.match(
      /\*\*Proponowana odpowiedź:\*\*\s*\n((?:>.*(?:\n|$))+)/
    );
    const draft = draftMatch?.[1]
      ? draftMatch[1]
          .split("\n")
          .map((line) => line.replace(/^>\s?/, ""))
          .join("\n")
          .trim()
      : "";

    return {
      key: `${i}-${headerMatch?.[1] ?? i}`,
      number: headerMatch?.[1]?.trim() ?? String(i + 1),
      subject: headerMatch?.[2]?.trim() ?? "",
      category: tableCell(section, "Kategoria"),
      priority: tableCell(section, "Priorytet"),
      justification: tableCell(section, "Uzasadnienie"),
      draft,
    };
  });

  return { mails, summaryText };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function EmailTriagePage() {
  const [emailsText, setEmailsText] = useState("");
  const [resultText, setResultText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "done" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isLoading = status === "loading" || status === "streaming";

  const handlePasteExample = () => setEmailsText(EXAMPLE_TEXT);

  const handleCopy = async (key: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    }
  };

  const handleAnalyze = async () => {
    const emails = emailsText
      .split(/\n\s*\n+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length === 0 || isLoading) return;

    setStatus("loading");
    setErrorMessage(null);
    setResultText("");

    try {
      const res = await fetch("/api/email-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Błąd serwera (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setStatus("streaming");
        text += decoder.decode(value, { stream: true });
        setResultText(text);
      }

      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  };

  const { mails, summaryText } = parseResult(resultText);

  const counts = mails.reduce(
    (acc, m) => {
      const bucket = priorityMeta(m.priority).bucket;
      if (bucket === "high") acc.high++;
      else if (bucket === "medium") acc.medium++;
      else if (bucket === "low") acc.low++;
      else if (bucket === "spam") acc.spam++;
      return acc;
    },
    { high: 0, medium: 0, low: 0, spam: 0 }
  );

  const recommendation = summaryText?.match(/Rekomendacja[:\s]*([^\n]+)/i)?.[1]?.trim();

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px 40px" }}>
      <header style={{ padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>📧 E-mail Triage</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Wklej maile — agent posortuje i napisze odpowiedzi
        </p>
      </header>

      <textarea
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
        placeholder="Wklej maile tutaj — oddziel je pustą linią..."
        className="input-field"
        style={{
          width: "100%",
          minHeight: 200,
          padding: "12px 14px",
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 10 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handlePasteExample}
          style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13 }}
        >
          📋 Wklej przykład
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAnalyze}
          disabled={isLoading || !emailsText.trim()}
          style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, marginLeft: "auto" }}
        >
          {isLoading ? "Analizuję…" : "📧 Analizuj maile"}
        </button>
      </div>

      {errorMessage && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger-border)",
            color: "var(--color-danger)",
            fontSize: 13,
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      {mails.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            fontSize: 13,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>🔴 Pilne: <strong>{counts.high}</strong></span>
          <span>🟡 Średnie: <strong>{counts.medium}</strong></span>
          <span>🟢 Niskie: <strong>{counts.low}</strong></span>
          <span>🗑️ Spam: <strong>{counts.spam}</strong></span>
          {recommendation && (
            <span style={{ width: "100%", color: "var(--color-text-muted)" }}>
              ✅ {recommendation}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {mails.map((mail) => {
          const meta = priorityMeta(mail.priority);
          const hasDraft = mail.draft && !/^brak/i.test(mail.draft);

          return (
            <div
              key={mail.key}
              style={{
                borderRadius: 12,
                padding: 16,
                background: "var(--color-surface)",
                border: `1px solid ${meta.color}`,
                borderLeft: `4px solid ${meta.color}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontSize: 15 }}>
                  Mail {mail.number}
                  {mail.subject ? `: ${mail.subject}` : ""}
                </strong>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 8,
                    background: meta.bg,
                    color: meta.color,
                    whiteSpace: "nowrap",
                  }}
                >
                  {meta.label}
                </span>
              </div>

              {mail.category && (
                <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
                  Kategoria: {mail.category}
                </div>
              )}
              {mail.justification && (
                <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {mail.justification}
                </div>
              )}

              {mail.draft && (
                <>
                  <blockquote
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      borderLeft: "3px solid var(--color-border)",
                      color: "var(--color-text)",
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {mail.draft}
                  </blockquote>
                  {hasDraft && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleCopy(mail.key, mail.draft)}
                      style={{ marginTop: 8, padding: "5px 12px", borderRadius: 8, fontSize: 12 }}
                    >
                      {copiedKey === mail.key ? "✅ Skopiowano" : "📋 Kopiuj draft"}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {status === "loading" && mails.length === 0 && (
        <p style={{ marginTop: 20, fontSize: 13, color: "var(--color-text-muted)" }}>
          Analizuję maile…
        </p>
      )}
    </main>
  );
}
