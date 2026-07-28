"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { errorHint } from "@/app/lib/error-hint";
import { computeDiagnostics, isToolPart, type ToolPart } from "@/app/lib/diagnostics";
import { useMessageTimer } from "@/app/lib/use-message-timer";
import DiagnosticsPanel from "@/app/components/DiagnosticsPanel";

// Techniczny limit z app/api/competitor/route.ts (maxSteps) — zasila panel Diagnostyka
const DIAGNOSTICS_MAX_STEPS = 10;

const EXAMPLES = [
  ["Shopify", "WooCommerce", "PrestaShop"],
  ["Notion", "Obsidian", "Evernote"],
  ["Vercel", "Netlify", "Railway"],
  ["ChatGPT", "Claude", "Gemini"],
];

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

function buildPrompt(companies: string[], context: string): string {
  const names = companies.map((c) => c.trim()).filter(Boolean);
  let prompt = `Porównaj firmy: ${names.join(", ")}.`;
  if (context.trim()) {
    prompt += `\nKontekst: ${context.trim()}`;
  }
  return prompt;
}

export default function CompetitorPage() {
  const [company1, setCompany1] = useState("");
  const [company2, setCompany2] = useState("");
  const [company3, setCompany3] = useState("");
  const [context, setContext] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timer = useMessageTimer();

  const transportRef = useRef(new DefaultChatTransport({ api: "/api/competitor" }));
  const { messages, sendMessage, status, setMessages, error, regenerate } = useChat({
    transport: transportRef.current,
    onFinish: ({ message }) => timer.finish(message.id),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const compare = (companies: string[], contextText: string) => {
    const names = companies.map((c) => c.trim()).filter(Boolean);
    if (names.length < 2 || isLoading) return;
    timer.start();
    sendMessage({ text: buildPrompt(companies, contextText) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    compare([company1, company2, company3], context);
  };

  const runExample = (companies: string[]) => {
    setCompany1(companies[0] ?? "");
    setCompany2(companies[1] ?? "");
    setCompany3(companies[2] ?? "");
    setContext("");
    compare(companies, "");
  };

  const handleNewAnalysis = () => {
    setMessages([]);
    timer.reset();
  };

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    }
  };

  const canSubmit = [company1, company2, company3].filter((c) => c.trim()).length >= 2;

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 16px",
      }}
    >
      <header style={{ padding: "24px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>🏢 Analiza konkurencji</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Podaj firmy — agent porówna je za Ciebie
        </p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={company1}
            onChange={(e) => setCompany1(e.target.value)}
            placeholder="Np. Shopify"
            className="input-field"
            style={{ flex: "1 1 160px", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
          />
          <input
            value={company2}
            onChange={(e) => setCompany2(e.target.value)}
            placeholder="Np. WooCommerce"
            className="input-field"
            style={{ flex: "1 1 160px", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
          />
          <input
            value={company3}
            onChange={(e) => setCompany3(e.target.value)}
            placeholder="Np. PrestaShop"
            className="input-field"
            style={{ flex: "1 1 160px", padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Kontekst (opcjonalnie) — np. Szukam platformy e-commerce dla małego sklepu"
          className="input-field"
          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 14, minHeight: 70, fontFamily: "inherit", resize: "vertical" }}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !canSubmit}
          style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14, alignSelf: "flex-end" }}
        >
          🔍 Porównaj
        </button>
      </form>

      {messages.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {EXAMPLES.map((companies) => (
            <button
              key={companies.join("-")}
              type="button"
              className="btn btn-chip"
              onClick={() => runExample(companies)}
              style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, textAlign: "left" }}
            >
              {companies.join(" vs ")}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          overflowY: "auto",
          paddingBottom: 16,
        }}
      >
        {messages.map((message) => {
          const isUser = message.role === "user";
          const text = (message.parts as { type: string; text?: string }[])
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join("");

          if (isUser) {
            return (
              <div
                key={message.id}
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  borderTop: "1px solid var(--color-border)",
                  paddingTop: 16,
                  whiteSpace: "pre-wrap",
                }}
              >
                {text}
              </div>
            );
          }

          const isLastMessage = message.id === messages[messages.length - 1]?.id;
          const messageIsLoading = isLoading && isLastMessage;
          const toolParts = (message.parts as ToolPart[]).filter(isToolPart);
          const diagnostics = computeDiagnostics(toolParts, DIAGNOSTICS_MAX_STEPS, messageIsLoading);
          const seconds = timer.elapsed[message.id] ?? (messageIsLoading ? timer.liveSeconds() : 0);

          return (
            <div key={message.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {toolParts.length > 0 && (
                <DiagnosticsPanel diagnostics={diagnostics} seconds={seconds} />
              )}

              {text && (
                <div
                  style={{
                    padding: "20px 24px",
                    borderRadius: 12,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    overflowX: "auto",
                  }}
                >
                  <div className="markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {text}
                    </ReactMarkdown>
                  </div>

                  {!messageIsLoading && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleCopy(message.id, text)}
                      style={{ marginTop: 16, padding: "6px 14px", borderRadius: 8, fontSize: 12 }}
                    >
                      {copiedId === message.id ? "✅ Skopiowano" : "📋 Kopiuj analizę"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--color-primary-light)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            🔎 Szukam informacji o firmach i porównuję...
          </div>
        )}

        {error && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 12,
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                color: "var(--color-danger)",
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                ⚠️ Nie udało się wygenerować analizy. {errorHint(error)}
              </div>
              <button
                type="button"
                className="btn btn-danger-ghost"
                onClick={() => regenerate()}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12 }}
              >
                🔄 Spróbuj ponownie
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length > 0 && (
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={handleNewAnalysis}
          style={{
            alignSelf: "flex-end",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          🗑 Nowa analiza
        </button>
      )}
    </main>
  );
}
