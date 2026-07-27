import type { Diagnostics } from "@/app/lib/diagnostics";
import { errorHint } from "@/app/lib/error-hint";

const STATUS_META: Record<Diagnostics["status"], { emoji: string; label: string }> = {
  loading: { emoji: "⏳", label: "W trakcie..." },
  limit: { emoji: "⚠️", label: "Limit kroków" },
  done: { emoji: "✅", label: "Zadanie ukończone" },
};

export default function DiagnosticsPanel({
  diagnostics,
  seconds,
}: {
  diagnostics: Diagnostics;
  seconds: number;
}) {
  const meta = STATUS_META[diagnostics.status];
  const percent = Math.min(100, (diagnostics.steps / diagnostics.maxSteps) * 100);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "90%",
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        fontSize: 12.5,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>🛡️ Diagnostyka</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ color: "var(--color-text-muted)", minWidth: 48 }}>Kroki:</span>
        <div
          style={{
            flex: 1,
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
              background: diagnostics.barColor,
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <span>
          {diagnostics.steps}/{diagnostics.maxSteps}
        </span>
      </div>

      <div style={{ color: "var(--color-text-muted)", marginBottom: 4 }}>
        Narzędzia:{" "}
        {diagnostics.toolCounts.length > 0
          ? diagnostics.toolCounts.map((t) => `${t.name}(${t.count})`).join(", ")
          : "—"}
      </div>

      <div
        style={{
          color: diagnostics.errorCount > 0 ? "var(--color-danger)" : "var(--color-text-muted)",
          marginBottom: 4,
        }}
      >
        Błędy: {diagnostics.errorCount}
      </div>

      <div style={{ color: "var(--color-text-muted)" }}>Czas: {seconds.toFixed(1)}s</div>

      {diagnostics.errors.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {diagnostics.errors.map((e, i) => (
            <div key={i} style={{ color: "var(--color-danger)" }}>
              🔴 {e.name}
              {e.input != null ? `(${JSON.stringify(e.input).slice(0, 60)})` : "()"} — {errorHint(e.message)}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, fontWeight: 600 }}>
        {meta.emoji} Status: {meta.label}
      </div>
    </div>
  );
}
