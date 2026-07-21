"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { errorHint } from "@/app/lib/error-hint";
import { computeDiagnostics, isToolPart } from "@/app/lib/diagnostics";
import { useMessageTimer } from "@/app/lib/use-message-timer";
import DiagnosticsPanel from "@/app/components/DiagnosticsPanel";

const MAX_STEPS = 5;
// Techniczny limit z app/api/react/route.ts (stopWhen) — zasila panel Diagnostyka
const DIAGNOSTICS_MAX_STEPS = 10;

const SCENARIOS = [
  "Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca w Wikipedii, i powiedz czy są jakieś święta w ten weekend",
  "Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach, i zapisz wszystkie kursy w notatkach",
  "Porównaj pogodę w Warszawie, Berlinie i Paryżu. Który z tych miast ma dziś najlepszą pogodę?",
  "Ile dni do następnego święta w Polsce? Jaka będzie wtedy pogoda?",
];

const TOOL_EMOJI: Record<string, string> = {
  calculator: "🧮",
  currentDateTime: "🕐",
  getWeather: "🌤️",
  getExchangeRate: "💱",
  getHolidays: "📅",
  searchWikipedia: "📖",
  readWebPage: "📄",
  saveNote: "📝",
  getNotes: "🗒️",
  google_search: "🌐",
  searchKnowledge: "📚",
};

function toolEmoji(name: string) {
  return TOOL_EMOJI[name] ?? "🔧";
}

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function toolPartName(part: ToolPart) {
  return part.toolName ?? part.type.replace(/^tool-/, "");
}

type SectionKind = "thought" | "observation" | "result" | "plain";

type Segment =
  | { kind: SectionKind; content: string }
  | { kind: "tool"; part: ToolPart };

const HEADER_RE = /###\s*(🧠|👁️|✅)/g;

/**
 * Dzieli tekst kroku na sekcje wg nagłówków ### 🧠 / ### 👁️ / ### ✅.
 * Szuka znaczników w całym tekście (nie tylko na początku linii) — model
 * czasem dokleja kolejny nagłówek w tym samym akapicie bez nowej linii.
 */
function splitTextIntoSegments(text: string): Segment[] {
  const matches: { index: number; kind: SectionKind }[] = [];
  let match: RegExpExecArray | null;
  HEADER_RE.lastIndex = 0;
  while ((match = HEADER_RE.exec(text))) {
    matches.push({
      index: match.index,
      kind: match[1] === "🧠" ? "thought" : match[1] === "👁️" ? "observation" : "result",
    });
  }

  if (matches.length === 0) {
    const content = text.trim();
    return content ? [{ kind: "plain", content }] : [];
  }

  const segments: { kind: SectionKind; content: string }[] = [];
  const lead = text.slice(0, matches[0].index).trim();
  if (lead) segments.push({ kind: "plain", content: lead });

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (content) segments.push({ kind: matches[i].kind, content });
  }

  return segments;
}

/** Łączy fragmenty tekstu i wywołania narzędzi z message.parts w chronologiczną listę kroków */
function messageSegments(message: { parts: unknown[] }): Segment[] {
  const segments: Segment[] = [];
  for (const part of message.parts as ToolPart[]) {
    if (part.type === "text") {
      segments.push(...splitTextIntoSegments((part as unknown as { text: string }).text));
    } else if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
      segments.push({ kind: "tool", part });
    }
  }
  return segments;
}

/** Wyciąga same wywołania narzędzi z message.parts — zasila panel Diagnostyka */
function messageToolParts(message: { parts: unknown[] }): ToolPart[] {
  return (message.parts as ToolPart[]).filter(isToolPart);
}

const CITATION_RE = /^📎\s*Źródł[oa]:\s*(.+)$/m;

/** Wyciąga linię "📎 Źródło: ..." dopisaną przez agenta (patrz W4_CYTOWANIE.md) z reszty odpowiedzi */
function extractCitation(content: string): { body: string; sources: string[] } {
  const match = content.match(CITATION_RE);
  if (!match) return { body: content, sources: [] };

  const sources = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return { body: content.replace(CITATION_RE, "").trim(), sources };
}

function CitationFooter({ sources }: { sources: string[] }) {
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.15)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "#8fd6a0",
      }}
    >
      <span>📎 {sources.length > 1 ? "Źródła:" : "Źródło:"}</span>
      {sources.map((source, i) => (
        <span key={source}>
          <Link
            href={`/upload?doc=${encodeURIComponent(source)}`}
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            {source}
          </Link>
          {i < sources.length - 1 ? "," : ""}
        </span>
      ))}
    </div>
  );
}

