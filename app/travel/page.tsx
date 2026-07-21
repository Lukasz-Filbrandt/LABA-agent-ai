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

// Techniczny limit z app/api/travel/route.ts (stopWhen) — zasila panel Diagnostyka
const DIAGNOSTICS_MAX_STEPS = 10;

const SCENARIOS = [
  "Planuję weekend w Berlinie. Budżet: 2000 PLN",
  "Lecę do Paryża na tydzień w sierpniu",
  "Wycieczka do Pragi z rodziną na 3 dni",
  "Podróż służbowa do Londynu w przyszłym tygodniu",
  "Porównaj Barcelonę i Lizbonę na wakacje",
];

type CardKind =
  | "title"
  | "summary"
  | "weather"
  | "budget"
  | "dates"
  | "sights"
  | "checklist"
  | "other";

const CARD_META: Record<
  CardKind,
  { bg: string; border: string; color?: string }
> = {
  title: { bg: "var(--gradient-primary)", border: "transparent", color: "var(--color-on-primary)" },
  summary: { bg: "var(--color-primary-light)", border: "var(--color-border)" },
  weather: { bg: "color-mix(in srgb, #3b82f6 16%, var(--color-surface))", border: "color-mix(in srgb, #3b82f6 45%, transparent)" },
  budget: { bg: "color-mix(in srgb, #f59e0b 16%, var(--color-surface))", border: "color-mix(in srgb, #f59e0b 45%, transparent)" },
  dates: { bg: "color-mix(in srgb, #8b5cf6 16%, var(--color-surface))", border: "color-mix(in srgb, #8b5cf6 45%, transparent)" },
  sights: { bg: "color-mix(in srgb, #14b8a6 16%, var(--color-surface))", border: "color-mix(in srgb, #14b8a6 45%, transparent)" },
  checklist: { bg: "color-mix(in srgb, #22c55e 16%, var(--color-surface))", border: "color-mix(in srgb, #22c55e 45%, transparent)" },
  other: { bg: "var(--color-surface)", border: "var(--color-border)" },
};

function classifyHeading(heading: string): CardKind {
  const h = heading.toLowerCase();
  if (h.includes("plan podróży") || h.includes("plan podrozy")) return "title";
  if (h.includes("podsumowanie")) return "summary";
  if (h.includes("pogoda")) return "weather";
  if (h.includes("budżet") || h.includes("budzet")) return "budget";
  if (
    h.includes("ważne daty") ||
    h.includes("wazne daty") ||
    h.includes("święta") ||
    h.includes("swieta")
  )
    return "dates";
  if (h.includes("zobaczyć") || h.includes("zobaczyc") || h.includes("atrakcje")) return "sights";
  if (h.includes("checklist")) return "checklist";
  return "other";
}

type Section = { kind: CardKind; content: string };

const HEADER_RE = /#{2,3}\s+([^\n#][^\n]*)/g;

/** Dzieli odpowiedź agenta na sekcje wg nagłówków ## / ### — każda staje się osobną kartą */
function splitPlanIntoSections(text: string): Section[] {
  const matches: { index: number; heading: string }[] = [];
  let m: RegExpExecArray | null;
  HEADER_RE.lastIndex = 0;
  while ((m = HEADER_RE.exec(text))) {
    matches.push({ index: m.index, heading: m[1].trim() });
  }

  if (matches.length === 0) {
    const content = text.trim();
    return content ? [{ kind: "other", content }] : [];
  }

  const sections: Section[] = [];
  const lead = text.slice(0, matches[0].index).trim();
  if (lead) sections.push({ kind: "other", content: lead });

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (content) sections.push({ kind: classifyHeading(matches[i].heading), content });
  }

  return sections;
}

function PlanCard({ kind, content }: { kind: CardKind; content: string }) {
  const meta = CARD_META[kind];
  return (
    <div
      style={{
        padding: kind === "title" ? "18px 20px" : "14px 18px",
        borderRadius: 12,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color ?? "var(--color-text)",
      }}
    >
      <div className="markdown-content" style={{ color: meta.color }}>
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
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function TravelPage() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useMessageTimer();

  const transportRef = useRef(new DefaultChatTransport({ api: "/api/travel" }));
  const { messages, sendMessage, status, setMessages, error, regenerate } = useChat({
    transport: transportRef.current,
    onFinish: ({ message }) => timer.finish(message.id),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || isLoading) return;
    timer.start();
    sendMessage({ text: text.trim() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
    setInput("");
  };

  const handleNewChat = () => {
    setMessages([]);
    timer.reset();
  };

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
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>✈️ Asystent podróży AI</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Powiedz dokąd jedziesz — agent zaplanuje wszystko
        </p>
      </header>

      {messages.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-chip"
              onClick={() => send(s)}
              style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, textAlign: "left" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 20,
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
              <div key={message.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "var(--color-primary)",
                    color: "var(--color-on-primary)",
                    fontWeight: 500,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {text}
                </div>
              </div>
            );
          }

          const sections = splitPlanIntoSections(text);
          const isLastMessage = message.id === messages[messages.length - 1]?.id;
          const messageIsLoading = isLoading && isLastMessage;
          const toolParts = (message.parts as ToolPart[]).filter(isToolPart);
          const diagnostics = computeDiagnostics(toolParts, DIAGNOSTICS_MAX_STEPS, messageIsLoading);
          const seconds = timer.elapsed[message.id] ?? (messageIsLoading ? timer.liveSeconds() : 0);

          return (
            <div key={message.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sections.map((section, i) => (
                <PlanCard key={i} kind={section.kind} content={section.content} />
              ))}

              {toolParts.length > 0 && (
                <DiagnosticsPanel diagnostics={diagnostics} seconds={seconds} />
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
            ✈️ Planuję podróż — sprawdzam pogodę, kursy walut i święta...
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
                ⚠️ Nie udało się uzyskać odpowiedzi. {errorHint(error)}
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
          onClick={handleNewChat}
          style={{
            alignSelf: "flex-end",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          🗑 Nowa podróż
        </button>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 0 20px",
          borderTop: "1px solid var(--color-border)",
          marginTop: 12,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Np. Lecę do Barcelony na weekend..."
          className="input-field"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 14 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !input.trim()}
          style={{ padding: "10px 20px", borderRadius: 8, fontSize: 14 }}
        >
          Wyślij
        </button>
      </form>
    </main>
  );
}