const SECTION_META: Record<
  SectionKind,
  { bg: string; border: string; color: string }
> = {
  thought: { bg: "#1a1a3a", border: "#3b3b7a", color: "#c7c7f5" },
  observation: { bg: "#2a1a0a", border: "#a5651b", color: "#f2c88f" },
  result: { bg: "#0a2a0a", border: "#1f8a3b", color: "#bdf5c6" },
  plain: {
    bg: "var(--color-primary-light)",
    border: "var(--color-border)",
    color: "var(--color-text)",
  },
};

function SectionCard({ kind, content }: { kind: SectionKind; content: string }) {
  const meta = SECTION_META[kind];
  const { body, sources } = kind === "result" ? extractCitation(content) : { body: content, sources: [] };

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
      }}
    >
      <div className="markdown-content" style={{ color: meta.color }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
      {sources.length > 0 && <CitationFooter sources={sources} />}
    </div>
  );
}

function ToolCard({ part }: { part: ToolPart }) {
  const name = toolPartName(part);
  const emoji = toolEmoji(name);
  const running = part.state === "input-streaming" || part.state === "input-available";
  const sdkError = part.state === "output-error" ? part.errorText : undefined;
  const output = part.output as Record<string, unknown> | string | undefined;
  const isError =
    !!sdkError || (typeof output === "object" && output !== null && "error" in output && !!output.error);

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: "4px solid #f5a623",
        fontSize: 12.5,
      }}
    >
      <div style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>
        ⚡ {emoji} {name}
        {part.input ? `(${JSON.stringify(part.input).slice(0, 100)})` : ""}
        {running && " ⏳"}
      </div>
      {!running && (sdkError || output != null) && (
        <div
          style={{
            marginTop: 6,
            color: isError ? "var(--color-danger)" : "var(--color-text)",
          }}
        >
          →{" "}
          {sdkError
            ? sdkError.slice(0, 300)
            : typeof output === "string"
              ? output.slice(0, 300)
              : JSON.stringify(output).slice(0, 300)}
        </div>
      )}
    </div>
  );
}

export default function ReactAgentPage() {
  return (
    <Suspense fallback={null}>
      <ReactAgentPageInner />
    </Suspense>
  );
}

function ReactAgentPageInner() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const initialPromptSentRef = useRef(false);

  const timer = useMessageTimer();

  const transportRef = useRef(new DefaultChatTransport({ api: "/api/react" }));
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

  // Szybka akcja z dashboardu ("Porównaj waluty") może przyjść z gotowym promptem w URL
  useEffect(() => {
    const initialPrompt = searchParams.get("q");
    if (initialPrompt && !initialPromptSentRef.current) {
      initialPromptSentRef.current = true;
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>
          🔄 Agent ReAct — Autonomiczne rozumowanie
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
          Opisz cel → agent sam planuje i realizuje
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

          if (isUser) {
            const text = (message.parts as { type: string; text?: string }[])
              .filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join("");
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

          const segments = messageSegments(message);
          const stepCount = segments.filter((s) => s.kind === "thought").length;
          const isLastMessage = message.id === messages[messages.length - 1]?.id;
          const messageIsLoading = isLoading && isLastMessage;
          const toolParts = messageToolParts(message);
          const diagnostics = computeDiagnostics(toolParts, DIAGNOSTICS_MAX_STEPS, messageIsLoading);
          const seconds = timer.elapsed[message.id] ?? (messageIsLoading ? timer.liveSeconds() : 0);

          return (
            <div key={message.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {segments.length > 0 && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 8,
                    background: "var(--color-primary-light)",
                    color: "var(--color-primary-hover)",
                  }}
                >
                  Krok {Math.max(stepCount, 1)} z {MAX_STEPS}
                </div>
              )}

              {segments.map((segment, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {i > 0 && (
                    <div style={{ height: 1, background: "var(--color-border)", opacity: 0.6 }} />
                  )}
                  {segment.kind === "tool" ? (
                    <ToolCard part={segment.part} />
                  ) : (
                    <SectionCard kind={segment.kind} content={segment.content} />
                  )}
                </div>
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
            🔄 Agent rozumuje...
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
          🗑 Nowa rozmowa
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
          placeholder="Opisz co chcesz osiągnąć..."
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
